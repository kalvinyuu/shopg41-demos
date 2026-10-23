import type { ShopG41Client } from "../../client"
import type {
  AdminListOrdersResponse,
  AdminGetOrderResponse,
  AdminSimpleSuccessResponse,
  OrderStatusUpdateInput,
  OrderTrackingUpdateInput,
} from "../../types"

export class AdminOrdersResource {
  constructor(private client: ShopG41Client) {}

  async list(): Promise<AdminListOrdersResponse> {
    return this.client.request("/api/admin/orders")
  }

  async get(id: number): Promise<AdminGetOrderResponse> {
    return this.client.request(`/api/admin/orders/${id}`)
  }

  async updateStatus(
    id: number,
    status: string,
  ): Promise<AdminSimpleSuccessResponse & { status: string }> {
    return this.client.request(`/api/admin/orders/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    })
  }

  async updateTracking(
    id: number,
    input: OrderTrackingUpdateInput,
  ): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/orders/${id}/tracking`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  }
}
