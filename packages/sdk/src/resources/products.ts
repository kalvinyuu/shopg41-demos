import type { ShopG41Client } from "../client"
import type {
  ListProductsResponse,
  GetProductResponse,
  GalleryResponse,
  OptionsResponse,
  ListReviewsResponse,
  CreateReviewInput,
  Review,
} from "../types"

export class ProductsResource {
  constructor(private client: ShopG41Client) {}

  async list(): Promise<ListProductsResponse> {
    return this.client.request("/api/products")
  }

  async get(id: number | string): Promise<GetProductResponse> {
    return this.client.request(`/api/products/${encodeURIComponent(id)}`)
  }

  async gallery(productId: number): Promise<GalleryResponse> {
    return this.client.request(`/api/products/${productId}/gallery`)
  }

  async options(productId: number): Promise<OptionsResponse> {
    return this.client.request(`/api/products/${productId}/options`)
  }

  async reviews(productId: number): Promise<ListReviewsResponse> {
    return this.client.request(`/api/products/${productId}/reviews`)
  }

  async createReview(productId: number, input: CreateReviewInput): Promise<{ review: Review }> {
    return this.client.request(`/api/products/${productId}/reviews`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  async updateReview(
    productId: number,
    reviewId: number,
    input: CreateReviewInput,
  ): Promise<{ review: Review }> {
    return this.client.request(`/api/products/${productId}/reviews/${reviewId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    })
  }

  async deleteReview(productId: number, reviewId: number): Promise<{ success: boolean }> {
    return this.client.request(`/api/products/${productId}/reviews/${reviewId}`, {
      method: "DELETE",
    })
  }
}
