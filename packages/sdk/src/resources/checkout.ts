import type { ShopG41Client } from "../client"
import type {
  CartDetails,
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  GetSettingsResponse,
  OptionsResponse,
  Product,
} from "../types"
import { cartDetailsFromItems, isItemsRequest, resolvedAdjustments } from "../cart"

export class CheckoutResource {
  constructor(private client: ShopG41Client) {}

  /**
   * Create a Stripe Checkout session and return its URL.
   *
   * Accepts either the ergonomic `{ items: […] }` shape or the `CartDetails` map
   * the endpoint takes, so both of these work:
   *
   * ```ts
   * await client.checkout.createSession({ items: [{ productId: 1, quantity: 2 }] })
   * await client.checkout.createSession({ "1": { ...a CartLine... } })
   * ```
   *
   * The endpoint matches each line against its own inventory by **`price_id`**,
   * so the item form is resolved here (product list + the pricing of any chosen
   * options) rather than sent as-is. No API key is needed: checkout is a public
   * route, and a guest is a normal customer.
   */
  async createSession(data: CreateCheckoutRequest | CartDetails): Promise<CreateCheckoutResponse> {
    const body = isItemsRequest(data) ? await this.buildCart(data) : data
    return this.client.request("/api/checkout/session", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  /** Resolve the ergonomic item shape into the map the endpoint accepts. */
  private async buildCart(request: CreateCheckoutRequest): Promise<CartDetails> {
    const [{ products }, settings] = await Promise.all([
      this.client.products.list(),
      this.client.storefront.settings().catch(() => null),
    ])

    // Only fetch a product's options when the basket actually chose some, and
    // only once per product.
    const adjustments: Record<number, ReturnType<typeof resolvedAdjustments>> = {}
    for (const item of request.items) {
      const needsPricing =
        (item.options?.length ?? 0) > 0 || (item.customAttributes?.length ?? 0) > 0
      if (!needsPricing || adjustments[item.productId]) continue
      const options: OptionsResponse | null = await this.client.products
        .options(item.productId)
        .catch(() => null)
      adjustments[item.productId] = resolvedAdjustments(options)
    }

    return cartDetailsFromItems(request.items, products as Product[], {
      currency: currencyOf(settings),
      adjustments,
    })
  }
}

function currencyOf(settings: GetSettingsResponse | null): string {
  const commerce = (settings?.settings as { commerce?: { currency?: string } } | undefined)
    ?.commerce
  return commerce?.currency ?? "gbp"
}
