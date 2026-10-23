import type { ShopG41Client } from "../../client"
import type { AdminMeResponse } from "../../types"

export class AdminMeResource {
  constructor(private client: ShopG41Client) {}

  async get(): Promise<AdminMeResponse> {
    return this.client.request("/api/admin/me")
  }
}
