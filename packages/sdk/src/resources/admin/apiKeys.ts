import type { ShopG41Client } from "../../client"
import type {
  AdminListApiKeysResponse,
  AdminCreateApiKeyResponse,
  AdminRevokeApiKeyResponse,
  AdminCreateApiKeyInput,
} from "../../types"

export class AdminApiKeysResource {
  constructor(private client: ShopG41Client) {}

  async list(): Promise<AdminListApiKeysResponse> {
    return this.client.request("/api/admin/api-keys")
  }

  async create(input?: AdminCreateApiKeyInput): Promise<AdminCreateApiKeyResponse> {
    return this.client.request("/api/admin/api-keys", {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    })
  }

  async revoke(id: number): Promise<AdminRevokeApiKeyResponse> {
    return this.client.request(`/api/admin/api-keys/${id}/revoke`, { method: "POST" })
  }
}
