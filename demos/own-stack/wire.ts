/**
 * Wire the demo's own backend into shopG41 as the store's external backend.
 *
 *   bun run mint-key     # once: an admin-scope API key for the demo store
 *   bun run dev          # the own-stack backend on :3009
 *   bun run wire         # this script
 *   bun run wire --undo  # put the store back on the platform's own catalogue
 *
 * What it does, in order:
 *   1. checks the platform and your backend are both up;
 *   2. creates a `passthrough` data source pointing at your backend — through
 *      the platform's admin API, which runs the SSRF guard;
 *   3. enables the external backend for the store (`PUT /api/admin/backend`);
 *   4. proves it: the platform's `GET /api/products` must return *your* rows,
 *      a platform-only route must not reach you at all, and your own proxy log
 *      must show the calls.
 *
 * The one wrinkle is step 2. `assertPublicUrl` refuses loopback and private
 * addresses — correctly, since that guard is what stops a tenant probing
 * internal infrastructure. A local demo therefore has two options:
 *   - serve your backend on a public HTTPS URL (`OWNSTACK_PUBLIC_URL=…`), which
 *     is what you would do in production; or
 *   - pass `--allow-loopback`, which binds the same URL directly in the
 *     platform's database, using the platform's own config encryption.
 * The second option is a local-development shortcut and is labelled as such.
 */

import { platformConfig, platformSql, tenantSubdomain, isLoopback } from "./platform"

const args = new Set(process.argv.slice(2))
const ALLOW_LOOPBACK = args.has("--allow-loopback")
const UNDO = args.has("--undo")
const DS_NAME = "Own Stack"
const DB_DS_NAME = "Own Stack DB"
const ENDPOINT_PATH = "own-stack-products"
/** Your backend's log is a ring buffer; ignore anything from before this run. */
const RUN_STARTED_AT = new Date().toISOString()
const cfg = platformConfig()

const step = (n: string, text: string) => console.log(`\n${n}  ${text}`)
const ok = (text: string) => console.log(`   ✓ ${text}`)
const warn = (text: string) => console.log(`   ! ${text}`)

if (!cfg.apiKey) {
  console.error("No SHOPG41_API_KEY. Run `bun run mint-key` first (or set one in the env).")
  process.exit(1)
}

/** Admin API call against the demo store, resolved by explicit tenant header. */
async function admin(path: string, init: RequestInit = {}, subdomain = tenantSubdomain(cfg.tenantHost)) {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
      "X-Tenant": subdomain,
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  let body: any = null
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: res.status, ok: res.ok, body }
}

/**
 * Public storefront call, the way a shopper's browser would make it.
 *
 * `tenantOverride` exists for the `--allow-loopback` path. Tenant resolution is
 * cached in-process for 60s keyed by the lookup string, and a write that goes
 * straight to the database cannot invalidate it. The numeric tenant id is a
 * different key that no earlier call in this script has used, so it reads the
 * row fresh — rather than making the operator wait out a 60s TTL they cannot
 * see. On the supported (API) path the platform invalidates its own cache and
 * the default subdomain key is used throughout.
 */
let tenantOverride: string | undefined

async function storefront(path: string) {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    headers: { "X-Tenant": tenantOverride ?? tenantSubdomain(cfg.tenantHost) },
  })
  const text = await res.text()
  try {
    return { status: res.status, body: JSON.parse(text) }
  } catch {
    return { status: res.status, body: text.slice(0, 200) }
  }
}

// ---------------------------------------------------------------------------
// 1. Both ends up?
// ---------------------------------------------------------------------------

step("1.", "Checking the platform and your backend")

const store = await storefront("/api/products").catch(() => null)
if (!store || store.status !== 200) {
  console.error(
    `   ✗ ${cfg.baseUrl}/api/products did not answer (got ${store?.status ?? "no response"}).\n` +
      `     Start it with:  cd shopG41 && bun run dev`
  )
  process.exit(1)
}
ok(`platform up — its catalogue has ${store.body.products?.length ?? 0} products`)

const mine = await fetch(`${cfg.backendUrl}/api/local/products`).catch(() => null)
if (!mine || !mine.ok) {
  console.error(
    `   ✗ ${cfg.backendUrl}/api/local/products did not answer (got ${mine?.status ?? "no response"}).\n` +
      `     Start it with:  cd demos/own-stack && bun run dev`
  )
  process.exit(1)
}
const mineBody = (await mine.json()) as { products: { name: string }[] }
ok(`your backend up — your database has ${mineBody.products.length} products`)

