#!/usr/bin/env bun
/**
 * Wires the AI demo's SQLite products + LLM into shopG41 as a pipeline:
 *
 *   products (rows) → ai (copy) → transform (shape)
 *
 * Two shapes, because the data and the model can live on different machines:
 *
 *   bun run wire --local
 *     shopG41 opens `products.db` itself and calls the mock LLM on this machine.
 *     Only works when the platform runs here too.
 *
 *   BACKEND_URL="https://rows-tunnel.example" \
 *   LLM_URL="https://llm-tunnel.example" bun run wire
 *     shopG41 calls this app over HTTPS for both: a `function` step reads the
 *     rows, and the `ai` step calls the LLM. This is the shape for a hosted
 *     platform — nothing but URLs is stored on it.
 *
 * Flags
 *   --local  register a `sqlite` data source and the local mock LLM
 *   --undo   remove the data sources and endpoint this script created
 */
import { Database } from "bun:sqlite"
import { createHmac } from "node:crypto"
import { ShopG41Client } from "../../packages/sdk/src/index"

const BASE_URL = process.env.SHOPG41_BASE_URL || "http://demo.localhost:3001"
const API_KEY = process.env.SHOPG41_API_KEY
const TENANT = process.env.SHOPG41_TENANT
const ROWS_URL = (process.env.BACKEND_URL || "").replace(/\/$/, "")
const LLM_URL = (process.env.LLM_URL || "http://localhost:3006").replace(/\/$/, "")
/**
 * The `ai` step appends `/v1/chat/completions` unless the URL already ends with
 * it (packages/ai `resolveAiEndpoint`). Store the full path so the platform's
 * data-source test POSTs somewhere that answers, and the step uses it verbatim.
 */
const LLM_ENDPOINT = /\/chat\/completions$/.test(LLM_URL)
  ? LLM_URL
  : `${LLM_URL}/v1/chat/completions`
const DEMO_LLM_API_KEY = process.env.DEMO_LLM_API_KEY || "demo-key"
const FUNCTION_SECRET = process.env.FUNCTION_SECRET || "ai-demo-secret"

const LOCAL = process.argv.includes("--local")
const UNDO = process.argv.includes("--undo")

/** Absolute by design: the platform resolves a relative path against its own cwd. */
const DB_PATH = `${import.meta.dir}/products.db`
const ENDPOINT_PATH = "ai-product-copy"

if (!API_KEY) {
  console.error("Set SHOPG41_API_KEY=sk_... (create an admin-scoped key in the shopG41 admin panel)")
  process.exit(1)
}
if (!LOCAL && !UNDO && !ROWS_URL) {
  console.error(
    "Set BACKEND_URL (the tunnel for the signed /function route) and LLM_URL, e.g.\n" +
      "  BACKEND_URL=https://rows.example LLM_URL=https://llm.example bun run wire\n" +
      "For a platform on this machine:  bun run wire --local",
  )
  process.exit(1)
}

// Seed the SQLite file (the demo app creates it too) so this script never wires
// a data source pointing at a missing file.
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
const log = (msg: string) => console.log(msg)

function sign(body: string): string {
  return createHmac("sha256", FUNCTION_SECRET).update(body).digest("hex")
}

