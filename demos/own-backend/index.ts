import { Database } from "bun:sqlite"
import index from "./index.html"

const DB_PATH = "products.db"

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

Bun.serve({
  routes: {
    "/": index,

    "/api/products": {
      GET: (_req) => {
        const rows = db.query("SELECT id, name, price, image_url FROM products ORDER BY id DESC").all()
        return Response.json(rows)
      },

      POST: async (req) => {
        const { name, price, imageUrl } = await req.json()
        if (!name || typeof name !== "string" || !name.trim()) {
          return Response.json({ error: "Name is required" }, { status: 400 })
        }
        if (typeof price !== "number" || price <= 0) {
          return Response.json({ error: "Valid price is required" }, { status: 400 })
        }
        db.run(
          "INSERT INTO products (name, price, image_url) VALUES (?, ?, ?)",
          [name.trim(), price, imageUrl || `https://placehold.co/400x400?text=${name}`]
        )
        return Response.json({ ok: true }, { status: 201 })
      },
    },
  },

  development: {
    hmr: true,
    console: true,
  },

  port: 3002,
})

console.log(`Own Backend Demo running at http://localhost:3002`)
console.log(`SQLite DB: ${DB_PATH}`)