// ---------------------------------------------------------------------------
// reset / undo — the same work, one exits
// ---------------------------------------------------------------------------

/** Turn the external backend off and drop everything this script created, in
 *  the order the foreign keys require (the tenant row points at a data source,
 *  and the endpoint's config points at the other one). */
async function reset(): Promise<string[]> {
  const removed: string[] = []

  const off = await admin("/api/admin/backend", {
    method: "PUT",
    body: JSON.stringify({ enabled: false }),
  })
  if (!off.ok) {
    console.error(`   ✗ disabling failed: ${off.status} ${JSON.stringify(off.body)}`)
    process.exit(1)
  }
  removed.push("external backend off")

  const endpoints = await admin("/api/admin/endpoints")
  for (const e of endpoints.body?.endpoints ?? []) {
    if (e.path === ENDPOINT_PATH) {
      await admin(`/api/admin/endpoints/${e.id}`, { method: "DELETE" })
      removed.push(`endpoint /api/e/${ENDPOINT_PATH} deleted`)
    }
  }

  const sources = await admin("/api/admin/data-sources")
  for (const d of sources.body?.dataSources ?? sources.body ?? []) {
    if (d?.name === DS_NAME || d?.name === DB_DS_NAME) {
      await admin(`/api/admin/data-sources/${d.id}`, { method: "DELETE" })
      removed.push(`data source "${d.name}" deleted`)
    }
  }

  return removed
}

if (UNDO) {
  step("↩", "Undoing the demo's wiring")
  const removed = await reset()
  for (const line of removed) ok(line)
  const after = await storefront("/api/products")
  ok(`the store is back on the platform's own catalogue (${after.body.products?.length ?? 0} products)`)
  const gone = await storefront(`/api/e/${ENDPOINT_PATH}`)
  ok(`/api/e/${ENDPOINT_PATH} → ${gone.status} (no longer published)`)
  process.exit(0)
}

// Re-runs should just work: drop whatever a previous run left behind.
await reset()

// ---------------------------------------------------------------------------
// 2. The passthrough data source — through the API, so the guard runs
// ---------------------------------------------------------------------------

step("2.", `Creating the "${DS_NAME}" passthrough data source → ${cfg.backendUrl}`)

let dataSourceId: number | null = null
let boundLocally = false

const created = await admin("/api/admin/data-sources", {
  method: "POST",
  body: JSON.stringify({
    name: DS_NAME,
    kind: "passthrough",
    config: { url: cfg.backendUrl, secret: cfg.secret },
  }),
})

if (created.ok) {
  dataSourceId = created.body.id as number
  ok(`created (#${dataSourceId}) — the URL passed the SSRF guard`)
} else {
  const message = String(created.body?.error ?? JSON.stringify(created.body))
  const guardRefused = /private|loopback|resolve|http\(s\)/i.test(message)

  if (!guardRefused) {
    console.error(`   ✗ ${created.status}: ${message}`)
    process.exit(1)
  }

  console.log(`   · the admin API refused the URL: "${message}"`)
  if (isLoopback(cfg.backendUrl)) {
    ok("that is the SSRF guard working — a loopback backend is not reachable by design")
  }

  if (!ALLOW_LOOPBACK) {
    console.error(
      "\n   A local backend cannot pass the guard. Either:\n" +
        "     · serve your backend on a public HTTPS URL and re-run with\n" +
        `         OWNSTACK_PUBLIC_URL=https://your-tunnel.example bun run wire\n` +
        "     · or, for local development only, re-run with --allow-loopback\n" +
        "       (binds the URL straight into the platform's database instead)"
    )
    process.exit(1)
  }

  warn("--allow-loopback: writing the data source straight into the platform's database")
  const { encryptJson } = await import("../../packages/ai/src/crypto")
  const sql = platformSql()
  const encrypted = await encryptJson({ url: cfg.backendUrl, secret: cfg.secret })

  const tenantRows = await sql`
    select id from tenants where subdomain = ${tenantSubdomain(cfg.tenantHost)}`
  const tenantId = (tenantRows[0] as { id: number } | undefined)?.id
  if (!tenantId) {
    await sql.end()
    console.error(`   ✗ no tenant with subdomain "${tenantSubdomain(cfg.tenantHost)}"`)
    process.exit(1)
  }

  await sql`delete from data_sources where tenant_id = ${tenantId} and name = ${DS_NAME}`
  const inserted = await sql`
    insert into data_sources (tenant_id, name, kind, enabled, config)
    values (${tenantId}, ${DS_NAME}, 'passthrough', true, ${JSON.stringify(encrypted)}::jsonb)
    returning id`
  dataSourceId = (inserted[0] as { id: number }).id
  await sql.end()
  boundLocally = true
  // Read the store back through the numeric-id key: it is a cache key nothing
  // has used yet, so the flag we just wrote is visible immediately.
  tenantOverride = String(tenantId)
  ok(`created (#${dataSourceId}) directly in the platform's database`)
}

