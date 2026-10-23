import React, { useState, useEffect, useCallback } from "react"
import { createRoot } from "react-dom/client"

interface Product {
  id: number
  name: string
  price: number
}

interface TenantSummary {
  subdomain: string
  name: string
  baseUrl: string
  productCount: number
}

interface CheckResult {
  check: string
  status: number
  isolated: boolean
  detail: string
}

function TenantPanel({ subdomain }: { subdomain: string }) {
  const [products, setProducts] = useState<Product[]>([])
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [msg, setMsg] = useState("")

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/${subdomain}/products`)
    const data = await res.json()
    setProducts(data.products ?? [])
  }, [subdomain])

  useEffect(() => {
    refresh()
  }, [refresh])

  const add = async () => {
    const priceNum = parseFloat(price)
    if (!name.trim() || isNaN(priceNum) || priceNum <= 0) {
      setMsg("Name + valid price required")
      return
    }
    setMsg("Creating…")
    const res = await fetch(`/api/${subdomain}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), price: priceNum }),
    })
    const data = await res.json()
    setMsg(data.ok ? `Added to ${subdomain}` : `Error: ${data.error || res.status}`)
    setName("")
    setPrice("")
    await refresh()
  }

  return (
    <div className="tenant">
      <h2>{subdomain} <span className="muted">({products.length} products)</span></h2>
      <div>
        {products.length === 0 && <p className="muted">No products.</p>}
        {products.map((p) => (
          <div key={p.id} className="product">
            <span>{p.name}</span>
            <span>£{p.price.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" />
      <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.01" min="0.01" placeholder="Price" />
      <button onClick={add}>Add product</button>
      {msg && <p className="status">{msg}</p>}
    </div>
  )
}

function App() {
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [results, setResults] = useState<CheckResult[]>([])
  const [checking, setChecking] = useState(false)
  const [checkMsg, setCheckMsg] = useState("")

  useEffect(() => {
    fetch("/api/tenants").then((r) => r.json()).then((d) => setTenants(d.tenants ?? []))
  }, [])

  const runCheck = async () => {
    setChecking(true)
    setCheckMsg("Testing cross-tenant access…")
    const res = await fetch("/api/cross-check", { method: "POST" })
    const data = await res.json()
    setResults(data.results ?? [])
    setCheckMsg(data.error ? `Error: ${data.error}` : "")
    setChecking(false)
  }

  return (
    <>
      <div className="cols">
        {tenants.map((t) => (
          <TenantPanel key={t.subdomain} subdomain={t.subdomain} />
        ))}
      </div>
      {tenants.length === 0 && (
        <p className="status">No tenants configured. Run <code>bun run wire</code> in this folder first.</p>
      )}

      <button onClick={runCheck} disabled={checking || tenants.length < 2}>
        {checking ? "Checking…" : "Cross-tenant check"}
      </button>
      {checkMsg && <p className="status">{checkMsg}</p>}
      {results.map((r, i) => (
        <div key={i} className="result">
          <span>{r.check} → HTTP {r.status} · </span>
          <span className={r.isolated ? "ok" : "bad"}>{r.detail}</span>
        </div>
      ))}

      <p className="muted">
        Both storefronts run on the same shopG41 instance ({tenants.map((t) => t.baseUrl).join(" and ")}).
        Each has its own products, API key, and CMS — tenant data never crosses.
      </p>
    </>
  )
}

const root = createRoot(document.getElementById("root")!)
root.render(<App />)
