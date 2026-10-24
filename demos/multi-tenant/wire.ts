#!/usr/bin/env bun
// Creates two tenants on one shopG41 instance via the real signup flow
// (each signup auto-provisions a tenant), mints an admin API key per tenant,
// and seeds each with distinct products, CMS content and a custom endpoint.
// Writes keys.json for the demo server (index.ts) to use.
import { deflateSync } from "node:zlib"
import { ShopG41Client } from "../../packages/sdk/src/index"

const PLATFORM_BASE = process.env.SHOPG41_BASE_URL || "http://localhost:3001"
const PASSWORD = process.env.DEMO_PASSWORD || "password123"
const RUN_ID = Date.now().toString(36)
const OUT_FILE = `${import.meta.dir}/keys.json`

/** The store's own host, derived from the platform's (works for *.localhost and prod). */
const PLATFORM_ORIGIN = new URL(PLATFORM_BASE)
const tenantUrl = (subdomain: string) =>
  `${PLATFORM_ORIGIN.protocol}//${subdomain}.${PLATFORM_ORIGIN.host}`

interface TenantConfig {
  subdomain: string
  name: string
  baseUrl: string
  apiKey: string
}

// ── helpers ─────────────────────────────────────────────────────────────────
function cookiesFrom(res: Response): string {
  const getSetCookie = (res.headers as { getSetCookie?: () => string[] }).getSetCookie
  let all: string[]
  if (typeof getSetCookie === "function") {
    all = getSetCookie.call(res.headers)
  } else {
    const single = res.headers.get("set-cookie")
    all = single ? [single] : []
  }
  return all.map((c) => c.split(";")[0]).join("; ")
}

async function signUpAndMintKey(
  subdomain: string,
  displayName: string,
): Promise<{ subdomain: string; name: string; apiKey: string }> {
  const email = `${subdomain}@demo.local`
  console.log(`\n1. Signing up ${displayName} (${email}) → provisions tenant "${subdomain}"…`)
  const signup = await fetch(`${PLATFORM_BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: PLATFORM_BASE },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      name: displayName,
      storeName: displayName,
      subdomain,
    }),
  })
  const signupBody = await signup.text()
  if (!signup.ok) {
    throw new Error(`Signup failed (${signup.status}): ${signupBody.slice(0, 300)}`)
  }
  const cookies = cookiesFrom(signup)

  // Provisioning may adjust the requested subdomain (and name) for uniqueness,
  // so ask the session what it actually created rather than assuming.
  const tenantRes = await fetch(`${PLATFORM_BASE}/api/users/me/tenant`, { headers: { Cookie: cookies } })
  const provisioned = (tenantRes.ok
    ? ((await tenantRes.json()) as { id: number; name: string; subdomain: string } | null)
    : null) ?? null
  const actualSubdomain = provisioned?.subdomain ?? subdomain
  const tenantOverride = provisioned ? String(provisioned.id) : subdomain
  if (provisioned && actualSubdomain !== subdomain) {
    console.log(`   platform provisioned "${actualSubdomain}" (requested "${subdomain}" was taken)`)
  }

  // API keys are per-tenant, and the session cookie is scoped to the host it was
  // issued on — so mint on the platform host and select the tenant with
  // `X-Tenant` rather than jumping to the store's subdomain (the cookie would
  // not be sent there, and every subdomain would need its own session).
  console.log(`   Minting admin API key for "${actualSubdomain}"…`)
  const keyRes = await fetch(`${PLATFORM_BASE}/api/admin/api-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies, "X-Tenant": tenantOverride },
    body: JSON.stringify({ name: "multi-tenant-demo", scopes: ["admin"] }),
  })
  const keyBody = (await keyRes.json()) as { key?: string; error?: string }
  if (!keyRes.ok || !keyBody.key) {
    throw new Error(`API key mint failed (${keyRes.status}): ${JSON.stringify(keyBody).slice(0, 300)}`)
  }
  console.log(`   Got API key ${keyBody.key.slice(0, 12)}…`)
  return { subdomain: actualSubdomain, name: provisioned?.name ?? displayName, apiKey: keyBody.key }
}

