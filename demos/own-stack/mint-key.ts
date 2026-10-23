/**
 * Dev-only: mint an `admin`-scope API key for the demo store and write it to
 * `demos/own-stack/.env.local` so `bun run wire` can pick it up.
 *
 * In production you would create the key in **Admin → API & Webhooks**
 * (`/admin/developer`) — the full key is shown once, and only a prefix + hash
 * are stored. This script exists because a local demo should not need a browser
 * session, and it writes exactly what the API would: the same `sk_` + 32-hex
 * shape, the same SHA-256 hash, the same scope list.
 *
 *   bun run mint-key
 *   SHOPG41_TENANT_ID=313 bun run mint-key
 */

import { appendFileSync, readFileSync, writeFileSync } from "node:fs"
import { createHash, randomBytes } from "node:crypto"
import { resolve } from "node:path"
import { platformConfig, platformSql, tenantSubdomain, SHOPG41_DIR } from "./platform"

const DEMO_ENV = resolve(import.meta.dir, ".env.local")
const cfg = platformConfig()
const sql = platformSql()

const rows = cfg.tenantId
  ? await sql`select id, name, subdomain, auth_user_id from tenants where id = ${cfg.tenantId}`
  : await sql`select id, name, subdomain, auth_user_id from tenants
             where subdomain = ${tenantSubdomain(cfg.tenantHost)}`

const row = rows[0] as
  | { id: number; name: string; subdomain: string | null; auth_user_id: string }
  | undefined

if (!row) {
  await sql.end()
  const which = cfg.tenantId ? `id ${cfg.tenantId}` : `subdomain "${tenantSubdomain(cfg.tenantHost)}"`
  console.error(`No tenant with ${which}. Seed one first:`)
  console.error("  cd shopG41 && bun run seed-demo")
  process.exit(1)
}

const full = `sk_${randomBytes(16).toString("hex")}`
const prefix = full.slice(0, "sk_".length + 4)
const hash = createHash("sha256").update(full).digest("hex")

await sql`
  insert into api_keys (tenant_id, user_id, name, key_prefix, key_hash, scopes)
  values (${row.id}, ${row.auth_user_id}, 'own-stack-demo', ${prefix}, ${hash},
          ${JSON.stringify(["admin"])}::jsonb)
`
await sql.end()

// Not in shell history, not in git: the root `.gitignore` has `**/.env.*`.
let env = ""
try {
  env = readFileSync(DEMO_ENV, "utf8")
} catch {
  /* first run */
}
const line = `SHOPG41_API_KEY=${full}`
if (/^SHOPG41_API_KEY=/m.test(env)) {
  writeFileSync(DEMO_ENV, env.replace(/^SHOPG41_API_KEY=.*$/m, line))
} else {
  appendFileSync(DEMO_ENV, (env && !env.endsWith("\n") ? "\n" : "") + line + "\n")
}

console.log(`Minted an admin-scope API key for ${row.name} (#${row.id}, ${row.subdomain})`)
console.log(`  ${prefix}…  (the full key is in demos/own-stack/.env.local)`)
console.log(`  platform env: ${SHOPG41_DIR}`)
