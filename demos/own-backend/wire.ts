#!/usr/bin/env bun
/**
 * Wires this demo's SQLite product database into shopG41.
 *
 * Two shapes, because "your own database" means different things depending on
 * where the platform runs:
 *
 *   bun run wire --local
 *     shopG41 opens `products.db` itself. Simple, but the file has to be on the
 *     platform's machine (a self-hosted/local instance).
 *
 *   BACKEND_URL="https://your-tunnel.example" bun run wire
 *     shopG41 calls this app over HTTPS instead. The database stays wherever the
 *     app runs (your laptop) and the platform only stores a URL. This is the
 *     shape for a hosted platform: a `function` step on a `passthrough` data
 *     source, HMAC-signed with FUNCTION_SECRET.
 *
 * Flags
 *   --local    register a `sqlite` data source instead (same machine only)
 *   --undo     remove the data source and endpoint this script created
 */
import { createHmac } from "node:crypto"
import { ShopG41Client } from "../../packages/sdk/src/index"

const BASE_URL = process.env.SHOPG41_BASE_URL || "http://localhost:3001"
const API_KEY = process.env.SHOPG41_API_KEY
const TENANT = process.env.SHOPG41_TENANT
const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/$/, "")
const FUNCTION_SECRET = process.env.FUNCTION_SECRET || "own-backend-demo-secret"

const LOCAL = process.argv.includes("--local")
const UNDO = process.argv.includes("--undo")

/** Absolute by design: the platform resolves a relative path against its own cwd. */
const DB_PATH = `${import.meta.dir}/products.db`

const DS_NAME = LOCAL ? "Own Backend (SQLite)" : "Own Backend (HTTPS)"
const ENDPOINT_PATH = "own-products"

if (!API_KEY) {
  console.error("Set SHOPG41_API_KEY=sk_... (Admin → API & Webhooks, admin scope)")
  process.exit(1)
}
if (!LOCAL && !UNDO && !BACKEND_URL) {
  console.error(
    "Set BACKEND_URL to a URL the platform can reach, e.g.\n" +
      "  BACKEND_URL=https://your-tunnel.example bun run wire\n" +
      "For a platform on this machine, use:  bun run wire --local",
  )
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
const log = (msg: string) => console.log(msg)

function sign(body: string): string {
  return createHmac("sha256", FUNCTION_SECRET).update(body).digest("hex")
}

/** Call the demo's signed endpoint directly. Best-effort: the platform is the
 *  authoritative check, and this machine's DNS may not resolve the tunnel. */
async function probeBackend(): Promise<number | null> {
  const body = JSON.stringify({ prev: null })
  try {
    const res = await fetch(`${BACKEND_URL}/function`, {
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

async function ensureDataSource(): Promise<number> {
  const kind = LOCAL ? "sqlite" : "passthrough"
  const config = LOCAL ? { path: DB_PATH } : { url: `${BACKEND_URL}/function`, secret: FUNCTION_SECRET }

  const { dataSources } = await admin.dataSources.list()
  const existing = dataSources.find((d) => d.name === DS_NAME)

  if (existing) {
    if (existing.kind !== kind) {
      await admin.dataSources.delete(existing.id)
      const { id } = await admin.dataSources.create({ name: DS_NAME, kind, config })
      log(`   replaced ${existing.kind} data source with ${kind} (id=${id})`)
      return id
    }
    await admin.dataSources.update(existing.id, { name: DS_NAME, config })
    log(`   updated "${DS_NAME}" (id=${existing.id})`)
    return existing.id
  }

  const { id } = await admin.dataSources.create({ name: DS_NAME, kind, config })
  log(`   created "${DS_NAME}" (id=${id})`)
  return id
}

function endpointConfig(dataSourceId: number) {
  return {
    steps: LOCAL
      ? [
          {
            type: "query",
            dataSourceId,
            sql: "SELECT id, name, price, image_url FROM products ORDER BY id DESC",
          },
        ]
      : [
          { type: "function", dataSourceId },
          {
            type: "transform",
            path: "$.rows",
            fields: ["id", "name", "price", "image_url"],
          },
        ],
  }
}

async function ensureEndpoint(dataSourceId: number): Promise<number> {
  const config = endpointConfig(dataSourceId)
  const { endpoints } = await admin.endpoints.list()
  const existing = endpoints.find((e) => e.method === "GET" && e.path === ENDPOINT_PATH)

  if (existing) {
    await admin.endpoints.update(existing.id, { handlerConfig: config })
    log(`   updated endpoint /api/e/${ENDPOINT_PATH} (id=${existing.id})`)
    return existing.id
  }

  const { id } = await admin.endpoints.create({
    name: "Own Products",
    path: ENDPOINT_PATH,
    method: "GET",
    handlerKind: "pipeline",
    status: "published",
    handlerConfig: config,
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
  for (const d of dataSources.filter((d) => d.name.startsWith("Own Backend ("))) {
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
  if (LOCAL) {
    log(`Mode: local — shopG41 opens ${DB_PATH} itself`)
  } else {
    log(`Mode: remote — shopG41 calls ${BACKEND_URL}/function`)
    log("1. Probing the backend…")
    const rows = await probeBackend()
    if (rows === null) {
      log("   ! not reachable from this machine (DNS/blocked); the platform's test below decides")
    } else {
      log(`   ✓ reachable, ${rows} rows in SQLite`)
    }
  }

  log(`${LOCAL ? "1" : "2"}. Registering the data source…`)
  const dataSourceId = await ensureDataSource()

  log("   Testing it from the platform…")
  const test = await admin.dataSources.test(dataSourceId)
  log(`   ${test.ok ? "✓ test OK" : `✗ test FAILED — ${test.error}`}`)
  if (!test.ok) process.exit(1)

  log(`${LOCAL ? "2" : "3"}. Publishing the endpoint…`)
  await ensureEndpoint(dataSourceId)

  log(`${LOCAL ? "3" : "4"}. Reading through shopG41…`)
  const result = (await client.endpoints.call<unknown>("/own-products")) as {
    rows?: Array<Record<string, unknown>>
    error?: string
  }
  if (result?.error) {
    console.error(`   ✗ ${result.error}`)
    process.exit(1)
  }
  const rows = Array.isArray(result) ? (result as Array<Record<string, unknown>>) : (result.rows ?? [])
  log(`   ${rows.length} products, first: ${JSON.stringify(rows[0] ?? null)}`)

  log("\nDone! Queryable at:")
  log(`  ${BASE_URL}/api/e/${ENDPOINT_PATH}`)
  log("Remove the wiring with:  bun run wire --undo")
}

main().catch((err) => {
  console.error("Error:", err.message)
  process.exit(1)
})
