import type { ShopG41Client } from "../../client"
import type {
  ListBlogResponse,
  GetBlogResponse,
  AdminBlogPostCreateInput,
  AdminBlogPostUpdateInput,
  AdminSimpleSuccessResponse,
  ListBlogUnlocksResponse,
} from "../../types"

export class AdminBlogResource {
  constructor(private client: ShopG41Client) {}

  async list(): Promise<ListBlogResponse> {
    return this.client.request("/api/admin/blog/posts")
  }

  async get(id: number): Promise<GetBlogResponse> {
    return this.client.request(`/api/admin/blog/posts/${id}`)
  }

  async create(input: AdminBlogPostCreateInput): Promise<{ success: boolean; id: number }> {
    return this.client.request("/api/admin/blog/posts", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  async update(id: number, input: AdminBlogPostUpdateInput): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/blog/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    })
  }

  async delete(id: number): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/blog/posts/${id}`, { method: "DELETE" })
  }

  async uploadImage(image: File | Blob): Promise<{ success: boolean; url: string }> {
    const fd = new FormData()
    fd.set("image", image, "upload")
    return this.client.requestMultipart("/api/admin/blog/upload", fd)
  }

  /** One-off unlocks and memberships recorded for this store. */
  async unlocks(postId?: number): Promise<ListBlogUnlocksResponse> {
    const qs = postId ? `?postId=${postId}` : ""
    return this.client.request(`/api/admin/blog/unlocks${qs}`)
  }

  /** Revoke an unlock or membership (e.g. after a refund issued in Stripe). */
  async revokeUnlock(id: number): Promise<AdminSimpleSuccessResponse> {
    return this.client.request(`/api/admin/blog/unlocks/${id}`, { method: "DELETE" })
  }
}
