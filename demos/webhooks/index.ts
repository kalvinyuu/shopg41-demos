import { createHmac, timingSafeEqual } from "node:crypto"
import index from "./index.html"
import { ShopG41Client } from "../../packages/sdk/src/index"

const PORT = Number(process.env.PORT || 3004)
const RECEIVER_URL = process.env.RECEIVER_URL || `http://localhost:${PORT}/webhook`
const SHARED_SECRET = process.env.WEBHOOK_SECRET || "demo-webhook-secret"

// ─────────────────────────────────────────────────────────────────────────────
// Received deliveries (in memory — this app is the webhook receiver)
// ─────────────────────────────────────────────────────────────────────────────
interface ReceivedDelivery {
  id: number
  event: string | null
  eventId: string | null
  signature: string | null
  valid: boolean
  timestamp: string | null
  receivedAt: string
  body: string
}

let deliveries: ReceivedDelivery[] = []
let nextId = 1

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex")
}

function verifySignature(body: string, secret: string, received: string | null): boolean {
  if (!received) return false
  const expected = Buffer.from(sign(body, secret), "hex")
  const actual = Buffer.from(received, "hex")
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// ─────────────────────────────────────────────────────────────────────────────
// shopG41 client — API key stays server-side, browsers never see it
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.SHOPG41_BASE_URL || "http://demo.localhost:3001"
const API_KEY = process.env.SHOPG41_API_KEY
const TENANT = process.env.SHOPG41_TENANT
const COLLECTION_SLUG = process.env.COLLECTION_SLUG || "announcements"
const WEBHOOK_NAME = process.env.WEBHOOK_NAME || "Webhook Demo Receiver"

function makeClient(): ShopG41Client {
  if (!API_KEY) throw new Error("Set SHOPG41_API_KEY=sk_... (see README)")
  const wrapFetch: typeof fetch | undefined = TENANT
    ? ((input: any, init?: any) =>
        fetch(input, {
          ...init,
          headers: { ...((init?.headers as Record<string, string>) ?? {}), "X-Tenant": TENANT },
        })) as typeof fetch
    : undefined
  return new ShopG41Client({ baseUrl: BASE_URL, apiKey: API_KEY, fetch: wrapFetch })
}

async function getWebhookId(): Promise<number | null> {
  const client = makeClient()
  const { webhooks } = await client.request<{ webhooks: Array<{ id: number; name: string }> }>(
    "/api/admin/webhooks"
  )
  return webhooks.find((w) => w.name === WEBHOOK_NAME)?.id ?? null
}

async function getCollectionId(): Promise<number | null> {
  const client = makeClient()
  const { collections } = await client.admin!.cms.collections.list()
  return collections.find((c) => c.slug === COLLECTION_SLUG)?.id ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────────────────────────
Bun.serve({
  routes: {
    "/": index,

    "/webhook": {
      POST: async (req) => {
        const body = await req.text()
        const event = req.headers.get("x-shopg41-event")
        const eventId = req.headers.get("x-shopg41-event-id")
        const signature = req.headers.get("x-shopg41-signature")
        const valid = verifySignature(body, SHARED_SECRET, signature)

        deliveries = [
          {
            id: nextId++,
            event,
            eventId,
            signature,
            valid,
            timestamp: (JSON.parse(body || "{}") as { timestamp?: string }).timestamp ?? null,
            receivedAt: new Date().toISOString(),
            body,
          },
          ...deliveries,
        ].slice(0, 50)

        console.log(
          `[webhook] ${event} ${eventId ?? ""} signature=${valid ? "VALID" : "INVALID"}`
        )

        return Response.json({ ok: true, verified: valid })
      },
    },

    "/api/deliveries": {
      GET: () => Response.json({ deliveries }),
    },

    "/api/status": {
      GET: async () => {
        try {
          const [webhookId, collectionId] = await Promise.all([
            getWebhookId(),
            getCollectionId(),
          ])
          return Response.json({
            wired: webhookId !== null && collectionId !== null,
            webhookId,
            collectionId,
            receiverUrl: RECEIVER_URL,
            secret: SHARED_SECRET,
            baseUrl: BASE_URL,
          })
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 })
        }
      },
    },

    "/api/trigger": {
      POST: async () => {
        // Publish a CMS entry → shopG41 emits entry.published → delivers here.
        try {
          const collectionId = await getCollectionId()
          if (collectionId === null) {
            return Response.json({ error: "Run `bun run wire` first to create the CMS collection" }, { status: 400 })
          }
          const title = `Announcement ${Date.now()}`
          const client = makeClient()
          const res = await client.admin!.cms.entries.create(collectionId, {
            data: { title },
            status: "published",
          })
          return Response.json({ ok: true, entryId: res.id, title })
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 })
        }
      },
    },

    "/api/test": {
      POST: async () => {
        try {
          const webhookId = await getWebhookId()
          if (webhookId === null) {
            return Response.json({ error: "Run `bun run wire` first to create the webhook" }, { status: 400 })
          }
          const client = makeClient()
          const res = await client.request<{ ok: boolean; status: number; error?: string }>(
            `/api/admin/webhooks/${webhookId}/test`,
            { method: "POST" }
          )
          return Response.json(res)
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 })
        }
      },
    },

    "/api/replay": {
      POST: async () => {
        try {
          const webhookId = await getWebhookId()
          if (webhookId === null) {
            return Response.json({ error: "Run `bun run wire` first" }, { status: 400 })
          }
          const client = makeClient()
          const res = await client.request<{ ok: boolean; status: number; error?: string }>(
            `/api/admin/webhooks/${webhookId}/replay`,
            { method: "POST" }
          )
          return Response.json(res)
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 })
        }
      },
    },

    "/api/retry": {
      POST: async () => {
        try {
          const client = makeClient()
          const res = await client.request<{ retried: number }>("/api/admin/webhooks/retry", {
            method: "POST",
          })
          return Response.json(res)
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 })
        }
      },
    },

    "/api/log": {
      GET: async () => {
        try {
          const webhookId = await getWebhookId()
          if (webhookId === null) return Response.json({ deliveries: [] })
          const client = makeClient()
          const res = await client.request<{ deliveries: unknown[] }>(
            `/api/admin/webhooks/${webhookId}/deliveries`
          )
          return Response.json(res)
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 })
        }
      },
    },
  },

  development: { hmr: true, console: true },
  port: PORT,
})

console.log(`Webhooks Demo running at http://localhost:${PORT}`)
console.log(`Receiver endpoint: ${RECEIVER_URL}`)
console.log(`Shared secret:     ${SHARED_SECRET}`)
