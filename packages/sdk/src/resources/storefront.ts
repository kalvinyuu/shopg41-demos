import type { ShopG41Client } from "../client"
import type { GetSettingsResponse, GetAnalyticsResponse, ListBannersResponse } from "../types"

export class StorefrontResource {
  constructor(private client: ShopG41Client) {}

  async settings(): Promise<GetSettingsResponse> {
    return this.client.request("/api/site/settings")
  }

  async analytics(): Promise<GetAnalyticsResponse> {
    return this.client.request("/api/site/analytics")
  }

  async banners(): Promise<ListBannersResponse> {
    return this.client.request("/api/banners")
  }
}
