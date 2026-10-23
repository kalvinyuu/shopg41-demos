import type { ShopG41Client } from "../client"
import type { ListGameStoresResponse, GetGameStoreProductsResponse } from "../types"

export class GameResource {
  constructor(private client: ShopG41Client) {}

  /** Enabled in-world storefronts (tenant subdomain, name, world coordinates). */
  async stores(): Promise<ListGameStoresResponse> {
    return this.client.request("/api/game/stores")
  }

  /** A storefront's real product catalogue by tenant subdomain. */
  async storeProducts(subdomain: string): Promise<GetGameStoreProductsResponse> {
    return this.client.request(`/api/game/stores/${encodeURIComponent(subdomain)}/products`)
  }
}
