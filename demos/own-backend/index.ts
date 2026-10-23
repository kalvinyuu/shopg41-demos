import { Database } from "bun:sqlite"
import { createHmac, timingSafeEqual } from "node:crypto"
import index from "./index.html"

const DB_PATH = process.env.DB_PATH || "products.db"
const PORT = Number(process.env.PORT || 3002)
/**
 * The signed surface the platform calls. It runs on its own listener so a tunnel
 * can expose "query my SQLite" without also exposing this app's write form.
 */
const FUNCTION_PORT = Number(process.env.FUNCTION_PORT || 3012)
const FUNCTION_SECRET = process.env.FUNCTION_SECRET || "own-backend-demo-secret"

const COLUMNS = "id, name, price, image_url"

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

function sign(body: string, secret = FUNCTION_SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex")
}

/** The platform's contract: HMAC-SHA256 over the raw body, hex encoded. */
function verify(body: string, received: string | null): boolean {
  if (!received) return false
  const expected = Buffer.from(sign(body), "hex")
  let actual: Buffer
  try {
    actual = Buffer.from(received, "hex")
  } catch {
    return false
  }
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function readRows(): Array<Record<string, unknown>> {
  return db
    .query(`SELECT ${COLUMNS} FROM products ORDER BY id DESC`)
    .all() as Array<Record<string, unknown>>
}

// ─────────────────────────────────────────────────────────────────────────────
// The demo app: your own frontend, writing to your own database.
// ─────────────────────────────────────────────────────────────────────────────
Bun.serve({
  routes: {
    "/": index,

    "/api/products": {
      GET: () => Response.json(readRows()),

      POST: async (req) => {
        const { name, price, imageUrl } = await req.json()
        if (!name || typeof name !== "string" || !name.trim()) {
          return Response.json({ error: "Name is required" }, { status: 400 })
        }
        if (typeof price !== "number" || price <= 0) {
          return Response.json({ error: "Valid price is required" }, { status: 400 })
        }
        db.run("INSERT INTO products (name, price, image_url) VALUES (?, ?, ?)", [
          name.trim(),
          price,
          imageUrl || `https://placehold.co/400x400?text=${name}`,
        ])
        return Response.json({ ok: true }, { status: 201 })
      },
    },
  },

  development: {
    hmr: true,
    console: true,
  },

  port: PORT,
})

// ─────────────────────────────────────────────────────────────────────────────
// The signed surface — what shopG41 calls when this database is not on the
// platform's machine. A `function` pipeline step POSTs `{ prev }` here with
// `X-ShopG41-Signature`, and whatever we return becomes the next step's input.
// ─────────────────────────────────────────────────────────────────────────────
Bun.serve({
  port: FUNCTION_PORT,
  routes: {
    "/function": {
      POST: async (req) => {
        const body = await req.text()
        if (!verify(body, req.headers.get("x-shopg41-signature"))) {
          return Response.json({ error: "Invalid signature" }, { status: 401 })
        }
        const rows = readRows()
        return Response.json({ rows, rowCount: rows.length })
      },
    },
  },
})

console.log(`Own Backend Demo running at http://localhost:${PORT}`)
console.log(`SQLite DB: ${DB_PATH}`)
console.log(`Signed function endpoint: http://localhost:${FUNCTION_PORT}/function`)
console.log(`  (expose this one with a tunnel when shopG41 is not on this machine)`)
