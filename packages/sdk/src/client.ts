import { buildError, ShopG41Error } from "./errors"
import { ProductsResource } from "./resources/products"
import { BlogResource } from "./resources/blog"
import { CmsResource } from "./resources/cms"
import { StorefrontResource } from "./resources/storefront"
import { CheckoutResource } from "./resources/checkout"
import { OrdersResource } from "./resources/orders"
import { EndpointsResource } from "./resources/endpoints"
import { BuyingResource } from "./resources/buying"
import { GameResource } from "./resources/game"
import { AdminClient } from "./resources/admin/index"

export interface ShopG41ClientConfig {
  baseUrl: string
  /** Base URL of the crowio buying service; defaults to baseUrl. */
  buyingBaseUrl?: string
  apiKey?: string
  fetch?: typeof fetch
}

export class ShopG41Client {
  readonly products: ProductsResource
  readonly blog: BlogResource
  readonly cms: CmsResource
  readonly storefront: StorefrontResource
  readonly checkout: CheckoutResource
  readonly orders: OrdersResource
  readonly endpoints: EndpointsResource
  readonly buying: BuyingResource
  readonly game: GameResource
  readonly admin?: AdminClient

  private baseUrl: string
  private buyingBaseUrl: string
  private apiKey?: string
  private fetchFn: typeof fetch

  constructor(config: ShopG41ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "")
    this.buyingBaseUrl = (config.buyingBaseUrl ?? config.baseUrl).replace(/\/+$/, "")
    this.apiKey = config.apiKey
    this.fetchFn = config.fetch ?? fetch

    this.products = new ProductsResource(this)
    this.blog = new BlogResource(this)
    this.cms = new CmsResource(this)
    this.storefront = new StorefrontResource(this)
    this.checkout = new CheckoutResource(this)
    this.orders = new OrdersResource(this)
    this.endpoints = new EndpointsResource(this)
    this.buying = new BuyingResource(this)
    this.game = new GameResource(this)
    if (config.apiKey) {
      this.admin = new AdminClient(this)
    }
  }

  /**
   * Attach a plugin-provided resource. Plugins export a factory; consumers
   * compose it in: `const hello = client.use(helloResource)`.
   */
  use<T>(factory: (client: ShopG41Client) => T): T {
    return factory(this)
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    return this.send<T>(this.baseUrl, path, options)
  }

  /** Requests against the crowio buying service base URL. */
  async requestBuying<T>(path: string, options: RequestInit = {}): Promise<T> {
    return this.send<T>(this.buyingBaseUrl, path, options)
  }

  private async send<T>(baseUrl: string, path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    }

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`
    }

    if (!this.apiKey) {
      ;(options as Record<string, unknown>).credentials = "include"
    }

    const url = `${baseUrl}${path}`
    const response = await this.fetchFn(url, { ...options, headers })

    if (!response.ok) {
      let body: unknown
      try {
        body = await response.json()
      } catch {
        body = await response.text()
      }
      throw buildError(response.status, body)
    }

    const contentType = response.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      return response.json() as Promise<T>
    }

    return response.text() as unknown as T
  }

  async requestMultipart<T>(path: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {}
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`
    }

    const url = `${this.baseUrl}${path}`
    const response = await this.fetchFn(url, {
      method: "POST",
      headers,
      body: formData,
    })

    if (!response.ok) {
      let body: unknown
      try {
        body = await response.json()
      } catch {
        body = await response.text()
      }
      throw buildError(response.status, body)
    }

    return response.json() as Promise<T>
  }

  async requestMultipartPut<T>(path: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {}
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`
    }

    const url = `${this.baseUrl}${path}`
    const response = await this.fetchFn(url, {
      method: "PUT",
      headers,
      body: formData,
    })

    if (!response.ok) {
      let body: unknown
      try {
        body = await response.json()
      } catch {
        body = await response.text()
      }
      throw buildError(response.status, body)
    }

    return response.json() as Promise<T>
  }
}
