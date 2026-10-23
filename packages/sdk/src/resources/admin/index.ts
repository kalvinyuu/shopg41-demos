import type { ShopG41Client } from "../../client"
import { AdminProductsResource } from "./products"
import { AdminOrdersResource } from "./orders"
import { AdminBannersResource } from "./banners"
import { AdminSettingsResource } from "./settings"
import { AdminPlanResource } from "./plan"
import { AdminProductTypesResource } from "./productTypes"
import { AdminDataSourcesResource } from "./dataSources"
import { AdminCmsResource } from "./cms"
import { AdminEndpointsResource } from "./endpoints"
import { AdminBlogResource } from "./blog"
import { AdminIntegrationsResource } from "./integrations"
import { AdminCardResource } from "./card"
import { AdminApiKeysResource } from "./apiKeys"
import { AdminMeResource } from "./me"
import { AdminAgentResource } from "./agent"
import { AdminGameResource } from "./game"

export class AdminClient {
  readonly products: AdminProductsResource
  readonly orders: AdminOrdersResource
  readonly banners: AdminBannersResource
  readonly settings: AdminSettingsResource
  readonly plan: AdminPlanResource
  readonly productTypes: AdminProductTypesResource
  readonly dataSources: AdminDataSourcesResource
  readonly cms: AdminCmsResource
  readonly endpoints: AdminEndpointsResource
  readonly blog: AdminBlogResource
  readonly integrations: AdminIntegrationsResource
  readonly card: AdminCardResource
  readonly apiKeys: AdminApiKeysResource
  readonly me: AdminMeResource
  readonly agent: AdminAgentResource
  readonly game: AdminGameResource

  constructor(client: ShopG41Client) {
    this.products = new AdminProductsResource(client)
    this.orders = new AdminOrdersResource(client)
    this.banners = new AdminBannersResource(client)
    this.settings = new AdminSettingsResource(client)
    this.plan = new AdminPlanResource(client)
    this.productTypes = new AdminProductTypesResource(client)
    this.dataSources = new AdminDataSourcesResource(client)
    this.cms = new AdminCmsResource(client)
    this.endpoints = new AdminEndpointsResource(client)
    this.blog = new AdminBlogResource(client)
    this.integrations = new AdminIntegrationsResource(client)
    this.card = new AdminCardResource(client)
    this.apiKeys = new AdminApiKeysResource(client)
    this.me = new AdminMeResource(client)
    this.agent = new AdminAgentResource(client)
    this.game = new AdminGameResource(client)
  }
}
