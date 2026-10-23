import { Database } from "bun:sqlite"
import index from "./index.html"
import { ShopG41Client } from "../../packages/sdk/src/index"

const PORT = Number(process.env.PORT || 3006)
const DB_PATH = process.env.DB_PATH || `${import.meta.dir}/products.db`

// ─────────────────────────────────────────────────────────────────────────────
// SQLite product database — data lives HERE, shopG41 queries it on demand
// ─────────────────────────────────────────────────────────────────────────────
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

const seeded = db.query("SELECT COUNT(*) AS n FROM products").get() as { n: number }
if (seeded.n === 0) {
  const insert = db.prepare(
    "INSERT INTO products (name, price, image_url) VALUES (?, ?, ?)"
  )
  for (const p of [
    { name: "Midnight Tote", price: 34.0 },
    { name: "Cloud Linen Scarf", price: 22.5 },
    { name: "Brass Candle Holder", price: 18.0 },
    { name: "Ocean Glass Vase", price: 41.75 },
  ]) {
    insert.run(
      p.name,
      p.price,
      `https://placehold.co/400x400/eee/999?text=${encodeURIComponent(p.name.slice(0, 12))}`
    )
  }
  console.log(`Seeded ${4} products into ${DB_PATH}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock LLM — OpenAI-compatible POST /v1/chat/completions
// Set OPENAI_API_KEY to proxy through to real OpenAI instead of mocking.
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_LLM_API_KEY = process.env.DEMO_LLM_API_KEY || "demo-key"
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

function generateCopy(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const name = String(row.name ?? "Product")
    const price = Number(row.price ?? 0)
    return {
      id: row.id,
      headline: `${name} — handpicked for you`,
      tagline: `From £${price.toFixed(2)} · crafted with care, small-batch.`,
      keywords: [...name.split(/\s+/), "gift", "handmade", "limited-edition"],
    }
  })
}

function extractRows(content: string): Array<Record<string, unknown>> {
  const marker = "Here is the data from the previous step:"
  const idx = content.indexOf(marker)
  if (idx === -1) return []
  const json = content.slice(idx + marker.length).trim()
  try {
    const parsed = JSON.parse(json) as { rows?: unknown }
    return Array.isArray(parsed.rows) ? (parsed.rows as Array<Record<string, unknown>>) : []
  } catch {
    return []
  }
}

async function handleChatCompletions(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization") ?? ""
  const suppliedKey = auth.replace(/^Bearer\s+/i, "")

  if (OPENAI_API_KEY) {
    const body = await req.text()
    return fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body,
    })
  }

  if (suppliedKey !== DEMO_LLM_API_KEY) {
    return Response.json({ error: "invalid_api_key" }, { status: 401 })
  }

  const body = (await req.json()) as {
    model?: string
    messages?: Array<{ role?: string; content?: string }>
  }
  const userMessage =
    body.messages
      ?.filter((m) => m.role === "user")
      .map((m) => m.content ?? "")
      .join("\n") ?? ""

  const products = generateCopy(extractRows(userMessage))

  return Response.json({
    model: body.model ?? "demo-llm",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: JSON.stringify({ products }) },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// shopG41 client — API key stays server-side, browsers never see it
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.SHOPG41_BASE_URL || "http://demo.localhost:3001"
const API_KEY = process.env.SHOPG41_API_KEY
const TENANT = process.env.SHOPG41_TENANT

function makeClient(): ShopG41Client {
  if (!API_KEY) throw new Error("Set SHOPG41_API_KEY=sk_... (see README)")
  const wrapFetch: typeof fetch | undefined = TENANT
    ? ((input: any, init?: any) =>
        fetch(input, {
          ...init,
          headers: { ...((init?.headers as Record<string, string>) ?? {}), "X-Tenant": TENANT },
        })) as typeof fetch
    : undefined
  return new ShopG41Client({ baseUrl: BASE_URL, apiKey: API_KEY, fetch: wrapFetch })
}

// ─────────────────────────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────────────────────────
Bun.serve({
  routes: {
    "/": index,

    "/v1/chat/completions": {
      POST: handleChatCompletions,
    },

    "/api/products": {
      GET: () => {
        const rows = db
          .query("SELECT id, name, price, image_url FROM products ORDER BY id DESC")
          .all()
        return Response.json(rows)
      },

      POST: async (req) => {
        const { name, price, imageUrl } = (await req.json()) as {
          name?: string
          price?: number
          imageUrl?: string
        }
        if (!name || typeof name !== "string" || !name.trim()) {
          return Response.json({ error: "Name is required" }, { status: 400 })
        }
        if (typeof price !== "number" || price <= 0) {
          return Response.json({ error: "Valid price is required" }, { status: 400 })
        }
        db.run("INSERT INTO products (name, price, image_url) VALUES (?, ?, ?)", [
          name.trim(),
          price,
          imageUrl || `https://placehold.co/400x400?text=${encodeURIComponent(name.trim())}`,
        ])
        return Response.json({ ok: true }, { status: 201 })
      },
    },

    "/api/ai/copy": {
      GET: async () => {
        try {
          const client = makeClient()
          const result = await client.endpoints.call<unknown>("/ai-product-copy")
          return Response.json(result)
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 })
        }
      },
    },
  },

  development: { hmr: true, console: true },
  port: PORT,
})

console.log(`AI Demo running at http://localhost:${PORT}`)
console.log(`SQLite DB: ${DB_PATH}`)
console.log(`Mock LLM: ${OPENAI_API_KEY ? "proxying to real OpenAI" : "POST /v1/chat/completions (deterministic)"}`)