/** Best-effort: the platform's own test is the authoritative check. */
async function probeBackend(): Promise<number | null> {
  const body = JSON.stringify({ prev: null })
  try {
    const res = await fetch(`${ROWS_URL}/function`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-ShopG41-Signature": sign(body) },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { rows?: unknown[] }
    return Array.isArray(data.rows) ? data.rows.length : null
  } catch {
    return null
  }
}

async function ensureDataSource(
  name: string,
  kind: string,
  config: Record<string, string>,
): Promise<number> {
  const { dataSources } = await admin.dataSources.list()
  const existing = dataSources.find((d) => d.name === name)

  if (existing) {
    if (existing.kind !== kind) {
      await admin.dataSources.delete(existing.id)
      const { id } = await admin.dataSources.create({ name, kind, config })
      log(`   replaced ${existing.kind} data source "${name}" (id=${id})`)
      return id
    }
    await admin.dataSources.update(existing.id, { name, config })
    log(`   updated "${name}" (id=${existing.id})`)
    return existing.id
  }

  const { id } = await admin.dataSources.create({ name, kind, config })
  log(`   created "${name}" (id=${id})`)
  return id
}

function stepsFor(rowsDataSourceId: number, llmDataSourceId: number) {
  return [
    LOCAL
      ? {
          type: "query",
          dataSourceId: rowsDataSourceId,
          sql: "SELECT id, name, price, image_url FROM products ORDER BY id DESC",
        }
      : { type: "function", dataSourceId: rowsDataSourceId },
    {
      type: "ai",
      dataSourceId: llmDataSourceId,
      model: "demo-llm",
      systemPrompt:
        "You are a marketing copywriter for a boutique store. Always reply with valid JSON only, no markdown fences.",
      prompt:
        'Write a short headline, a one-line tagline and 4 keywords for each product. Return JSON in exactly this shape: {"products":[{"id":1,"headline":"...","tagline":"...","keywords":["..."]}]}.',
    },
    { type: "transform", path: "$.products", fields: ["id", "headline", "tagline", "keywords"] },
  ]
}

async function ensureEndpoint(steps: unknown[]): Promise<number> {
  const { endpoints } = await admin.endpoints.list()
  const existing = endpoints.find((e) => e.method === "GET" && e.path === ENDPOINT_PATH)

  if (existing) {
    await admin.endpoints.update(existing.id, { handlerConfig: { steps } })
    log(`   updated endpoint /api/e/${ENDPOINT_PATH} (id=${existing.id})`)
    return existing.id
  }

  const { id } = await admin.endpoints.create({
    name: "AI Product Copy",
    path: ENDPOINT_PATH,
    method: "GET",
    handlerKind: "pipeline",
    status: "published",
    handlerConfig: { steps },
  })
  log(`   published endpoint /api/e/${ENDPOINT_PATH} (id=${id})`)
  return id
}

async function undo(): Promise<void> {
  const { endpoints } = await admin.endpoints.list()
  for (const e of endpoints.filter((e) => e.method === "GET" && e.path === ENDPOINT_PATH)) {
    await admin.endpoints.delete(e.id)
    log(`   deleted endpoint ${e.path} (id=${e.id})`)
  }
  const { dataSources } = await admin.dataSources.list()
  for (const d of dataSources.filter((d) => d.name.startsWith("AI Demo "))) {
    await admin.dataSources.delete(d.id)
    log(`   deleted data source "${d.name}" (id=${d.id})`)
  }
  log("\nDone — the demo's wiring is gone.")
}

async function main() {
  if (UNDO) {
    log("Undoing the wiring…")
    return undo()
  }

  log(`Platform: ${BASE_URL}`)
  let order = 1
  const step = () => `${order++}.`

  if (!LOCAL) {
    log(`Mode: remote — rows from ${ROWS_URL}/function, LLM at ${LLM_ENDPOINT}`)
    log(`${step()} Probing the rows backend…`)
    const rows = await probeBackend()
    if (rows === null) {
      log("   ! not reachable from this machine (DNS/blocked); the platform's test below decides")
    } else {
      log(`   ✓ reachable, ${rows} rows in SQLite`)
    }
  } else {
    log(`Mode: local — shopG41 opens ${DB_PATH} and calls ${LLM_URL}`)
  }

  log(`${step()} Registering the rows data source…`)
  const rowsDsId = await ensureDataSource(
    "AI Demo Products",
    LOCAL ? "sqlite" : "passthrough",
    LOCAL ? { path: DB_PATH } : { url: `${ROWS_URL}/function`, secret: FUNCTION_SECRET },
  )
  log(`   Testing it from the platform…`)
  const rowsTest = await admin.dataSources.test(rowsDsId)
  log(`   ${rowsTest.ok ? "✓ rows OK" : `✗ rows FAILED — ${rowsTest.error}`}`)
  if (!rowsTest.ok) process.exit(1)

  log(`${step()} Registering the LLM data source…`)
  const llmDsId = await ensureDataSource("AI Demo LLM", "function", {
    url: LLM_ENDPOINT,
    apiKey: DEMO_LLM_API_KEY,
  })
  log(`   Testing it from the platform…`)
  const llmTest = await admin.dataSources.test(llmDsId)
  log(`   ${llmTest.ok ? "✓ LLM OK (ping → pong)" : `✗ LLM FAILED — ${llmTest.error}`}`)
  if (!llmTest.ok) process.exit(1)

  log(`${step()} Publishing the pipeline…`)
  await ensureEndpoint(stepsFor(rowsDsId, llmDsId))

  log(`${step()} Calling the pipeline through shopG41…`)
  const result = (await client.endpoints.call<unknown>("/ai-product-copy")) as {
    error?: string
  } & Array<Record<string, unknown>>
  if (result?.error) {
    console.error(`   ✗ ${result.error}`)
    process.exit(1)
  }
  const items = Array.isArray(result) ? result : []
  log(`   ${items.length} products written:`)
  log(`   ${JSON.stringify(items[0] ?? null)}`)

  log("\nDone! The pipeline is live at:")
  log(`  ${BASE_URL}/api/e/${ENDPOINT_PATH}`)
  log("Remove the wiring with:  bun run wire --undo")
}

main().catch((err) => {
  console.error("Error:", err.message)
  process.exit(1)
})
