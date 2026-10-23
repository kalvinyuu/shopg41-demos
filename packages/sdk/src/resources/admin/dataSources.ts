import type { ShopG41Client } from "../../client"
import type {
  AdminListDataSourcesResponse,
  AdminGetDataSourceResponse,
  AdminDataSourceCreateInput,
  AdminDataSourceUpdateInput,
  AdminSimpleSuccessResponse,
  AdminTestIntegrationResponse,
} from "../../types"

export class AdminDataSourcesResource {
  constructor(private client: ShopG41Client) {}

  async list(): Promise<AdminListDataSourcesResponse> {
    return this.client.request("/api/admin/data-sources")
  }

  async get(id: number): Promise<AdminGetDataSourceResponse> {
    return this.client.request(`/api/admin/data-sources/${id}`)
  }

  async create(input: AdminDataSourceCreateInput): Promise<{ success: boolean; id: number }> {
    return this.client.request("/api/admin/data-sources", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  async update(id: number, input: AdminDataSourceUpdateInput): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/data-sources/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    })
  }

  async delete(id: number): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/data-sources/${id}`, { method: "DELETE" })
  }

  async test(id: number): Promise<AdminTestIntegrationResponse> {
    return this.client.request(`/api/admin/data-sources/${id}/test`, { method: "POST" })
  }
}
