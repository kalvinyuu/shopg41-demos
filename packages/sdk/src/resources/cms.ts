import type { ShopG41Client } from "../client"
import type { ListCmsResponse, GetCmsResponse } from "../types"

export class CmsResource {
  constructor(private client: ShopG41Client) {}

  async list(collection: string): Promise<ListCmsResponse> {
    return this.client.request(`/api/cms/${collection}`)
  }

  async get(collection: string, entryId: number): Promise<GetCmsResponse> {
    return this.client.request(`/api/cms/${collection}/${entryId}`)
  }
}
