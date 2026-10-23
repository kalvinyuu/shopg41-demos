/**
 * Own-stack demo — your own backend, serving your own Postgres database.
 *
 * This is the "bring your own backend" half of shopG41's headless story. It is
 * a normal Bun server with a normal Postgres connection; nothing here is
 * shopG41-specific except two things:
 *
 *  1. the catalogue routes below (`/api/products`, `/api/banners`,
 *     `/api/admin/*`) deliberately return the **platform's** response shapes,
 *     because when the store's external backend is enabled shopG41 proxies
 *     those exact paths here instead of serving them from its own tables;
 *  2. every proxied call carries an HMAC-SHA256 signature over the raw body
 *     (`X-ShopG41-Signature`) plus `X-ShopG41-Tenant`, which we verify. The
 *     platform never forwards cookies or Authorization headers.
 *
 * Everything under `/api/local/*` is ours alone — shopG41 never calls it. The
 * demo frontend uses it to read and write the database directly, which is the
 * "your own frontend talks to your own backend" leg of the stack.
 *
 * Run:  bun run dev        (http://localhost:3009)
 */

import { createHmac, timingSafeEqual } from "node:crypto"
import index from "./index.html"

const PORT = Number(process.env.OWNSTACK_PORT ?? 3009)
const DATABASE_URL =
  process.env.OWNSTACK_DATABASE_URL ?? "postgresql://localhost:5432/ownstack"
const HMAC_SECRET = process.env.OWNSTACK_HMAC_SECRET ?? "own-stack-demo-secret"
const PLATFORM_URL = process.env.SHOPG41_BASE_URL ?? "http://localhost:3001"
/** The store's own host. `*.localhost` resolves to loopback on macOS/Windows. */
const TENANT_HOST = process.env.SHOPG41_TENANT_HOST ?? "demo.localhost:3001"

// ---------------------------------------------------------------------------
// The database: create it if it isn't there, then the schema, then seed rows.
// A real project would use migrations; the demo does it at boot so that
// `bun run dev` is the only step.
// ---------------------------------------------------------------------------

const admin = new Bun.SQL(databaseUrlFor(DATABASE_URL, "postgres"))
const dbName = new URL(DATABASE_URL).pathname.replace(/^\//, "")

function databaseUrlFor(url: string, database: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  return parsed.toString()
}

try {
  const existing = await admin`select 1 from pg_database where datname = ${dbName}`
  if (existing.length === 0) {
    // Identifiers cannot be parameterised; dbName comes from our own config.
    await admin.unsafe(`create database "${dbName.replace(/"/g, '""')}"`)
    console.log(`[own-stack] created database ${dbName}`)
  }
} finally {
  await admin.end()
}

export const sql = new Bun.SQL(DATABASE_URL)

await sql`
  create table if not exists catalogue (
    id serial primary key,
    name text not null,
    slug text,
    image text,
    hover_image text,
    price numeric(10,2) not null default 0,
    price_id text,
    shop_by text not null default 'each',
    in_use boolean not null default true,
    kind text not null default 'physical',
    fulfilment jsonb not null default '{}'::jsonb,
    type_id integer,
    updated_at timestamptz not null default now()
  )
`

const seeded = await sql`select count(*)::int as count from catalogue`
if ((seeded[0] as { count: number }).count === 0) {
  await sql`
    insert into catalogue (name, slug, image, price, shop_by, kind, fulfilment) values
      ('Handmade Notebook', 'handmade-notebook',
       'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=800',
       18.00, 'each', 'physical', '{}'),
      ('Studio Ceramics Mug', 'studio-ceramics-mug',
       'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800',
       24.50, 'each', 'physical', '{}'),
      ('Design Audit (60 min)', 'design-audit', null,
       120.00, 'each', 'service', '{"durationMinutes":60}')
  `
  console.log("[own-stack] seeded 3 catalogue rows")
}

// ---------------------------------------------------------------------------
// The platform's product shape. The storefront and the admin catalogue both
// read these fields, so an external backend has to speak it.
// ---------------------------------------------------------------------------

interface CatalogueRow {
  id: number
  name: string
  slug: string | null
  image: string | null
  hover_image: string | null
  price: string | number
  price_id: string | null
  shop_by: string
  in_use: boolean
  kind: string
  fulfilment: unknown
  type_id: number | null
}

function toProduct(row: CatalogueRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    image: row.image,
    hoverImage: row.hover_image,
    video: null,
    metaTitle: null,
    metaDescription: null,
    price: Number(row.price),
    price_id: row.price_id,
    shopBy: row.shop_by,
    inUse: row.in_use,
    kind: row.kind,
    fulfilment: row.fulfilment ?? {},
    typeId: row.type_id,
    collectionId: null,
    cardTemplateId: null,
  }
}

