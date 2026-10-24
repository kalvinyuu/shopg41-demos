import { readFileSync } from "node:fs"
import index from "./index.html"
import { ShopG41Client } from "../../packages/sdk/src/index"

const PORT = Number(process.env.PORT || 3008)
const KEYS_FILE = `${import.meta.dir}/keys.json`

interface TenantConfig {
  subdomain: string
  name: string
  baseUrl: string
  apiKey: string
}

let tenants: TenantConfig[] = []

function loadKeys(): TenantConfig[] {
  try {
    const data = JSON.parse(readFileSync(KEYS_FILE, "utf8")) as {
      tenants?: TenantConfig[]
    }
    tenants = data.tenants ?? []
  } catch {
    tenants = []
  }
  return tenants
}

function makeClient(t: TenantConfig): ShopG41Client {
  return new ShopG41Client({ baseUrl: t.baseUrl, apiKey: t.apiKey })
}

async function listProducts(t: TenantConfig) {
  const { products } = await makeClient(t).products.list()
  return products
}

async function createProduct(t: TenantConfig, name: string, price: number) {
  const fd = new FormData()
  const blob = new Blob([Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0))], {
    type: "image/png",
  })
  const file = new File([blob], `${name.toLowerCase().replace(/\s+/g, "-")}.png`, {
    type: "image/png",
  })
  fd.set("image", file, file.name)
  fd.set("imageName", file.name)
  fd.set("imageType", "product-main")
  fd.set("name", name)
  fd.set("price", String(price))
  fd.set("shopBy", "Multi-Tenant Demo")
  return makeClient(t).requestMultipart("/api/admin/items", fd)
}

const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

Bun.serve({
  routes: {
    "/": index,

    "/api/tenants": {
      GET: async () => {
        loadKeys()
        const summary = await Promise.all(
          tenants.map(async (t) => {
            try {
              const products = await listProducts(t)
              return { subdomain: t.subdomain, name: t.name, baseUrl: t.baseUrl, productCount: products.length }
            } catch {
              return { subdomain: t.subdomain, name: t.name, baseUrl: t.baseUrl, productCount: -1 }
            }
          })
        )
        return Response.json({ tenants: summary })
      },
    },

    "/api/:tenant/products": {
      GET: async (req) => {
        loadKeys()
        const t = tenants.find((x) => x.subdomain === req.params.tenant)
        if (!t) return Response.json({ error: "Tenant not found. Run `bun run wire`." }, { status: 404 })
        try {
          const products = await listProducts(t)
          return Response.json({ products })
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 })
        }
      },

      POST: async (req) => {
        loadKeys()
        const t = tenants.find((x) => x.subdomain === req.params.tenant)
        if (!t) return Response.json({ error: "Tenant not found" }, { status: 404 })
        const { name, price } = (await req.json()) as { name?: string; price?: number }
        if (!name || !price) return Response.json({ error: "name and price required" }, { status: 400 })
        try {
          await createProduct(t, name, price)
          return Response.json({ ok: true })
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 })
        }
      },
    },

    "/api/cross-check": {
      POST: async () => {
        loadKeys()
        if (tenants.length < 2) {
          return Response.json({ error: "Run `bun run wire` first" }, { status: 400 })
        }
        const [alpha, beta] = tenants
        const result: Array<Record<string, unknown>> = []

        async function probe(label: string, baseUrl: string, apiKey: string) {
          try {
            // Must be an ADMIN route: the storefront's /api/products is public
            // and answers by host for anyone, so a 200 there proves nothing
            // about key scoping. The tenant boundary lives on /api/admin/*.
            const res = await fetch(`${baseUrl}/api/admin/products`, {
              headers: { Authorization: `Bearer ${apiKey}` },
            })
            result.push({
              check: label,
              status: res.status,
              isolated: res.status === 401 || res.status === 403 || res.status === 404,
              detail:
                res.status === 200
                  ? "data leaked — this key read another store's admin data"
                  : `blocked (${res.status})`,
            })
          } catch {
            result.push({
              check: label,
              status: 0,
              isolated: true,
              detail: "unreachable (is shopG41 running?)",
            })
          }
        }

        await probe("alpha's API key on beta's admin API", beta!.baseUrl, alpha!.apiKey)
        await probe("beta's API key on alpha's admin API", alpha!.baseUrl, beta!.apiKey)

        return Response.json({ results: result })
      },
    },
  },

  development: { hmr: true, console: true },
  port: PORT,
})

loadKeys()
console.log(`Multi-Tenant Demo running at http://localhost:${PORT}`)
console.log(`Configured tenants: ${tenants.map((t) => `${t.subdomain} (${t.baseUrl})`).join(", ") || "none — run \`bun run wire\`"}`)
