import type { ShopG41Client } from "../../client"
import type { AdminGetPlanResponse } from "../../types"

export class AdminPlanResource {
  constructor(private client: ShopG41Client) {}

  async get(): Promise<AdminGetPlanResponse> {
    return this.client.request("/api/admin/plan")
  }
}
