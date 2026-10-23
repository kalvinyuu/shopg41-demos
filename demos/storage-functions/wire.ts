#!/usr/bin/env bun
// Registers this app's function server with shopG41 (function + passthrough
// data sources), publishes a pipeline endpoint that calls the function, and
// uploads a sample image to R2 through shopG41's storage.
import { ShopG41Client } from "../../packages/sdk/src/index"

const BASE_URL = process.env.SHOPG41_BASE_URL || "http://demo.localhost:3001"
const API_KEY = process.env.SHOPG41_API_KEY
const TENANT = process.env.SHOPG41_TENANT
const SECRET = process.env.FUNCTION_SECRET || "demo-function-secret"
const PING_URL = process.env.PING_URL || "http://localhost:3005/ping"
const FUNCTION_URL = process.env.FUNCTION_URL || "http://localhost:3005/function"

if (!API_KEY) {
  console.error("Set SHOPG41_API_KEY=sk_... (see README)")
  process.exit(1)
}

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
    console.log(`   Reusing data source "${name}" (id=${existing.id})`)
    return existing.id
  }
  const { id } = await admin.dataSources.create({ name, kind, config })
  console.log(`   Created data source "${name}" (id=${id})`)
  return id
}

async function main() {
  console.log("1. Registering function data source (ping contract)…")
  const fnDsId = await ensureDataSource("Storage-Functions Demo Server", "function", {
    url: PING_URL,
    secret: SECRET,
  })

  console.log("2. Registering passthrough data source (HMAC-signed calls)…")
  const passthroughDsId = await ensureDataSource("Storage-Functions Passthrough", "passthrough", {
    url: FUNCTION_URL,
    secret: SECRET,
  })

  console.log("3. Testing connections…")
  const fnTest = await admin.dataSources.test(fnDsId)
  console.log(`   Function ping: ${fnTest.ok ? "OK" : `FAILED — ${fnTest.error}`}`)

  console.log("4. Publishing pipeline endpoint GET /api/e/order-quote…")
  const steps = [
    {
      type: "function",
      dataSourceId: passthroughDsId,
    },
  ]
  const { endpoints } = await admin.endpoints.list()
  const existing = endpoints.find((e) => e.method === "GET" && e.path === "order-quote")
  if (existing) {
    await admin.endpoints.update(existing.id, { handlerConfig: { steps } })
    console.log(`   Reused endpoint id=${existing.id} and updated its pipeline`)
  } else {
    await admin.endpoints.create({
      name: "Order Quote",
      path: "order-quote",
      method: "GET",
      handlerKind: "pipeline",
      status: "published",
      handlerConfig: { steps },
    })
    console.log("   Endpoint published")
  }

  console.log("5. Calling the function through shopG41…")
  const result = await client.endpoints.call<unknown>("/order-quote")
  console.log("   Result:", JSON.stringify(result, null, 2))

  console.log("6. Uploading an image to R2 storage…")
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
  const bytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0))
  const file = new File([bytes], "demo.png", { type: "image/png" })
  const fd = new FormData()
  fd.set("image", file, "demo.png")
  const { url } = await client.requestMultipart<{ success: boolean; url: string }>(
    "/api/admin/blog/upload",
    fd
  )
  console.log(`   Uploaded: ${url}`)

  console.log("\nDone! Open http://localhost:3005 to try both panels yourself.")
  console.log(`Pipeline URL: ${BASE_URL}/api/e/order-quote`)
}

main().catch((err) => {
  console.error("Error:", err.message)
  process.exit(1)
})
