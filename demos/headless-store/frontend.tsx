import React, { useState, useEffect, useCallback } from "react"
import { createRoot } from "react-dom/client"

interface Product {
  id: number
  name: string
  image: string
  price: number
  shopBy: string
}

interface CartLine {
  productId: number
  quantity: number
}

interface Order {
  id: number
  orderDate: string
  totalAmount: number
  orderStatus: string
  items: Array<{ productName: string | null; price: number }>
}

interface Delivery {
  id: number
  event: string | null
  eventId: string | null
  valid: boolean
  receivedAt: string
  body: string
}

/** GET /api/orders/session/:id — public, keyed by the Stripe session id. */
interface GuestOrder {
  id: number
  date: string
  status: string
  total: number
  kind: string
  items: Array<{ name: string | null; image: string | null; price: number }>
}

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Record<number, number>>({})
  const [checkingOut, setCheckingOut] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [status, setStatus] = useState("")
  const [apiKey, setApiKey] = useState<boolean | null>(null)
  const [guestOrder, setGuestOrder] = useState<GuestOrder | null>(null)

  const refreshOrders = useCallback(async () => {
    const res = await fetch("/api/orders")
    const data = await res.json()
    if (data.orders) setOrders(data.orders)
  }, [])

  const refreshDeliveries = useCallback(async () => {
    const res = await fetch("/api/deliveries")
    const data = await res.json()
    setDeliveries(data.deliveries ?? [])
  }, [])

  useEffect(() => {
    // Stripe sends the shopper back to the platform's /orders, not here, so the
    // session id is kept locally: reopen this demo and your guest order loads
    // without a key or a cookie.
    const saved = localStorage.getItem("shopg41:lastSession")
    if (saved) {
      fetch(`/api/orders?session=${encodeURIComponent(saved)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.order && setGuestOrder(d.order))
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products ?? []))
    fetch("/api/status").then((r) => r.json()).then((s) => setApiKey(s.hasApiKey ?? false)).catch(() => {})
    refreshOrders()
    refreshDeliveries()
    const t = setInterval(refreshDeliveries, 2000)
    return () => clearInterval(t)
  }, [refreshOrders, refreshDeliveries])

  const addToCart = (id: number) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }))
  const removeFromCart = (id: number) => setCart((c) => {
    const next = { ...c }
    if (!next[id]) return next
    next[id] -= 1
    if (next[id] <= 0) delete next[id]
    return next
  })

  const total = products.reduce((sum, p) => sum + p.price * (cart[p.id] ?? 0), 0)
  const cartLines: Array<{ product: Product; quantity: number }> = Object.entries(cart)
    .map(([id, qty]) => {
      const product = products.find((p) => p.id === Number(id))
      return product ? { product, quantity: qty } : null
    })
    .filter((x): x is { product: Product; quantity: number } => x !== null)

  const checkout = async () => {
    setCheckingOut(true)
    setStatus("Creating Stripe Checkout session…")
    const items: CartLine[] = cartLines.map(({ product, quantity }) => ({
      productId: product.id,
      quantity,
    }))
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus(`Error: ${data.error || res.status}`)
        return
      }
      setStatus(`Redirecting to Stripe Checkout… (test card 4242 4242 4242 4242)`)
      // Kept so the guest lookup can show this order after you come back.
      if (data.sessionId) localStorage.setItem("shopg41:lastSession", data.sessionId)
      window.location.href = data.url
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`)
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <>
      <div className="cart">
        <h2>Cart</h2>
        {cartLines.length === 0 && <p className="muted">Empty — add products below.</p>}
        {cartLines.map(({ product, quantity }) => (
          <div className="row" key={product.id}>
            <span>{product.name} × {quantity}</span>
            <span>£{(product.price * quantity).toFixed(2)} <button onClick={() => removeFromCart(product.id)}>−</button></span>
          </div>
        ))}
        {cartLines.length > 0 && (
          <>
            <div className="row"><strong>Total</strong><strong>£{total.toFixed(2)}</strong></div>
            <button onClick={checkout} disabled={checkingOut}>
              {checkingOut ? "Creating session…" : "Checkout with Stripe"}
            </button>
          </>
        )}
      </div>
      {status && <div className="status">{status}</div>}

      <h2>Products</h2>
      <div className="grid">
        {products.map((p) => (
          <div key={p.id} className="product">
            <img src={p.image} alt={p.name} />
            <h3>{p.name}</h3>
            <p className="price">£{p.price.toFixed(2)}</p>
            <button onClick={() => addToCart(p.id)}>Add to cart</button>
          </div>
        ))}
      </div>

      <h2>Orders</h2>
      {guestOrder && (
        <div className="delivery">
          <div className="head">
            <code>Your order #{guestOrder.id}</code>
            <span className="valid">{guestOrder.status}</span>
          </div>
          <p className="muted">
            {guestOrder.items.map((i) => i.name).filter(Boolean).join(", ") || "—"} · £
            {(guestOrder.total / 100).toFixed(2)} · {new Date(guestOrder.date).toLocaleString()}
          </p>
          <p className="muted">
            Found by the Stripe session id alone — no login, no API key.
          </p>
        </div>
      )}
      <button onClick={refreshOrders}>Refresh orders</button>
      {orders.length === 0 && <p className="muted">{apiKey === false ? "Set SHOPG41_API_KEY to list orders." : "No orders yet."}</p>}
      {orders.map((o) => (
        <div key={o.id} className="delivery">
          <div className="head">
            <code>Order #{o.id}</code>
            <span className="valid">{o.orderStatus}</span>
          </div>
          <p className="muted">
            {o.items.map((i) => i.productName).filter(Boolean).join(", ") || "—"} · £{(o.totalAmount / 100).toFixed(2)} · {new Date(o.orderDate).toLocaleString()}
          </p>
        </div>
      ))}

      <h2>Webhook deliveries (order.placed / order.paid)</h2>
      {deliveries.length === 0 && <p className="muted">No deliveries yet. Complete a checkout — a signed delivery lands here instantly.</p>}
      {deliveries.map((d) => (
        <div key={d.id} className="delivery">
          <div className="head">
            <code>{d.event}</code>
            <span className="valid">{d.valid ? "✓ signature valid" : "✗ signature invalid"}</span>
          </div>
          <p className="muted">
            <code>{d.eventId}</code> · {new Date(d.receivedAt).toLocaleTimeString()}
          </p>
        </div>
      ))}
    </>
  )
}

const root = createRoot(document.getElementById("root")!)
root.render(<App />)
