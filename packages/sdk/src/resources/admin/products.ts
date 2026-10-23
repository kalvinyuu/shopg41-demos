import type { ShopG41Client } from "../../client"
import type {
  AdminListProductsResponse,
  AdminProduct,
  AdminProductCreateInput,
  AdminProductUpdateInput,
  AdminSimpleSuccessResponse,
  OptionsResponse,
} from "../../types"

export class AdminProductsResource {
  constructor(private client: ShopG41Client) {}

  async list(): Promise<AdminListProductsResponse> {
    return this.client.request("/api/admin/products")
  }

  async get(id: number): Promise<{ product: AdminProduct }> {
    return this.client.request(`/api/admin/products/${id}`)
  }

  async create(input: AdminProductCreateInput): Promise<AdminSimpleSuccessResponse> {
    const fd = new FormData()
    fd.set("image", input.image, input.imageName)
    fd.set("imageName", input.imageName)
    fd.set("imageType", input.imageType ?? "product-main")
    fd.set("name", input.name)
    fd.set("price", String(input.price))
    fd.set("shopBy", input.shopBy)
    if (input.imageWidth != null) fd.set("imageWidth", String(input.imageWidth))
    if (input.imageHeight != null) fd.set("imageHeight", String(input.imageHeight))
    if (input.inUse) fd.set("inUse", "on")
    if (input.typeId != null) fd.set("typeId", String(input.typeId))
    if (input.kind) fd.set("kind", input.kind)
    if (input.fulfilment) fd.set("fulfilment", JSON.stringify(input.fulfilment))
    return this.client.requestMultipart("/api/admin/items", fd)
  }

  async update(id: number, input: AdminProductUpdateInput): Promise<AdminSimpleSuccessResponse> {
    const fd = new FormData()
    fd.set("name", input.name)
    fd.set("price", String(input.price))
    fd.set("shopBy", input.shopBy)
    if (input.image) {
      fd.set("image", input.image, input.imageName ?? "image")
      if (input.imageName) fd.set("imageName", input.imageName)
      if (input.imageType) fd.set("imageType", input.imageType)
      if (input.imageWidth != null) fd.set("imageWidth", String(input.imageWidth))
      if (input.imageHeight != null) fd.set("imageHeight", String(input.imageHeight))
    } else if (input.imageUrl) {
      fd.set("imageUrl", input.imageUrl)
    }
    if (input.inUse) fd.set("inUse", "on")
    if (input.cardTemplateId != null) fd.set("cardTemplateId", String(input.cardTemplateId))
    if (input.kind) fd.set("kind", input.kind)
    // Sent as JSON: multipart has no nested objects, and the server normalises
    // whatever it receives against the kind.
    if (input.fulfilment) fd.set("fulfilment", JSON.stringify(input.fulfilment))
    return this.client.requestMultipartPut(`/api/admin/products/${id}`, fd)
  }

  async delete(id: number): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/products/${id}`, { method: "DELETE" })
  }

  async deleteReview(id: number, reviewId: number): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/products/${id}/reviews/${reviewId}`, {
      method: "DELETE",
    })
  }

  async reviews(): Promise<{ reviews: unknown[] }> {
    return this.client.request("/api/admin/reviews")
  }

  async options(productId: number): Promise<OptionsResponse> {
    return this.client.request(`/api/admin/products/${productId}/options`)
  }

  async updateOptions(
    productId: number,
    input: { options: unknown[]; customFields: unknown[] },
  ): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/products/${productId}/options`, {
      method: "PUT",
      body: JSON.stringify(input),
    })
  }

  async variants(productId: number): Promise<{ options: unknown[]; variants: unknown[] }> {
    return this.client.request(`/api/admin/products/${productId}/variants`)
  }

  async updateVariants(
    productId: number,
    input: { variants: unknown[] },
  ): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/products/${productId}/variants`, {
      method: "PUT",
      body: JSON.stringify(input),
    })
  }
}
