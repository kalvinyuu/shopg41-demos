import { createHmac, timingSafeEqual } from "node:crypto"
import index from "./index.html"
import { ShopG41Client } from "../../packages/sdk/src/index"

const PORT = Number(process.env.PORT || 3007)
const RECEIVER_URL = process.env.RECEIVER_URL || `http://localhost:${PORT}/webhook`
const SHARED_SECRET = process.env.WEBHOOK_SECRET || "demo-webhook-secret"

// ─────────────────────────────────────────────────────────────────────────────
// shopG41 client — public for products/checkout, admin (API key) for orders
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.SHOPG41_BASE_URL || "http://demo.localhost:3001"
const API_KEY = process.env.SHOPG41_API_KEY
const TENANT = process.env.SHOPG41_TENANT

function makeClient(): ShopG41Client {
  const wrapFetch: typeof fetch | undefined = TENANT
    ? ((input: any, init?: any) =>
        fetch(input, {
          ...init,
          headers: { ...((init?.headers as Record<string, string>) ?? {}), "X-Tenant": TENANT },
        })) as typeof fetch
    : undefined
  return new ShopG41Client({ baseUrl: BASE_URL, apiKey: API_KEY, fetch: wrapFetch })
}

// ─────────────────────────────────────────────────────────────────────────────
// Order webhook receiver (order.placed / order.paid)
// ─────────────────────────────────────────────────────────────────────────────
interface ReceivedDelivery {
  id: number
  event: string | null
  eventId: string | null
  valid: boolean
  receivedAt: string
  body: string
}

let deliveries: ReceivedDelivery[] = []
let nextId = 1

function verifySignature(body: string, secret: string, received: string | null): boolean {
  if (!received) return false
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"), "hex")
  const actual = Buffer.from(received, "hex")
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the CartDetails payload shopG41's /api/checkout/session expects
// ─────────────────────────────────────────────────────────────────────────────
interface CartItem {
  productId: number
  quantity: number
}

async function buildCart(items: CartItem[]): Promise<Record<string, unknown>> {
  const client = makeClient()
  const { products } = await client.products.list()
  const { settings } = await client.storefront.settings()
  const commerce = (settings as { commerce?: { currency?: string } }).commerce
  const currency = (commerce?.currency ?? "gbp").toLowerCase()

  const cart: Record<string, unknown> = {}
  for (const item of items) {
    const p = products.find((x) => x.id === item.productId)
    if (!p) continue
    const key = String(p.id)
    cart[key] = {
      id: key,
      price_id: p.price_id,
      name: p.name,
      price: p.price,
      currency,
      image: p.image,
      quantity: Math.max(1, Math.floor(item.quantity) || 1),
      product_data: {
        data: [
          { productId: p.id, variantId: null, options: [], customAttributes: [], price: p.price },
        ],
        userID: null,
      },
    }
  }
  return cart
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
          { id: nextId++, event, eventId, valid, receivedAt: new Date().toISOString(), body },
          ...deliveries,
        ].slice(0, 50)

        console.log(`[webhook] ${event} ${eventId ?? ""} signature=${valid ? "VALID" : "INVALID"}`)
        return Response.json({ ok: true, verified: valid })
      },
    },

    "/api/products": {
      GET: async () => {
        try {
          const { products } = await makeClient().products.list()
          return Response.json({ products })
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 })
        }
      },
    },

    "/api/checkout": {
      POST: async (req) => {
        try {
          const { items } = (await req.json()) as { items: CartItem[] }
          const cart = await buildCart(items)
          const client = makeClient()
          const session = await client.request<{ sessionId: string; url: string }>(
            "/api/checkout/session",
            { method: "POST", body: JSON.stringify(cart) }
          )
          return Response.json(session)
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 })
        }
      },
    },

    "/api/orders": {
      GET: async (req) => {
        try {
          // Guest lookup: the shopper's own order by the Stripe session id —
          // no API key, no cookie. This is what a headless front-end uses.
          const session = new URL(req.url).searchParams.get("session")
          if (session) {
            const res = await fetch(
              `${BASE_URL}/api/orders/session/${encodeURIComponent(session)}`,
              { headers: TENANT ? { "X-Tenant": TENANT } : {} },
            )
            const body = await res.json().catch(() => ({ error: "Bad response" }))
            return Response.json(body, { status: res.status })
          }

          if (!API_KEY) {
            return Response.json({ orders: [], error: "Set SHOPG41_API_KEY to list orders" })
          }
          const { orders } = await makeClient().admin!.orders.list()
          return Response.json({ orders })
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 })
        }
      },
    },

    "/api/deliveries": {
      GET: () => Response.json({ deliveries }),
    },

    "/api/status": {
      GET: () =>
        Response.json({
          baseUrl: BASE_URL,
          receiverUrl: RECEIVER_URL,
          hasApiKey: !!API_KEY,
          hint: API_KEY
            ? undefined
            : "Set SHOPG41_API_KEY to see orders + the webhook delivery log.",
        }),
    },
  },

  development: { hmr: true, console: true },
  port: PORT,
})

console.log(`Headless Store Demo running at http://localhost:${PORT}`)
console.log(`Backing store: ${BASE_URL}`)
console.log(`Webhook receiver: ${RECEIVER_URL}`)
