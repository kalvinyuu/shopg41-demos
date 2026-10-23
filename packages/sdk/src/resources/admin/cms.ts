import type { ShopG41Client } from "../../client"
import type {
  AdminListCmsCollectionsResponse,
  AdminGetCmsCollectionResponse,
  AdminCmsCollectionCreateInput,
  AdminCmsCollectionUpdateInput,
  AdminListCmsEntriesResponse,
  AdminGetCmsEntryResponse,
  AdminCmsEntryCreateInput,
  AdminCmsEntryUpdateInput,
  AdminSimpleSuccessResponse,
} from "../../types"

export class AdminCmsResource {
  constructor(private client: ShopG41Client) {}

  collections = {
    list: async (): Promise<AdminListCmsCollectionsResponse> => {
      return this.client.request("/api/admin/cms/collections")
    },

    get: async (id: number): Promise<AdminGetCmsCollectionResponse> => {
      return this.client.request(`/api/admin/cms/collections/${id}`)
    },

    create: async (
      input: AdminCmsCollectionCreateInput,
    ): Promise<{ success: boolean; id: number }> => {
      return this.client.request("/api/admin/cms/collections", {
        method: "POST",
        body: JSON.stringify(input),
      })
    },

    update: async (
      id: number,
      input: AdminCmsCollectionUpdateInput,
    ): Promise<AdminSimpleSuccessResponse> => {
      return this.client.request(`/api/admin/cms/collections/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      })
    },

    delete: async (id: number): Promise<AdminSimpleSuccessResponse> => {
      return this.client.request(`/api/admin/cms/collections/${id}`, { method: "DELETE" })
    },
  }

  entries = {
    list: async (collectionId: number): Promise<AdminListCmsEntriesResponse> => {
      return this.client.request(`/api/admin/cms/collections/${collectionId}/entries`)
    },

    get: async (collectionId: number, entryId: number): Promise<AdminGetCmsEntryResponse> => {
      return this.client.request(`/api/admin/cms/collections/${collectionId}/entries/${entryId}`)
    },

    create: async (
      collectionId: number,
      input: AdminCmsEntryCreateInput,
    ): Promise<{ success: boolean; id: number }> => {
      return this.client.request(`/api/admin/cms/collections/${collectionId}/entries`, {
        method: "POST",
        body: JSON.stringify(input),
      })
    },

    update: async (
      collectionId: number,
      entryId: number,
      input: AdminCmsEntryUpdateInput,
    ): Promise<AdminSimpleSuccessResponse> => {
      return this.client.request(`/api/admin/cms/collections/${collectionId}/entries/${entryId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      })
    },

    delete: async (collectionId: number, entryId: number): Promise<AdminSimpleSuccessResponse> => {
      return this.client.request(`/api/admin/cms/collections/${collectionId}/entries/${entryId}`, {
        method: "DELETE",
      })
    },
  }
}
