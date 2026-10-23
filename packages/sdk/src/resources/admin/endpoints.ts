import type { ShopG41Client } from "../../client"
import type {
  AdminListEndpointsResponse,
  AdminEndpointCreateInput,
  AdminEndpointUpdateInput,
  AdminSimpleSuccessResponse,
} from "../../types"

export class AdminEndpointsResource {
  constructor(private client: ShopG41Client) {}

  async list(): Promise<AdminListEndpointsResponse> {
    return this.client.request("/api/admin/endpoints")
  }

  async create(input: AdminEndpointCreateInput): Promise<{ success: boolean; id: number }> {
    return this.client.request("/api/admin/endpoints", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  async update(id: number, input: AdminEndpointUpdateInput): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/endpoints/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    })
  }

  async delete(id: number): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/endpoints/${id}`, { method: "DELETE" })
  }
}
