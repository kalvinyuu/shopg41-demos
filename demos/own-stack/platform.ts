/**
 * Dev-only bridge to the platform.
 *
 * `wire.ts` prefers the platform's own HTTP admin API — that is the supported
 * path, and it works for any backend the SSRF guard accepts (a public HTTPS
 * URL). Local development is the exception: the guard refuses loopback and
 * private addresses, which is exactly right, so this file lets the demo bind a
 * loopback backend *directly in the platform's database* instead, using the
 * platform's own encryption helper so the stored config stays valid.
 *
 * Nothing here is needed in production. Read `--allow-loopback` as "I know this
 * bypasses the guard; the runtime proxy does not re-check the URL, and the
 * well-known consequence is DNS rebinding between configure and fetch time".
 */

import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

const DEMO_DIR = dirname(new URL(import.meta.url).pathname)
export const REPO_ROOT = resolve(DEMO_DIR, "../..")
export const SHOPG41_DIR = resolve(REPO_ROOT, "shopG41")

/**
 * Minimal dotenv: `KEY=value`, `KEY="value"`, `KEY='value'`, `#` comments.
 * Existing `process.env` wins, and later files override earlier ones, matching
 * the platform's own `.env` → `.env.local` precedence.
 */
function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    if (quoted) value = value.slice(1, -1)
    out[key] = value
  }
  return out
}

/** Load the platform's env the way the platform loads it. */
export function loadPlatformEnv(): void {
  // Real environment variables win; between the two files, `.env.local` wins
  // over `.env` (they are loaded in that order, each overwriting the last).
  const fromShell = new Set(Object.keys(process.env))
  for (const file of [".env", ".env.local"]) {
    const values = parseEnvFile(resolve(SHOPG41_DIR, file))
    for (const [key, value] of Object.entries(values)) {
      if (!fromShell.has(key)) process.env[key] = value
    }
  }
}

export function platformConfig() {
  loadPlatformEnv()
  const databaseUrl =
    process.env.PLATFORM_DATABASE_URL ?? process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error(
      "No platform database URL. Set PLATFORM_DATABASE_URL, or run from a " +
        "checkout whose shopG41/.env.local exists."
    )
  }
  return {
    databaseUrl,
    baseUrl: (process.env.SHOPG41_BASE_URL ?? "http://localhost:3001").replace(/\/$/, ""),
    tenantHost: process.env.SHOPG41_TENANT_HOST ?? "demo.localhost:3001",
    apiKey: process.env.SHOPG41_API_KEY ?? "",
    backendUrl: (process.env.OWNSTACK_PUBLIC_URL ?? "http://127.0.0.1:3009").replace(/\/$/, ""),
    ownDatabaseUrl: process.env.OWNSTACK_DATABASE_URL ?? "postgresql://localhost:5432/ownstack",
    secret: process.env.OWNSTACK_HMAC_SECRET ?? "own-stack-demo-secret",
    tenantId: process.env.SHOPG41_TENANT_ID ? Number(process.env.SHOPG41_TENANT_ID) : undefined,
  }
}

export function platformSql(): Bun.SQL {
  const { databaseUrl } = platformConfig()
  return new Bun.SQL(databaseUrl)
}

/** The demo store: by explicit id, else by the subdomain of its host. */
export function tenantSubdomain(tenantHost: string): string {
  return tenantHost.split(".")[0]
}

export function isLoopback(url: string): boolean {
  let host = ""
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, "")
  } catch {
    return false
  }
  if (host === "localhost" || host.endsWith(".localhost")) return true
  if (host === "::1" || host === "0.0.0.0") return true
  if (/^127\./.test(host)) return true
  if (/^10\./.test(host)) return true
  if (/^192\.168\./.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true
  return false
}
