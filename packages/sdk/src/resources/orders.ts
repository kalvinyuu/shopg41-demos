import type { ShopG41Client } from "../client"
import type { ListOrdersResponse } from "../types"

export class OrdersResource {
  constructor(private client: ShopG41Client) {}

  async list(): Promise<ListOrdersResponse> {
    return this.client.request("/api/orders")
  }
}
