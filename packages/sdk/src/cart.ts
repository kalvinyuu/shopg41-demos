import type {
  CartDetails,
  CartLine,
  CreateCheckoutRequest,
  Product,
  OptionsResponse,
} from "./types"

/**
 * Turning a basket into the body `POST /api/checkout/session` accepts.
 *
 * The endpoint takes `CartDetails` — a map keyed by product id whose lines carry
 * the product's **Stripe `price_id`**, because that is what the server matches
 * against its own inventory. `client.checkout.createSession({ items })` sends
 * this ergonomic shape instead and resolves it here, so callers do not have to
 * know about `price_id`s or the map form.
 *
 * Prices are the base ones. Option and custom-field adjustments are read from
 * the product's own `GET /api/products/:id/options` (public), never from the
 * caller, so a line cannot be priced by client-supplied numbers.
 */

/** One line as the caller writes it. */
export type CheckoutItem = CreateCheckoutRequest["items"][number]

/** A resolved adjustment for one chosen option value or custom field. */
export interface ResolvedAdjustments {
  /** priceAdjustment keyed by `optionName\u0000optionValue`. */
  options: Map<string, number>
  /** priceAdjustment keyed by field name. */
  fields: Map<string, number>
}

const optionKey = (optionName: string, optionValue: string) => `${optionName}\u0000${optionValue}`

/** Index a product's options/custom fields for pricing a line. */
export function resolvedAdjustments(
  options: OptionsResponse | null | undefined,
): ResolvedAdjustments {
  const resolved: ResolvedAdjustments = { options: new Map(), fields: new Map() }
  for (const option of options?.options ?? []) {
    for (const value of option.values ?? []) {
      resolved.options.set(optionKey(option.name, value.value), value.priceAdjustment ?? 0)
    }
  }
  for (const field of options?.customFields ?? []) {
    resolved.fields.set(field.name, field.priceAdjustment ?? 0)
  }
  return resolved
}

/**
 * Build the `CartDetails` map for a set of items.
 *
 * Throws when an item names a product that is not in `products` (or has no
 * Stripe price), because the server would otherwise reject the whole basket
 * with a message about a product the caller never mentioned.
 */
export function cartDetailsFromItems(
  items: CheckoutItem[],
  products: Product[],
  opts: {
    currency: string
    /** Per-product adjustments, keyed by product id. */
    adjustments?: Record<number, ResolvedAdjustments>
  },
): CartDetails {
  const currency = (opts.currency || "gbp").toLowerCase()
  const cart: CartDetails = {}

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)
    if (!product) {
      throw new Error(`checkout: no product with id ${item.productId} in this store`)
    }
    if (!product.price_id) {
      throw new Error(
        `checkout: "${product.name}" has no Stripe price yet, so it cannot be paid for`,
      )
    }

    const resolved = opts.adjustments?.[item.productId]
    const options = (item.options ?? []).map((choice) => ({
      optionName: choice.optionName,
      optionValue: choice.optionValue,
      priceAdjustment: resolved?.options.get(optionKey(choice.optionName, choice.optionValue)) ?? 0,
    }))
    const customAttributes = (item.customAttributes ?? []).map((choice) => ({
      fieldName: choice.fieldName,
      value: choice.value,
      type: "text" as const,
      priceAdjustment: resolved?.fields.get(choice.fieldName) ?? 0,
    }))

    const quantity = Math.max(1, Math.floor(item.quantity) || 1)
    const key = String(product.id)
    const line: CartLine = {
      id: key,
      price_id: product.price_id,
      name: product.name,
      price: product.price,
      currency,
      image: product.image,
      quantity,
      product_data: {
        data: [
          {
            productId: product.id,
            variantId: item.variantId ?? null,
            options,
            customAttributes,
            price: product.price,
          },
        ],
      },
    }
    cart[key] = line
  }

  return cart
}

/** Whether a `createSession` argument is the ergonomic shape rather than a map. */
export function isItemsRequest(
  data: CreateCheckoutRequest | CartDetails,
): data is CreateCheckoutRequest {
  return Array.isArray((data as CreateCheckoutRequest).items)
}