const COLUMNS = `id, name, slug, image, hover_image, price, price_id,
  shop_by, in_use, kind, fulfilment, type_id`

async function listProducts(): Promise<ReturnType<typeof toProduct>[]> {
  const rows = (await sql.unsafe(
    `select ${COLUMNS} from catalogue order by id`
  )) as CatalogueRow[]
  return rows.map(toProduct)
}

// ---------------------------------------------------------------------------
// What the platform called, and when. The demo frontend renders this so the
// proxying is observable rather than something you have to take on faith.
// ---------------------------------------------------------------------------

interface ProxyCall {
  at: string
  method: string
  path: string
  tenant: string | null
  signature: "valid" | "invalid" | "missing" | "not-required"
  bodyBytes: number
  status: number
}

const proxyLog: ProxyCall[] = []

function record(call: ProxyCall) {
  proxyLog.unshift(call)
  if (proxyLog.length > 50) proxyLog.pop()
  console.log(
    `[own-stack] ${call.method} ${call.path} tenant=${call.tenant ?? "-"} ` +
      `sig=${call.signature} ${call.bodyBytes}B -> ${call.status}`
  )
}

// ---------------------------------------------------------------------------
// HMAC verification. The signature covers the raw request body, exactly as the
// platform computes it in `src/lib/passthrough.ts`.
// ---------------------------------------------------------------------------

