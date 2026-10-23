import type { ShopG41Client } from "../../client"
import type {
  AdminListProductTypesResponse,
  AdminGetProductTypeResponse,
  AdminProductTypeCreateInput,
  AdminProductTypeUpdateInput,
  AdminSimpleSuccessResponse,
} from "../../types"

export class AdminProductTypesResource {
  constructor(private client: ShopG41Client) {}

  async list(): Promise<AdminListProductTypesResponse> {
    return this.client.request("/api/admin/product-types")
  }

  async get(id: number): Promise<AdminGetProductTypeResponse> {
    return this.client.request(`/api/admin/product-types/${id}`)
  }

  async create(input: AdminProductTypeCreateInput): Promise<AdminGetProductTypeResponse> {
    return this.client.request("/api/admin/product-types", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  async update(
    id: number,
    input: AdminProductTypeUpdateInput,
  ): Promise<AdminGetProductTypeResponse> {
    return this.client.request(`/api/admin/product-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    })
  }

  async delete(id: number): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/product-types/${id}`, { method: "DELETE" })
  }

  async applyToProduct(typeId: number, productId: number): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/product-types/${typeId}/apply/${productId}`, {
      method: "POST",
    })
  }
}
