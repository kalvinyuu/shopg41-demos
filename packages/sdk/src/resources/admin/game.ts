import type { ShopG41Client } from "../../client"
import type { GameStorefront, SaveGameStorefrontInput } from "../../types"

export class AdminGameResource {
  constructor(private client: ShopG41Client) {}

  async getStorefront(): Promise<{ storefront: GameStorefront | null }> {
    return this.client.request("/api/admin/game/storefront")
  }

  async saveStorefront(input: SaveGameStorefrontInput): Promise<{ storefront: GameStorefront }> {
    return this.client.request("/api/admin/game/storefront", {
      method: "PUT",
      body: JSON.stringify(input),
    })
  }
}
