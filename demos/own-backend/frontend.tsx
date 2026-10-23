import React, { useState, useEffect, useCallback } from "react"
import { createRoot } from "react-dom/client"

interface Product {
  id: number
  name: string
  price: number
  imageUrl: string
}

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const fetchProducts = useCallback(async () => {
    const res = await fetch("/api/products")
    const data = await res.json()
    setProducts(data)
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage("")
    setLoading(true)

    const priceNum = parseFloat(price)
    if (!name.trim() || isNaN(priceNum) || priceNum <= 0) {
      setMessage("Name and valid price are required")
      setLoading(false)
      return
    }

    const imageUrl = `https://placehold.co/400x400/eee/999?text=${encodeURIComponent(name.slice(0, 12))}`

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), price: priceNum, imageUrl }),
    })

    if (res.ok) {
      setName("")
      setPrice("")
      setMessage("Product added")
      await fetchProducts()
    } else {
      const err = await res.json()
      setMessage(err.error || "Failed to add product")
    }
    setLoading(false)
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Product"}
        </button>
        {message && <p style={{ color: message.includes("failed") || message.includes("required") ? "#c33" : "#3a3" }}>{message}</p>}
      </form>

      <h2>Products ({products.length})</h2>
      {products.length === 0 && <p>No products yet. Add one above.</p>}
      {products.map((p) => (
        <div key={p.id} className="card">
          <img src={p.imageUrl} alt={p.name} />
          <div>
            <h3>{p.name}</h3>
            <p className="price">£{p.price.toFixed(2)}</p>
          </div>
        </div>
      ))}
    </>
  )
}

const root = createRoot(document.getElementById("root")!)
root.render(<App />)
