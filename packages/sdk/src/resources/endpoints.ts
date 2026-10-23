import type { ShopG41Client } from "../client"
import type { EndpointCallOptions } from "../types"

export class EndpointsResource {
  constructor(private client: ShopG41Client) {}

  async call<T = unknown>(path: string, options: EndpointCallOptions = {}): Promise<T> {
    const method = options.method ?? "GET"
    const init: RequestInit = { method }
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body)
    }
    if (options.headers) {
      init.headers = options.headers
    }
    return this.client.request(`/api/e${path.startsWith("/") ? path : `/${path}`}`, init)
  }
}
