import type { ShopG41Client } from "../client"
import type {
  BuyingSourcesResponse,
  BuyingSearchResponse,
  BuyingProductResponse,
  BuyingPricesResponse,
  BuyingMarketResponse,
  BuyingAnalyseInput,
  BuyingAnalyseResponse,
  BuyingWatchlistsResponse,
  BuyingWatchlistCreateInput,
  BuyingWatchlistCreateResponse,
  BuyingSimpleSuccessResponse,
} from "../types"

/**
 * Buying & Value Intelligence (crowio).
 *
 * Point a ShopG41Client at the crowio base URL — the buying routes live there,
 * not on the shopG41 server. Watchlist methods use the session cookie when the
 * client is constructed without an apiKey.
 */
export class BuyingResource {
  constructor(private client: ShopG41Client) {}

  listSources(): Promise<BuyingSourcesResponse> {
    return this.client.requestBuying("/api/buying/sources")
  }

  search(query: string, opts: { region?: string } = {}): Promise<BuyingSearchResponse> {
    const params = new URLSearchParams({ q: query })
    if (opts.region) params.set("region", opts.region)
    return this.client.requestBuying(`/api/buying/search?${params.toString()}`)
  }

  getProduct(id: number): Promise<BuyingProductResponse> {
    return this.client.requestBuying(`/api/buying/products/${id}`)
  }

  getPrices(id: number): Promise<BuyingPricesResponse> {
    return this.client.requestBuying(`/api/buying/products/${id}/prices`)
  }

  getMarket(
    id: number,
    opts: { condition?: string; currency?: string } = {},
  ): Promise<BuyingMarketResponse> {
    const params = new URLSearchParams()
    if (opts.condition) params.set("condition", opts.condition)
    if (opts.currency) params.set("currency", opts.currency)
    const qs = params.toString()
    return this.client.requestBuying(`/api/buying/products/${id}/market${qs ? `?${qs}` : ""}`)
  }

  analyse(input: BuyingAnalyseInput): Promise<BuyingAnalyseResponse> {
    return this.client.requestBuying("/api/buying/analyse", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  listWatchlists(): Promise<BuyingWatchlistsResponse> {
    return this.client.requestBuying("/api/buying/watchlists")
  }

  createWatchlist(input: BuyingWatchlistCreateInput): Promise<BuyingWatchlistCreateResponse> {
    return this.client.requestBuying("/api/buying/watchlists", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  deleteWatchlist(id: number): Promise<BuyingSimpleSuccessResponse> {
    return this.client.requestBuying(`/api/buying/watchlists/${id}`, { method: "DELETE" })
  }
}
