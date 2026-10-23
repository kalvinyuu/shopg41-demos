import React, { useState, useEffect, useCallback } from "react"
import { createRoot } from "react-dom/client"

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

interface LogEntry {
  id: number
  eventId: string
  event: string
  status: string
  attempts: number
  responseCode: number | null
  lastError: string | null
  createdAt: string
}

function App() {
  const [deliveries, setDeliveries] = useState<ReceivedDelivery[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [status, setStatus] = useState("")
  const [wired, setWired] = useState<boolean | null>(null)

  const refreshDeliveries = useCallback(async () => {
    const res = await fetch("/api/deliveries")
    const data = await res.json()
    setDeliveries(data.deliveries ?? [])
  }, [])

  const refreshLog = useCallback(async () => {
    const res = await fetch("/api/log")
    const data = await res.json()
    setLog(data.deliveries ?? [])
  }, [])

  useEffect(() => {
    refreshDeliveries()
    const t = setInterval(refreshDeliveries, 2000)
    return () => clearInterval(t)
  }, [refreshDeliveries])

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then((s) => setWired(s.wired ?? false)).catch(() => {})
  }, [])

  const run = async (path: string, label: string) => {
    setStatus(`${label}…`)
    try {
      const res = await fetch(path, { method: "POST" })
      const data = await res.json()
      setStatus(`${label}: ${JSON.stringify(data)}`)
      await refreshLog()
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`)
    }
  }

  return (
    <>
      {wired === false && (
        <p className="error">Not wired up yet. Run <code>bun run wire</code> in this folder first.</p>
      )}

      <div className="actions">
        <button onClick={() => run("/api/trigger", "Publish entry")} disabled={wired === false}>
          Publish Entry (real event)
        </button>
        <button onClick={() => run("/api/test", "Send test event")} disabled={wired === false}>
          Send Test Event
        </button>
        <button onClick={() => run("/api/replay", "Replay")} disabled={wired === false}>
          Replay Last
        </button>
        <button onClick={() => run("/api/retry", "Retry")} disabled={wired === false}>
          Retry Failed
        </button>
        <button onClick={refreshLog}>Refresh Delivery Log</button>
      </div>
      {status && <div className="status">{status}</div>}

      <h2>Live deliveries (signed)</h2>
      {deliveries.length === 0 && <p className="empty">No deliveries yet. Publish an entry above.</p>}
      {deliveries.map((d) => (
        <div key={d.id} className="delivery">
          <div className="head">
            <code>{d.event ?? "unknown"}</code>
            <span className={d.valid ? "valid" : "invalid"}>
              {d.valid ? "✓ signature valid" : "✗ signature INVALID"}
            </span>
          </div>
          <p>
            <code>{d.eventId ?? "no event id"}</code> · received {new Date(d.receivedAt).toLocaleTimeString()}
            {d.timestamp ? ` · event time ${new Date(d.timestamp).toLocaleTimeString()}` : ""}
          </p>
          <pre className="raw">{d.body}</pre>
        </div>
      ))}

      <h2>shopG41 delivery log</h2>
      {log.length === 0 && <p className="empty">Empty. Deliveries appear here once events fire.</p>}
      {log.map((e) => (
        <div key={e.id} className="delivery">
          <div className="head">
            <code>{e.event}</code>
            <span className={e.status === "ok" ? "valid" : "invalid"}>{e.status}</span>
          </div>
          <p>
            <code>{e.eventId}</code> · attempts {e.attempts} · response {e.responseCode ?? "-"}
            {e.lastError ? ` · error: ${e.lastError}` : ""} · {new Date(e.createdAt).toLocaleString()}
          </p>
        </div>
      ))}
    </>
  )
}

const root = createRoot(document.getElementById("root")!)
root.render(<App />)
