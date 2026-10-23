#!/usr/bin/env bun
import { ShopG41Client } from "../../packages/sdk/src/index"

const BASE_URL = process.env.SHOPG41_BASE_URL || "http://localhost:3001"
const API_KEY = process.env.SHOPG41_API_KEY

if (!API_KEY) {
  console.error("Set SHOPG41_API_KEY=sk_...")
  process.exit(1)
}

const client = new ShopG41Client({ baseUrl: BASE_URL, apiKey: API_KEY })
const admin = client.admin!

async function main() {
  console.log("1. Creating SQLite data source...")
  const { id: dataSourceId } = await admin.dataSources.create({
    name: "My Product DB",
    kind: "sqlite",
    config: { path: "./products.db" },
  })
  console.log(`   Data source created (id=${dataSourceId})`)

  console.log("2. Testing connection...")
  const testResult = await admin.dataSources.test(dataSourceId)
  console.log(`   Test: ${testResult.ok ? "OK" : `FAILED — ${testResult.error}`}`)

  console.log("3. Creating pipeline endpoint...")
  await admin.endpoints.create({
    name: "Own Products",
    path: "own-products",
    method: "GET",
    handlerKind: "pipeline",
    status: "published",
    handlerConfig: {
      steps: [
        {
          type: "query",
          dataSourceId,
          sql: "SELECT id, name, price, image_url FROM products ORDER BY id DESC",
        },
      ],
    },
  })
  console.log("   Pipeline endpoint created at GET /api/e/own-products")

  console.log("4. Fetching products through shopG41...")
  const result = await client.endpoints.call("/own-products")
  console.log("   Result:", JSON.stringify(result, null, 2))

  console.log("\nDone! Your SQLite data is now queryable at:")
  console.log(`  ${BASE_URL}/api/e/own-products`)
}

main().catch((err) => {
  console.error("Error:", err.message)
  process.exit(1)
})
