import type { ShopG41Client } from "../client"
import type {
  ListBlogResponse,
  GetBlogResponse,
  ListCommentsResponse,
  PostComment,
  BlogPostCheckoutInput,
  BlogPostCheckoutResponse,
  BlogMembershipResponse,
} from "../types"

export class BlogResource {
  constructor(private client: ShopG41Client) {}

  async list(): Promise<ListBlogResponse> {
    return this.client.request("/api/blog/posts")
  }

  async get(slug: string): Promise<GetBlogResponse> {
    return this.client.request(`/api/blog/posts/${slug}`)
  }

  async comments(slug: string): Promise<ListCommentsResponse> {
    return this.client.request(`/api/blog/posts/${slug}/comments`)
  }

  async createComment(slug: string, input: { body: string }): Promise<{ comment: PostComment }> {
    return this.client.request(`/api/blog/posts/${slug}/comments`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  /** The store's membership offer, and whether the caller holds one. */
  async membership(): Promise<BlogMembershipResponse> {
    return this.client.request("/api/blog/membership")
  }

  /**
   * Start checkout for a gated post: `one_off` buys this post, `subscription`
   * starts the store membership (which opens every gated post). Returns the
   * Stripe Checkout URL to send the buyer to.
   */
  async checkout(slug: string, input: BlogPostCheckoutInput): Promise<BlogPostCheckoutResponse> {
    return this.client.request(`/api/blog/posts/${slug}/checkout`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  }
}
