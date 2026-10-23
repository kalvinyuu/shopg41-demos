#!/usr/bin/env bun
// Creates a CMS collection + a webhook subscription, then fires a real
// entry.published event by publishing an entry. The signed delivery lands on
// this demo's receiver at /webhook.
import { ShopG41Client } from "../../packages/sdk/src/index"

const BASE_URL = process.env.SHOPG41_BASE_URL || "http://demo.localhost:3001"
const API_KEY = process.env.SHOPG41_API_KEY
const TENANT = process.env.SHOPG41_TENANT
const RECEIVER_URL = process.env.RECEIVER_URL || "http://localhost:3004/webhook"
const SECRET = process.env.WEBHOOK_SECRET || "demo-webhook-secret"
const COLLECTION_NAME = process.env.COLLECTION_NAME || "Announcements"
const COLLECTION_SLUG = process.env.COLLECTION_SLUG || "announcements"
const WEBHOOK_NAME = process.env.WEBHOOK_NAME || "Webhook Demo Receiver"

if (!API_KEY) {
  console.error("Set SHOPG41_API_KEY=sk_... (needs admin scope — webhooks are admin-only)")
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

const EVENTS = [
  "order.placed",
  "order.paid",
  "order.status.changed",
  "product.created",
  "product.updated",
  "product.deleted",
  "entry.published",
]

async function ensureCollection(): Promise<number> {
  const { collections } = await admin.cms.collections.list()
  const existing = collections.find((c) => c.slug === COLLECTION_SLUG)
  if (existing) {
    console.log(`   Reusing CMS collection "${COLLECTION_SLUG}" (id=${existing.id})`)
    return existing.id
  }
  const { id } = await admin.cms.collections.create({
    name: COLLECTION_NAME,
    slug: COLLECTION_SLUG,
    status: "published",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      { key: "body", label: "Body", type: "richText", required: false },
    ],
  })
  console.log(`   Created CMS collection "${COLLECTION_SLUG}" (id=${id})`)
  return id
}

async function ensureWebhook(): Promise<number> {
  const { webhooks } = await client.request<{
    webhooks: Array<{ id: number; name: string; url: string; events: string[]; secret: string | null }>
  }>("/api/admin/webhooks")
  const existing = webhooks.find((w) => w.name === WEBHOOK_NAME)
  if (existing) {
    console.log(`   Reusing webhook "${WEBHOOK_NAME}" (id=${existing.id}) → ${existing.url}`)
    return existing.id
  }
  const res = await client.request<{ success: boolean; id: number }>("/api/admin/webhooks", {
    method: "POST",
    body: JSON.stringify({
      name: WEBHOOK_NAME,
      url: RECEIVER_URL,
      events: EVENTS,
      secret: SECRET,
    }),
  })
  console.log(`   Created webhook "${WEBHOOK_NAME}" (id=${res.id}) → ${RECEIVER_URL}`)
  return res.id
}

async function main() {
  console.log("1. Ensuring CMS collection…")
  const collectionId = await ensureCollection()

  console.log("2. Ensuring webhook subscription…")
  const webhookId = await ensureWebhook()

  console.log("3. Publishing an entry to fire a real entry.published event…")
  const entry = await admin.cms.entries.create(collectionId, {
    data: { title: `Welcome to ${new Date().toLocaleString()}` },
    status: "published",
  })
  console.log(`   Entry published (id=${entry.id}) — delivery is on its way to ${RECEIVER_URL}`)

  console.log("4. Checking shopG41's delivery log…")
  const { deliveries } = await client.request<{
    deliveries: Array<{ id: number; event: string; status: string; responseCode: number | null }>
  }>(`/api/admin/webhooks/${webhookId}/deliveries`)
  for (const d of deliveries.slice(0, 5)) {
    console.log(`   #${d.id} ${d.event} → ${d.status} (HTTP ${d.responseCode ?? "-"})`)
  }

  console.log("\nDone! Watch the live feed at http://localhost:3004")
}

main().catch((err) => {
  console.error("Error:", err.message)
  process.exit(1)
})