// ── tiny PNG generator for product images ────────────────────────────────────
function crc(data: Uint8Array): number {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc(body))
  return Buffer.concat([len, body, crcBuf])
}
function solidPng(w: number, h: number, [r, g, b]: [number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const stride = 1 + w * 3
  const raw = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const row = y * stride
    for (let x = 0; x < w; x++) {
      raw[row + 1 + x * 3] = r
      raw[row + 2 + x * 3] = g
      raw[row + 3 + x * 3] = b
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ])
}

function pngFile(buffer: Uint8Array, filename: string): File {
  const ab = new ArrayBuffer(buffer.byteLength)
  new Uint8Array(ab).set(buffer)
  return new File([ab], filename, { type: "image/png" })
}

async function seedTenant(t: TenantConfig, product: { name: string; price: number; color: [number, number, number] }) {
  const client = new ShopG41Client({ baseUrl: t.baseUrl, apiKey: t.apiKey })
  const admin = client.admin!

  const { products } = await admin.products.list()
  if (!products.some((p) => p.name === product.name)) {
    const file = pngFile(solidPng(512, 512, product.color), `${product.name}.png`)
    await admin.products.create({
      image: file,
      imageName: file.name,
      imageType: "product-main",
      name: product.name,
      price: product.price,
      shopBy: "Multi-Tenant Demo",
      inUse: true,
    })
    console.log(`   Product "${product.name}" (£${product.price})`)
  } else {
    console.log(`   Reusing product "${product.name}"`)
  }

  const { collections } = await admin.cms.collections.list()
  let collectionId = collections.find((c) => c.slug === "announcements")?.id
  if (!collectionId) {
    const res = await admin.cms.collections.create({
      name: "Announcements",
      slug: "announcements",
      status: "published",
      fields: [{ key: "title", label: "Title", type: "text", required: true }],
    })
    collectionId = res.id
    await admin.cms.entries.create(collectionId, {
      data: { title: `Welcome to ${t.name}` },
      status: "published",
    })
    console.log(`   CMS collection + entry`)
  } else {
    console.log(`   Reusing CMS collection`)
  }

  const { endpoints } = await admin.endpoints.list()
  if (!endpoints.some((e) => e.path === "announcements")) {
    await admin.endpoints.create({
      name: "Announcements",
      path: "announcements",
      method: "GET",
      handlerKind: "collection",
      status: "published",
      handlerConfig: { collectionId },
    })
    console.log(`   Endpoint GET /api/e/announcements`)
  }
}

async function main() {
  // Run-scoped subdomains: subdomains are unique and a tenant delete has no
  // cascade, so fixed names would make the second run fail. One run = one pair.
  const alphaSub = `alpha-${RUN_ID}`
  const betaSub = `beta-${RUN_ID}`
  const alpha = { subdomain: alphaSub, name: "Alpha Store", baseUrl: tenantUrl(alphaSub), apiKey: "" }
  const beta = { subdomain: betaSub, name: "Beta Store", baseUrl: tenantUrl(betaSub), apiKey: "" }

  for (const [tenant, displayName] of [
    [alpha, "Alpha Store"],
    [beta, "Beta Store"],
  ] as const) {
    const created = await signUpAndMintKey(tenant.subdomain, displayName)
    Object.assign(tenant, {
      subdomain: created.subdomain,
      name: created.name,
      baseUrl: tenantUrl(created.subdomain),
      apiKey: created.apiKey,
    })
  }

  const tenants: TenantConfig[] = [alpha, beta]
  await Bun.write(OUT_FILE, JSON.stringify({ tenants }, null, 2))
  console.log(`\nWrote ${OUT_FILE}`)

  console.log("\n2. Seeding each tenant with its own data…")
  await seedTenant(alpha, { name: "Alpha Teapot", price: 21.0, color: [150, 90, 210] })
  await seedTenant(beta, { name: "Beta Beaker", price: 9.5, color: [80, 180, 120] })

  console.log(`
Done! Two isolated tenants on one shopG41 instance:
  Alpha → ${alpha.baseUrl}  (products, CMS, API key)
  Beta  → ${beta.baseUrl}   (products, CMS, API key)

Open http://localhost:3008 to compare both storefronts side by side,
add products to each, and run the cross-tenant access check.
`)
}

main().catch((err) => {
  console.error("Error:", err.message)
  process.exit(1)
})