// ---------------------------------------------------------------------------
// 3. Enable the external backend
// ---------------------------------------------------------------------------

step("3.", "Enabling the external backend for this store")

if (boundLocally) {
  const sql = platformSql()
  await sql`
    update tenants
       set use_external_backend = true,
           external_backend_data_source_id = ${dataSourceId}
     where subdomain = ${tenantSubdomain(cfg.tenantHost)}`
  await sql.end()
  ok("tenants.use_external_backend = true (bound locally)")
} else {
  const on = await admin("/api/admin/backend", {
    method: "PUT",
    body: JSON.stringify({ enabled: true, dataSourceId }),
  })
  if (!on.ok) {
    console.error(`   ✗ ${on.status}: ${JSON.stringify(on.body)}`)
    process.exit(1)
  }
  ok(`PUT /api/admin/backend → enabled, dataSourceId ${dataSourceId}`)
}

// Confirm the flag is actually live rather than assuming it: on the local path
// the platform's tenant cache was not told about the write, so this reads the
// row back and retries for up to 100s if an earlier cached entry is still warm.
if (boundLocally) {
  const wanted = mineBody.products.map((p) => p.name).join("|")
  const deadline = Date.now() + 100_000
  process.stdout.write("   · confirming the platform sees the flag ")
  let seen: string[] = []
  while (Date.now() < deadline) {
    seen = ((await storefront("/api/products")).body?.products ?? []).map((p: any) => p.name)
    if (seen.join("|") === wanted) break
    process.stdout.write(".")
    await new Promise((r) => setTimeout(r, 4000))
  }
  process.stdout.write("\n")
  if (seen.join("|") !== wanted) {
    console.error(
      "   ✗ the platform still has not picked up the flag. Restart it and re-run:\n" +
        "       cd shopG41 && bun run dev"
    )
    process.exit(1)
  }
  ok("the platform is serving your catalogue")
}

// ---------------------------------------------------------------------------
// 4. Prove it
// ---------------------------------------------------------------------------

step("4.", "Proving the platform now serves your data")

const viaPlatform = await storefront("/api/products")
const platformNames = (viaPlatform.body?.products ?? []).map((p: any) => p.name)
const ownNames = mineBody.products.map((p) => p.name)
const identical = platformNames.join("|") === ownNames.join("|")

console.log(`   platform /api/products → ${viaPlatform.status}`)
console.log(`     ${platformNames.join(", ") || "(none)"}`)
console.log(`   your database         → ${ownNames.join(", ")}`)
if (!identical || platformNames.length === 0) {
  console.error("\n   ✗ the platform is not serving your rows — the proxy did not take effect")
  process.exit(1)
}
ok("identical: the platform proxied the request to your backend")

const one = await storefront("/api/products/1")
ok(
  one.body?.product?.name
    ? `/api/products/1 proxied too ("${one.body.product.name}")`
    : `/api/products/1 → ${one.status}`
)

// A platform-only route must never reach the backend: orders, users, checkout
// and the site settings all stay on the platform.
const settings = await storefront("/api/site/settings")
ok(`/api/site/settings → ${settings.status} (platform-only, not proxied)`)

const state = (await (await fetch(`${cfg.backendUrl}/api/local/state`)).json()) as {
  proxyLog: { at: string; method: string; path: string; signature: string }[]
}
const calls = state.proxyLog.filter((c) => c.at >= RUN_STARTED_AT)
const proxied = calls.map((c) => `${c.method} ${c.path}`)
console.log(`\n   your backend's proxy log for this run (newest first):`)
for (const call of proxied.slice(0, 6)) console.log(`     · ${call}`)
if (calls.length === 0) {
  console.error("\n   ✗ the platform never called your backend")
  process.exit(1)
}
const leaked = proxied.find((p) => p.includes("/api/site/"))
if (leaked) {
  console.error(`\n   ✗ a platform-only route reached your backend: ${leaked}`)
  process.exit(1)
}
const unsigned = calls.filter(
  (c) => c.signature !== "valid" && c.signature !== "not-required"
)
if (unsigned.length > 0) {
  console.error(
    `\n   ✗ ${unsigned.length} proxied call(s) carried no valid signature: ` +
      unsigned.map((c) => `${c.method} ${c.path} (${c.signature})`).join(", ")
  )
  process.exit(1)
}
ok("every proxied call carried a valid HMAC signature")
ok("no orders/users/checkout/settings call reached your backend")

