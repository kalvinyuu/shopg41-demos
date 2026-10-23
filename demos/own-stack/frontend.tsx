import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

/**
 * Your own frontend. It talks to your own backend (`/api/local/*`) and never
 * sees a shopG41 API key: the platform is only ever reached server-side.
 */

interface Product {
  id: number
  name: string
  price: number
  kind: string
  image: string | null
}

interface ProxyCall {
  at: string
  method: string
  path: string
  tenant: string | null
  signature: string
  bodyBytes: number
  status: number
}

interface State {
  databaseUrl: string
  hmacEnabled: boolean
  platformUrl: string
  tenantHost: string
  products: Product[]
  proxyLog: ProxyCall[]
}

interface PlatformCheck {
  url: string
  status?: number
  count?: number
  products?: { id: number; name: string }[]
  sameAsOwn?: boolean
  error?: string
  bodyPrefix?: string
}

function App() {
  const [state, setState] = useState<State | null>(null)
  const [check, setCheck] = useState<PlatformCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")

  const load = async () => {
    const res = await fetch("/api/local/state")
    setState(await res.json())
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [])

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch("/api/local/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price: Number(price) }),
    })
    if (res.ok) {
      setName("")
      setPrice("")
      await load()
    } else {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? "Could not add the product")
    }
  }

  const askPlatform = async () => {
    setChecking(true)
    try {
      const res = await fetch("/api/local/check-platform", { method: "POST" })
      setCheck(await res.json())
    } finally {
      setChecking(false)
    }
  }

  if (!state) return <p>Loading…</p>

  return (
    <>
      <header>
        <h1>Own stack</h1>
        <p>
          Your frontend → your backend → your Postgres. shopG41 is the commerce
          layer beside it, not underneath it.
        </p>
      </header>

      <section>
        <h2>1 · Your database</h2>
        <p className="meta">{state.databaseUrl}</p>
        <form onSubmit={addProduct}>
          <input
            placeholder="Product name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
          />
          <button type="submit">Insert row</button>
        </form>
        <ul className="rows">
          {state.products.map((p) => (
            <li key={p.id}>
              <span className="tag">{p.kind}</span>
              <strong>{p.name}</strong>
              <span className="price">£{p.price.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>2 · Your backend</h2>
        <p className="meta">
          localhost:3009 · HMAC {state.hmacEnabled ? "verifying" : "off"}
        </p>
        <p>
          Each row below is a call <em>shopG41</em> made into this backend. The
          platform never forwards cookies or Authorization, so a valid signature
          is the only reason to trust one.
        </p>
        {state.proxyLog.length === 0 ? (
          <p className="empty">
            Nothing yet. Enable the external backend with <code>bun run wire</code>, then
            load the store on the platform host.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Call</th>
                <th>Tenant</th>
                <th>Signature</th>
                <th>Body</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {state.proxyLog.slice(0, 8).map((c, i) => (
                <tr key={i}>
                  <td>{new Date(c.at).toLocaleTimeString()}</td>
                  <td>
                    <code>
                      {c.method} {c.path}
                    </code>
                  </td>
                  <td>{c.tenant ?? "—"}</td>
                  <td className={c.signature === "valid" ? "ok" : "bad"}>
                    {c.signature}
                  </td>
                  <td>{c.bodyBytes} B</td>
                  <td>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>3 · shopG41 beside you</h2>
        <p>
          Ask the platform for its catalogue on{" "}
          <code>{state.tenantHost}</code>. With the external backend on, that
          request is proxied straight back here, so the two lists must match.
        </p>
        <button onClick={askPlatform} disabled={checking}>
          {checking ? "Asking the platform…" : "Compare with the platform"}
        </button>
        {check && (
          <div className="result">
            {check.error ? (
              <p className="bad">{check.error}</p>
            ) : (
              <>
                <p>
                  <code>
                    {check.url} → {check.status}
                  </code>
                </p>
                <p className={check.sameAsOwn ? "ok" : "bad"}>
                  {check.count} products ·{" "}
                  {check.sameAsOwn
                    ? "identical to your database — the platform proxied this call to your backend"
                    : "differs from your database — the proxy is not wired up yet"}
                </p>
                {check.bodyPrefix && <pre>{check.bodyPrefix}</pre>}
              </>
            )}
          </div>
        )}
      </section>
    </>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
