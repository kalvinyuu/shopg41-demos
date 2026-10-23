import type { ShopG41Client } from "../../client"
import type {
  AdminListIntegrationsResponse,
  AdminIntegrationConnectInput,
  AdminConnectIntegrationResponse,
  AdminTestIntegrationResponse,
  AdminSimpleSuccessResponse,
} from "../../types"

export class AdminIntegrationsResource {
  constructor(private client: ShopG41Client) {}

  async list(): Promise<AdminListIntegrationsResponse> {
    return this.client.request("/api/admin/integrations")
  }

  async connect(
    provider: string,
    config: AdminIntegrationConnectInput,
  ): Promise<AdminConnectIntegrationResponse> {
    return this.client.request(`/api/admin/integrations/${provider}/connect`, {
      method: "POST",
      body: JSON.stringify(config),
    })
  }

  async disconnect(provider: string): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/integrations/${provider}`, { method: "DELETE" })
  }

  async test(provider: string): Promise<AdminTestIntegrationResponse> {
    return this.client.request(`/api/admin/integrations/${provider}/test`, { method: "POST" })
  }
}
