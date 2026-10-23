import type { ShopG41Client } from "../../client"
import type {
  GetSettingsResponse,
  AdminSettingsUpdateInput,
  AdminSimpleSuccessResponse,
} from "../../types"

export class AdminSettingsResource {
  constructor(private client: ShopG41Client) {}

  async get(): Promise<GetSettingsResponse> {
    return this.client.request("/api/admin/settings")
  }

  async update(input: AdminSettingsUpdateInput): Promise<AdminSimpleSuccessResponse> {
    return this.client.request("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    })
  }
}
