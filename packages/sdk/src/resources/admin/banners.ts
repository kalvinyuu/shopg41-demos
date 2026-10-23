import type { ShopG41Client } from "../../client"
import type {
  AdminListImagesResponse,
  AdminListBannersResponse,
  AdminGetBannerResponse,
  AdminBannerUpdateInput,
  AdminSimpleSuccessResponse,
} from "../../types"

export class AdminBannersResource {
  constructor(private client: ShopG41Client) {}

  async list(): Promise<AdminListBannersResponse> {
    return this.client.request("/api/banners")
  }

  async images(): Promise<AdminListImagesResponse> {
    return this.client.request("/api/admin/images")
  }

  async get(imageId: number): Promise<AdminGetBannerResponse> {
    return this.client.request(`/api/admin/banners/${imageId}`)
  }

  async update(
    imageId: number,
    input: AdminBannerUpdateInput,
  ): Promise<AdminSimpleSuccessResponse> {
    const fd = new FormData()
    fd.set("bannerName", input.bannerName)
    if (input.image) {
      fd.set("image", input.image, input.imageName ?? "image")
      if (input.imageName) fd.set("imageName", input.imageName)
    }
    if (input.imageWidth != null) fd.set("imageWidth", String(input.imageWidth))
    if (input.imageHeight != null) fd.set("imageHeight", String(input.imageHeight))
    if (input.bannerType) fd.set("bannerType", input.bannerType)
    if (input.bannerLink) fd.set("bannerLink", input.bannerLink)
    if (input.bannerDescription) fd.set("bannerDescription", input.bannerDescription)
    if (input.startDate) fd.set("startDate", input.startDate)
    if (input.endDate) fd.set("endDate", input.endDate)
    if (input.isActive) fd.set("isActive", "on")
    if (input.displayOrder != null) fd.set("displayOrder", String(input.displayOrder))
    return this.client.requestMultipartPut(`/api/admin/banners/${imageId}`, fd)
  }

  async delete(imageId: number): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/banners/${imageId}`, { method: "DELETE" })
  }
}
