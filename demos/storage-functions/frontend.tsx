import React, { useState } from "react"
import { createRoot } from "react-dom/client"

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [url, setUrl] = useState("")
  const [uploadStatus, setUploadStatus] = useState("")

  const [calling, setCalling] = useState(false)
  const [fnResult, setFnResult] = useState<unknown>(null)
  const [fnStatus, setFnStatus] = useState("")

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus("Pick an image first")
      return
    }
    setUploading(true)
    setUploadStatus("Uploading to shopG41 → R2…")
    const fd = new FormData()
    fd.set("image", file, file.name)
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        setUploadStatus(`Error: ${data.error || res.status}`)
        return
      }
      setUrl(data.url)
      setUploadStatus("Stored in R2/S3 — served from the public URL below.")
    } catch (e) {
      setUploadStatus(`Error: ${(e as Error).message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleCall = async () => {
    setCalling(true)
    setFnStatus("Calling shopG41 pipeline /api/e/order-quote (function step → this app)…")
    try {
      const res = await fetch("/api/call-function")
      const data = await res.json()
      if (!res.ok) {
        setFnStatus(`Error: ${data.error || res.status}`)
        return
      }
      setFnResult(data)
      setFnStatus("shopG41 forwarded { prev } to your function and signed the request.")
    } catch (e) {
      setFnStatus(`Error: ${(e as Error).message}`)
    } finally {
      setCalling(false)
    }
  }

  return (
    <>
      <div className="panel">
        <h2>Storage — upload to R2/S3</h2>
        <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button onClick={handleUpload} disabled={uploading}>
          {uploading ? "Uploading…" : "Upload to R2"}
        </button>
        {uploadStatus && <div className="status">{uploadStatus}</div>}
        {url && (
          <>
            <div className="status">URL: {url}</div>
            <img src={url} alt="Uploaded" />
          </>
        )}
      </div>

      <div className="panel">
        <h2>Functions — call your serverless function</h2>
        <button onClick={handleCall} disabled={calling}>
          {calling ? "Calling…" : "Call Function"}
        </button>
        {fnStatus && <div className="status">{fnStatus}</div>}
        {fnResult !== null && (
          <pre>{JSON.stringify(fnResult, null, 2)}</pre>
        )}
      </div>
    </>
  )
}

const root = createRoot(document.getElementById("root")!)
root.render(<App />)