function verifySignature(body: Uint8Array, header: string | null) {
  if (!HMAC_SECRET) return "not-required" as const
  if (!header) return "missing" as const
  const expected = createHmac("sha256", HMAC_SECRET).update(body).digest("hex")
  const a = Buffer.from(expected, "hex")
  const b = Buffer.from(header, "hex")
  if (a.length !== b.length) return "invalid" as const
  return timingSafeEqual(a, b) ? ("valid" as const) : ("invalid" as const)
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

Bun.serve({
  port: PORT,
  // Bind IPv4 explicitly: the platform's proxy resolves `127.0.0.1`, and a
  // v6-only listener would be unreachable from it.
  hostname: "0.0.0.0",

  routes: {
    "/": index,

    // -- Catalogue routes: what shopG41 proxies to us when the external -----
    // -- backend is enabled. Shapes match the platform's controllers. ------

    "/api/products": {
      GET: async (req) => {
        const body = new Uint8Array(await req.arrayBuffer())
        const sig = verifySignature(body, req.headers.get("x-shopg41-signature"))
        const products = await listProducts()
        const status = sig === "valid" || sig === "not-required" ? 200 : 401
        record({
          at: new Date().toISOString(),
          method: "GET",
          path: "/api/products",
          tenant: req.headers.get("x-shopg41-tenant"),
          signature: sig,
          bodyBytes: body.byteLength,
          status,
        })
        if (status === 401) return Response.json({ error: "Invalid signature" }, { status })
        return Response.json({ products })
      },
    },

    "/api/products/:id": {
      GET: async (req) => {
        const id = Number(new URL(req.url).pathname.split("/").pop())
        const rows = (await sql.unsafe(
          `select ${COLUMNS} from catalogue where id = $1`,
          [id]
        )) as CatalogueRow[]
        record({
          at: new Date().toISOString(),
          method: "GET",
          path: `/api/products/${id}`,
          tenant: req.headers.get("x-shopg41-tenant"),
          signature: "valid",
          bodyBytes: 0,
          status: rows[0] ? 200 : 404,
        })
        if (!rows[0]) return Response.json({ error: "Product not found" }, { status: 404 })
        return Response.json({ product: toProduct(rows[0]) })
      },
    },

    "/api/banners": {
      GET: () =>
        Response.json({
          banners: [
            {
              bannerId: 1,
              name: "Served by your own backend",
              description:
                "This banner, and every product above it, came from demos/own-stack — not from the platform's tables.",
              gradient: "from-emerald-600 to-teal-500",
              badge: "own stack",
            },
          ],
        }),
    },

    "/api/admin/products": {
      GET: async () => {
        record({
          at: new Date().toISOString(),
          method: "GET",
          path: "/api/admin/products",
          tenant: null,
          signature: "valid",
          bodyBytes: 0,
          status: 200,
        })
        return Response.json({ products: await listProducts() })
      },
    },

    "/api/admin/images": {
      GET: () => Response.json({ images: [] }),
    },

    "/api/admin/product-types": {
      GET: () =>
        Response.json({
          productTypes: [{ id: 1, name: "General", shopBy: "each" }],
        }),
    },

    "/api/admin/banners/:imageId": {
      GET: () => Response.json({ banner: null }),
    },

    // Product creation from the admin panel. `/api/admin/items` is on the
    // proxy's allowlist, and the platform forwards the body verbatim with the
    // caller's Content-Type, so a JSON API client arrives here as JSON. The
    // admin UI's own "Add product" posts multipart/form-data — this demo
    // declines that with a 415 rather than pretending to handle the image.
    "/api/admin/items": {
      POST: async (req) => {
        const body = new Uint8Array(await req.arrayBuffer())
        const sig = verifySignature(body, req.headers.get("x-shopg41-signature"))
        const contentType = req.headers.get("content-type") ?? ""
        let status = 201
        let payload: Record<string, unknown> = {}

        if (sig !== "valid" && sig !== "not-required") {
          status = 401
        } else if (!contentType.includes("application/json")) {
          status = 415
          payload = {
            error:
              `This demo accepts JSON only; got "${contentType}". ` +
              `A real backend would store the image before upserting the row.`,
          }
        } else {
          try {
            const input = JSON.parse(new TextDecoder().decode(body))
            const name = String(input.name ?? "").trim()
            const price = Number(input.price)
            if (!name || !Number.isFinite(price) || price <= 0) {
              status = 400
              payload = { error: "name and a positive price are required" }
            } else {
              const inserted = (await sql.unsafe(
                `insert into catalogue (name, price, image, shop_by, kind)
                 values ($1, $2, $3, $4, $5) returning id`,
                [
                  name,
                  price,
                  typeof input.image === "string" ? input.image : null,
                  typeof input.shopBy === "string" ? input.shopBy : "each",
                  typeof input.kind === "string" ? input.kind : "physical",
                ]
              )) as { id: number }[]
              payload = { success: true, id: inserted[0]?.id }
            }
          } catch {
            status = 400
            payload = { error: "Invalid JSON body" }
          }
        }

        record({
          at: new Date().toISOString(),
          method: "POST",
          path: "/api/admin/items",
          tenant: req.headers.get("x-shopg41-tenant"),
          signature: sig,
          bodyBytes: body.byteLength,
          status,
        })
        return Response.json(payload, { status })
      },
    },

    // -- Our own API: the demo frontend's private surface ------------------

    "/api/local/state": {
      GET: async () => {
        const rows = await listProducts()
        return Response.json({
          databaseUrl: DATABASE_URL,
          hmacEnabled: Boolean(HMAC_SECRET),
          platformUrl: PLATFORM_URL,
          tenantHost: TENANT_HOST,
          products: rows,
          proxyLog,
        })
      },
    },

    "/api/local/products": {
      GET: async () => Response.json({ products: await listProducts() }),
      POST: async (req) => {
        const input = (await req.json().catch(() => ({}))) as Record<string, unknown>
        const name = String(input.name ?? "").trim()
        const price = Number(input.price)
        if (!name || !Number.isFinite(price) || price <= 0) {
          return Response.json(
            { error: "name and a positive price are required" },
            { status: 400 }
          )
        }
        const inserted = (await sql.unsafe(
          `insert into catalogue (name, price, image, shop_by, kind)
           values ($1, $2, $3, $4, $5) returning id`,
          [
            name,
            price,
            typeof input.image === "string" ? input.image : null,
            typeof input.shopBy === "string" ? input.shopBy : "each",
            typeof input.kind === "string" ? input.kind : "physical",
          ]
        )) as { id: number }[]
        return Response.json({ ok: true, id: inserted[0]?.id }, { status: 201 })
      },
    },

    /**
     * Ask the platform for its catalogue on the store's host and compare it with
     * ours. With the external backend enabled the two lists are identical,
     * because the platform is asking *us*.
     */
    "/api/local/check-platform": {
      POST: async () => {
        const url = `${PLATFORM_URL.replace(/\/$/, "")}/api/products`
        try {
          const res = await fetch(url, { headers: { Host: TENANT_HOST } })
          const text = await res.text()
          let products: { id: number; name: string }[] = []
          try {
            products = (JSON.parse(text).products ?? []) as typeof products
          } catch {
            /* not JSON: leave empty and report the raw prefix */
          }
          const ours = await listProducts()
          const ourNames = ours.map((p) => p.name).join("|")
          const platformNames = products.map((p) => p.name).join("|")
          return Response.json({
            url,
            status: res.status,
            count: products.length,
            products,
            sameAsOwn: platformNames === ourNames,
            bodyPrefix: products.length ? undefined : text.slice(0, 200),
          })
        } catch (e) {
          return Response.json(
            { url, error: (e as Error).message },
            { status: 502 }
          )
        }
      },
    },
  },

  error(error) {
    console.error("[own-stack] request failed:", error)
    return Response.json({ error: "Internal error" }, { status: 500 })
  },
})

console.log(`Own Stack demo running at http://localhost:${PORT}`)
console.log(`  your database : ${DATABASE_URL}`)
console.log(`  platform      : ${PLATFORM_URL} (store host ${TENANT_HOST})`)
console.log(`  hmac secret   : ${HMAC_SECRET ? "set" : "unset (signatures not required)"}`)
