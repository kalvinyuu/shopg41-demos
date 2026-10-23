#!/usr/bin/env bun
// Wires the AI demo's SQLite product DB + mock LLM into shopG41 as data
// sources and publishes a pipeline endpoint at GET /api/e/ai-product-copy.
import { Database } from "bun:sqlite"
import { ShopG41Client } from "../../packages/sdk/src/index"

const BASE_URL = process.env.SHOPG41_BASE_URL || "http://demo.localhost:3001"
const API_KEY = process.env.SHOPG41_API_KEY
const TENANT = process.env.SHOPG41_TENANT
const LLM_URL = process.env.LLM_URL || "http://localhost:3006"
const DEMO_LLM_API_KEY = process.env.DEMO_LLM_API_KEY || "demo-key"

if (!API_KEY) {
  console.error("Set SHOPG41_API_KEY=sk_... (create an admin-scoped key in the shopG41 admin panel)")
  process.exit(1)
}

// The SQLite file must exist at an absolute path so shopG41 (running in its
// own working directory) can open it. Seed it here if the server hasn't yet.
const DB_PATH = `${import.meta.dir}/products.db`
const db = new Database(DB_PATH, { create: true })
db.run(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    image_url TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

const wrapFetch: typeof fetch | undefined = TENANT
  ? ((input: any, init?: any) =>
      fetch(input, {
        ...init,
        headers: { ...((init?.headers as Record<string, string>) ?? {}), "X-Tenant": TENANT },
      })) as typeof fetch
  : undefined

const client = new ShopG41Client({ baseUrl: BASE_URL, apiKey: API_KEY, fetch: wrapFetch })
const admin = client.admin!

async function ensureDataSource(name: string, kind: string, config: Record<string, string>): Promise<number> {
  const { dataSources } = await admin.dataSources.list()
  const existing = dataSources.find((d) => d.name === name)
  if (existing) {
    console.log(`   Reusing existing data source "${name}" (id=${existing.id})`)
    return existing.id
  }
  const { id } = await admin.dataSources.create({ name, kind, config })
  console.log(`   Created data source "${name}" (id=${id})`)
  return id
}

async function main() {
  console.log("1. Registering SQLite product data source…")
  const sqliteDsId = await ensureDataSource("AI Demo Products", "sqlite", { path: DB_PATH })

  console.log("2. Registering LLM data source (function kind → OpenAI-compatible endpoint)…")
  const llmDsId = await ensureDataSource("AI Demo LLM", "function", {
    url: LLM_URL,
    apiKey: DEMO_LLM_API_KEY,
  })

  console.log("3. Testing connections…")
  const sqliteTest = await admin.dataSources.test(sqliteDsId)
  console.log(`   SQLite: ${sqliteTest.ok ? "OK" : `FAILED — ${sqliteTest.error}`}`)
  const llmTest = await admin.dataSources.test(llmDsId)
  console.log(`   LLM:    ${llmTest.ok ? "OK (ping → pong)" : `FAILED — ${llmTest.error}`}`)

  console.log("4. Publishing pipeline endpoint GET /api/e/ai-product-copy…")
  const steps = [
    {
      type: "query",
      dataSourceId: sqliteDsId,
      sql: "SELECT id, name, price, image_url FROM products ORDER BY id DESC",
    },
    {
      type: "ai",
      dataSourceId: llmDsId,
      model: "demo-llm",
      systemPrompt:
        "You are a marketing copywriter for a boutique store. Always reply with valid JSON only, no markdown fences.",
      prompt:
        'Write a short headline, a one-line tagline and 4 keywords for each product. Return JSON in exactly this shape: {"products":[{"id":1,"headline":"...","tagline":"...","keywords":["..."]}]}.',
    },
    { type: "transform", path: "$.products", fields: ["id", "headline", "tagline", "keywords"] },
  ]

  const { endpoints } = await admin.endpoints.list()
  const existing = endpoints.find((e) => e.method === "GET" && e.path === "ai-product-copy")
  if (existing) {
    await admin.endpoints.update(existing.id, { handlerConfig: { steps } })
    console.log(`   Reused existing endpoint id=${existing.id} and updated its pipeline`)
  } else {
    await admin.endpoints.create({
      name: "AI Product Copy",
      path: "ai-product-copy",
      method: "GET",
      handlerKind: "pipeline",
      status: "published",
      handlerConfig: { steps },
    })
    console.log("   Endpoint published")
  }

  console.log("5. Calling the pipeline through shopG41…")
  const result = await client.endpoints.call<unknown>("/ai-product-copy")
  console.log("   Result:", JSON.stringify(result, null, 2))

  console.log("\nDone! The demo frontend at http://localhost:3006 can now generate copy.")
  console.log(`Pipeline URL: ${BASE_URL}/api/e/ai-product-copy`)
}

main().catch((err) => {
  console.error("Error:", err.message)
  process.exit(1)
})
