import type { ShopG41Client } from "../../client"
import type {
  AdminListCardTemplatesResponse,
  AdminGetCardTemplateResponse,
  AdminCardTemplateCreateInput,
  AdminCardTemplateUpdateInput,
} from "../../types"

export class AdminCardResource {
  constructor(private client: ShopG41Client) {}

  async list(): Promise<AdminListCardTemplatesResponse> {
    return this.client.request("/api/card/admin/templates")
  }

  async get(id: number): Promise<AdminGetCardTemplateResponse> {
    return this.client.request(`/api/card/admin/templates/${id}`)
  }

  async create(input: AdminCardTemplateCreateInput): Promise<AdminGetCardTemplateResponse> {
    return this.client.request("/api/card/admin/templates", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  async update(
    id: number,
    input: AdminCardTemplateUpdateInput,
  ): Promise<AdminGetCardTemplateResponse> {
    return this.client.request(`/api/card/admin/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    })
  }

  async delete(id: number): Promise<{ ok: boolean }> {
    return this.client.request(`/api/card/admin/templates/${id}`, { method: "DELETE" })
  }
}
