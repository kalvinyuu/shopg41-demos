#!/usr/bin/env bun
// Seeds a few products into the shopG41 tenant and subscribes a webhook so
// order.placed / order.paid deliveries land on this demo's receiver at /webhook.
import { deflateSync } from "node:zlib"
import { ShopG41Client } from "../../packages/sdk/src/index"

const BASE_URL = process.env.SHOPG41_BASE_URL || "http://demo.localhost:3001"
const API_KEY = process.env.SHOPG41_API_KEY
const TENANT = process.env.SHOPG41_TENANT
const RECEIVER_URL = process.env.RECEIVER_URL || "http://localhost:3007/webhook"
const SECRET = process.env.WEBHOOK_SECRET || "demo-webhook-secret"

if (!API_KEY) {
  console.error("Set SHOPG41_API_KEY=sk_... (admin scope — creates products + webhooks)")
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

// ── Tiny solid-colour PNG generator so the demo has product images ──────────
function crc(data: Buffer): number {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let c = 0xffffffff
  for (const byte of data) c = table[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, "ascii")
  const body = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc(body))
  return Buffer.concat([len, body, crcBuf])
}

function solidPng(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type RGB
  const stride = 1 + width * 3
  const raw = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const row = y * stride
    raw[row] = 0 // filter: none
    for (let x = 0; x < width; x++) {
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

const PRODUCTS = [
  { name: "Coral Mug", price: 12.5, color: [230, 110, 100] as [number, number, number] },
  { name: "Sage Planter", price: 18.0, color: [140, 170, 120] as [number, number, number] },
  { name: "Indigo Throw", price: 29.0, color: [70, 80, 160] as [number, number, number] },
  { name: "Ochre Cushion", price: 24.5, color: [200, 150, 70] as [number, number, number] },
]

function pngFile(buffer: Uint8Array, filename: string): File {
  const ab = new ArrayBuffer(buffer.byteLength)
  new Uint8Array(ab).set(buffer)
  return new File([ab], filename, { type: "image/png" })
}

async function ensureProducts(): Promise<number> {
  const { products } = await admin.products.list()
  let created = 0
  for (const p of PRODUCTS) {
    if (products.some((x) => x.name === p.name)) {
      console.log(`   Reusing product "${p.name}"`)
      continue
    }
    const file = pngFile(solidPng(512, 512, p.color), `${p.name.toLowerCase().replace(/\s+/g, "-")}.png`)
    await admin.products.create({
      image: file,
      imageName: file.name,
      imageType: "product-main",
      name: p.name,
      price: p.price,
      shopBy: "Demo",
      // A product is only on the storefront when it is active.
      inUse: true,
    })
    created++
    console.log(`   Created product "${p.name}" (£${p.price})`)
  }
  return created
}

async function ensureWebhook(): Promise<number> {
  const { webhooks } = await client.request<{
    webhooks: Array<{ id: number; name: string; url: string }>
  }>("/api/admin/webhooks")
  const existing = webhooks.find((w) => w.name === "Headless Store Demo")
  if (existing) {
    console.log(`   Reusing webhook id=${existing.id} → ${existing.url}`)
    return existing.id
  }
  const res = await client.request<{ success: boolean; id: number }>("/api/admin/webhooks", {
    method: "POST",
    body: JSON.stringify({
      name: "Headless Store Demo",
      url: RECEIVER_URL,
      events: ["order.placed", "order.paid"],
      secret: SECRET,
    }),
  })
  console.log(`   Created webhook id=${res.id} → ${RECEIVER_URL}`)
  return res.id
}

async function main() {
  console.log("1. Seeding products…")
  await ensureProducts()

  console.log("2. Subscribing order webhooks…")
  await ensureWebhook()

  console.log(`
Done! Open http://localhost:3007, add items, and check out.
After paying on Stripe (test card 4242 4242 4242 4242), the order appears
under "Orders" and signed order.placed/order.paid deliveries arrive live.

To receive the Stripe completion webhook locally, forward it:
  stripe listen --forward-to localhost:3001/api/stripe/webhook
  # then set the printed whsec_... as STRIPE_TEST_WEBHOOK_SECRET in shopG41/.env.local
  # (test mode reads STRIPE_TEST_WEBHOOK_SECRET first; an empty/stub value is ignored)
`)
}

main().catch((err) => {
  console.error("Error:", err.message)
  process.exit(1)
})