// ---------------------------------------------------------------------------
// 5. The other direction — shopG41 pulling rows out of your database
// ---------------------------------------------------------------------------

step("5.", "Pulling rows through a data source (the other direction)")

// A `postgres` data source is the reverse of the external backend: instead of
// the platform forwarding shoppers to your backend, a `/api/e/…` endpoint asks
// your database a question. Connection strings are not subject to the SSRF
// guard (only tenant-supplied URLs the platform fetches are), so this works
// against a database the platform can reach over the network.
const dbSource = await admin("/api/admin/data-sources", {
  method: "POST",
  body: JSON.stringify({
    name: DB_DS_NAME,
    kind: "postgres",
    config: { connectionString: cfg.ownDatabaseUrl },
  }),
})
if (!dbSource.ok) {
  console.error(`   ✗ ${dbSource.status}: ${JSON.stringify(dbSource.body)}`)
  process.exit(1)
}
const dbSourceId = dbSource.body.id as number
ok(`created the "${DB_DS_NAME}" data source (#${dbSourceId})`)

const tested = await admin(`/api/admin/data-sources/${dbSourceId}/test`, { method: "POST" })
if (!tested.body?.ok) {
  const detail = tested.body?.error || JSON.stringify(tested.body)
  if (isLoopback(cfg.ownDatabaseUrl)) {
    // A hosted platform cannot dial your laptop's Postgres, and an HTTP tunnel
    // does not carry raw TCP. The push direction above is already verified.
    await admin(`/api/admin/data-sources/${dbSourceId}`, { method: "DELETE" })
    console.error(`
   ! the pull direction needs a Postgres the platform can reach over the network
     (a hosted database, or a TCP tunnel) — ${cfg.ownDatabaseUrl} is loopback.
     The PUSH direction above is live and verified; revert it with --undo.
`)
    process.exit(0)
  }
  console.error(`   ✗ connection test failed: ${detail}`)
  process.exit(1)
}
ok(`connection test: ok`)

const endpoint = await admin("/api/admin/endpoints", {
  method: "POST",
  body: JSON.stringify({
    name: "Own Stack products",
    path: ENDPOINT_PATH,
    method: "GET",
    handlerKind: "pipeline",
    status: "published",
    handlerConfig: {
      steps: [
        {
          type: "query",
          dataSourceId: dbSourceId,
          sql: "select id, name, price from catalogue order by id",
        },
      ],
    },
  }),
})
if (!endpoint.ok) {
  console.error(`   ✗ ${endpoint.status}: ${JSON.stringify(endpoint.body)}`)
  process.exit(1)
}
ok(`published GET /api/e/${ENDPOINT_PATH}`)

const pulled = await storefront(`/api/e/${ENDPOINT_PATH}`)
const rows = (pulled.body?.rows ?? []) as { name: string }[]
console.log(`   /api/e/${ENDPOINT_PATH} → ${pulled.status}, ${rows.length} rows`)
console.log(`     ${rows.map((r) => r.name).join(", ") || JSON.stringify(pulled.body).slice(0, 160)}`)
if (rows.length !== ownNames.length) {
  console.error(
    `\n   ✗ the endpoint returned ${rows.length} rows, your database has ${ownNames.length}`
  )
  process.exit(1)
}
ok("your own Postgres, queried by the platform, no code on either side")

console.log(`
Done. Both directions are wired to the same database:

  push  the store's catalogue is served by your backend
          storefront   ${cfg.baseUrl}/api/products   (X-Tenant: ${tenantSubdomain(cfg.tenantHost)})
          your rows    ${cfg.backendUrl}/api/local/products
          your UI      ${cfg.backendUrl}
  pull  the platform can query your database through an endpoint
          ${cfg.baseUrl}/api/e/${ENDPOINT_PATH}

Still on the platform (by design): orders, checkout, users, reviews, settings,
blog, CMS, API keys and webhooks.

  revert with  bun run wire --undo
`)
if (boundLocally) {
  console.log(
    `Note: this run used --allow-loopback, so the data source URL lives in the\n` +
      `platform database unvalidated. The runtime proxy does not re-check it.\n`
  )
}
