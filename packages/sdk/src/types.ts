/**
 * What a listing is, and therefore how it is fulfilled. Mirrors
 * `productKindValues` on the server; a client may talk to a server that predates
 * a new kind, so treat an unknown string as "not understood" rather than
 * crashing.
 */
export type ProductKind = "physical" | "digital" | "service" | "food" | "subscription" | "booking"

export type RecurringInterval = "day" | "week" | "month"

/** Kind-specific settings. Only the keys for the product's own kind are used. */
export interface FulfilmentConfig {
  /** digital: where the customer collects the goods (`r2:<key>` presigns). */
  assetUrl?: string
  assetNote?: string
  maxDownloads?: number
  /** service/booking: how long the work or session takes. */
  durationMinutes?: number
  serviceMode?: "remote" | "onsite" | "async"
  leadTimeDays?: number
  /** food */
  prepMinutes?: number
  deliveryWindowMinutes?: number
  pickupAvailable?: boolean
  deliveryRadiusKm?: number
  deliveryFee?: number
  /** subscription */
  interval?: RecurringInterval
  intervalCount?: number
  trialDays?: number
  subscriptionFulfilment?: "delivery" | "digital" | "service"
  /** booking */
  bookingUrl?: string
  bookSumServiceId?: number
  bookSumResourceId?: number
  depositPercent?: number
}

export interface Product {
  id: number
  name: string
  slug: string | null
  image: string
  hoverImage: string | null
  video: string | null
  metaTitle: string | null
  metaDescription: string | null
  price: number
  shopBy: string
  price_id: string
  inUse: boolean
  /** How this listing is fulfilled. Absent on servers older than the field. */
  kind?: ProductKind
  fulfilment?: FulfilmentConfig
  typeId: number | null
  cardTemplateId: number | null
  /**
   * Aspect ratio of the listing's media (`width / height` of its poster image).
   * Null when the URL matches no stored image. Lets a client size a card to
   * the photo itself — a justified grid — without measuring it in the browser.
   */
  mediaAspect?: number | null
}

export interface ProductImage {
  id: number
  url: string
  width: number
  height: number
  name: string
  type: string
  productId: number | null
}

export interface ProductOptionValue {
  id: number
  optionId: number
  value: string
  priceAdjustment: number
  displayOrder: number
}

export interface ProductOption {
  id: number
  productId: number
  name: string
  displayOrder: number
  isRequired: boolean
  values: ProductOptionValue[]
}

export interface ProductCustomField {
  id: number
  productId: number
  name: string
  type: "text" | "textarea"
  isRequired: boolean
  priceAdjustment: number
  validation: { minLength?: number; maxLength?: number } | null
  displayOrder: number
}

export interface ProductVariant {
  id: number
  productId: number
  sku: string
  price: number | null
  stock: number
  trackInventory: boolean
  lowStockThreshold: number | null
  optionValueIds: number[]
}

export interface Banner {
  bannerId: number
  imageUrl: string | null
  name: string
  description: string | null
  linkUrl: string | null
}

export interface PostContentNode {
  type: string
  attrs?: Record<string, unknown>
  content?: PostContentNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

export interface PostContent {
  type: "doc"
  content?: PostContentNode[]
}

/** Who may read a post's body. */
export type PostAccess = "public" | "members" | "paid"

/** The store-wide subscription that opens every gated post. */
export interface MembershipSettings {
  enabled: boolean
  name: string
  price: number
  interval: "day" | "week" | "month"
  intervalCount: number
}

/** Whether the caller may read a post, and what it costs if not. */
export interface BlogPaywall {
  access: PostAccess
  locked: boolean
  unlocked: boolean
  via: "public" | "membership" | "one_off" | "owner" | null
  currency: string
  /** One-off unlock price in major units, when the post is sold on its own. */
  price: number | null
  membership: MembershipSettings | null
}

export interface BlogPost {
  id: number
  title: string
  slug: string
  content: PostContent
  excerpt: string | null
  featuredImage: string | null
  /** Optional lead video (YouTube/Vimeo link or a video file URL). */
  videoUrl?: string | null
  access?: PostAccess
  price?: number | null
  previewBlocks?: number
  status: "draft" | "published"
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  /** Present on public reads; absent from admin responses. */
  paywall?: BlogPaywall
}

export interface BlogPostCheckoutInput {
  /** Buy this post, or start the store membership. */
  kind: "one_off" | "subscription"
  /** Used as the Stripe receipt address for a signed-out buyer. */
  email?: string
}

export interface BlogPostCheckoutResponse {
  url?: string
  sessionId?: string
  alreadyUnlocked?: boolean
}

export interface BlogMembershipResponse {
  membership: MembershipSettings | null
  currency: string
  member: boolean
}

export interface AdminBlogUnlock {
  id: number
  postId: number | null
  userId: number | null
  customerEmail: string | null
  kind: "one_off" | "subscription"
  status: "active" | "canceled" | "refunded"
  amount: number
  currency: string
  currentPeriodEnd: string | null
  createdAt: string
  postTitle: string | null
  postSlug: string | null
}

export interface ListBlogUnlocksResponse {
  unlocks: AdminBlogUnlock[]
}

export interface CmsEntry {
  id: number
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: number
  specificItemId: number
  price: number
  selectedOptions: { optionName: string; optionValue: string; priceAdjustment: number }[]
  customAttributes: { fieldName: string; type: string; value: string; priceAdjustment: number }[]
  message: string | null
  productName: string | null
  productImage: string | null
}

export interface OrderAddress {
  id: number
  name: string
  streetAddress: string
  city: string
  postCode: string
  country: string
}

export interface Order {
  id: number
  orderDate: string
  totalAmount: number
  orderStatus: string
  items: OrderItem[]
  address: OrderAddress | null
}

export interface SiteSettingsAnalyticsConfig {
  provider: string
  config: Record<string, string>
}

// Response shapes

export interface ListProductsResponse {
  products: Product[]
}

export interface GetProductResponse {
  product: Product
}

export interface GalleryResponse {
  images: ProductImage[]
}

export interface OptionsResponse {
  options: ProductOption[]
  customFields: ProductCustomField[]
  variants: ProductVariant[]
}

export interface Review {
  id: number
  productId: number
  rating: number
  title: string | null
  body: string | null
  verifiedPurchase: boolean
  createdAt: string | Date
  authorName: string | null
  mine?: boolean
}

export interface ListReviewsResponse {
  reviews: Review[]
  average: number
  count: number
}

export interface CreateReviewInput {
  rating: number
  title?: string
  body?: string
}

export interface ListBannersResponse {
  banners: Banner[]
}

export interface ListBlogResponse {
  posts: BlogPost[]
  /** True when the caller holds an active membership. */
  member?: boolean
}

export interface PostComment {
  id: number
  postId: number
  body: string
  authorName: string | null
  createdAt: string | Date
}

export interface ListCommentsResponse {
  comments: PostComment[]
}

export interface GetBlogResponse {
  post: BlogPost
  paywall?: BlogPaywall
}

export interface ListCmsResponse {
  entries: CmsEntry[]
}

export interface GetCmsResponse {
  entry: CmsEntry
}

export interface GetSettingsResponse {
  settings: Record<string, unknown>
}

export interface GetAnalyticsResponse {
  analytics: SiteSettingsAnalyticsConfig[]
}

/**
 * The ergonomic basket shape. `checkout.createSession` resolves these items
 * against the store's public catalogue and sends {@link CartDetails} — which is
 * what the endpoint actually accepts — so callers never handle `price_id`s.
 */
export interface CreateCheckoutRequest {
  items: Array<{
    productId: number
    variantId?: number
    quantity: number
    options?: Array<{ optionName: string; optionValue: string }>
    customAttributes?: Array<{ fieldName: string; value: string }>
  }>
}

/** One line of the map `POST /api/checkout/session` accepts. */
export interface CartLine {
  id: string
  /** The product's Stripe price id: what the server matches its inventory on. */
  price_id: string
  name: string
  price: number
  currency: string
  image: string
  quantity: number
  product_data: {
    data: Array<{
      productId: number | string
      variantId?: number | null
      options: Array<{ optionName: string; optionValue: string; priceAdjustment: number }>
      customAttributes: Array<{
        fieldName: string
        value: string
        type: "text" | "textarea"
        priceAdjustment: number
      }>
      price: number
      scheduledFor?: string | null
      deliveryMethod?: "delivery" | "pickup"
    }>
    userID?: string | null
  }
}

/** The basket as the endpoint receives it: keyed by product id. */
export type CartDetails = Record<string, CartLine>

export interface CreateCheckoutResponse {
  sessionId: string
  url: string
}

export interface ListOrdersResponse {
  orders: Order[]
}

export type EndpointMethod = "GET" | "POST" | "PUT" | "DELETE"

export interface EndpointCallOptions {
  method?: EndpointMethod
  body?: unknown
  headers?: Record<string, string>
}

export interface ApiErrorResponse {
  error: string
  details?: unknown
}

// ============================================================================
// Admin types
// ============================================================================

export interface AdminImage {
  id: number
  url: string
  width: number
  height: number
  name: string
  type: string
  productId: number | null
}

export interface AdminOrder {
  id: number
  orderDate: string
  totalAmount: number
  orderStatus: string
  trackingNumber: string | null
  trackingCarrier: string | null
  trackingUrl: string | null
  labelUrl: string | null
  items: OrderItem[]
  address: OrderAddress | null
}

export interface AdminProduct {
  id: number
  name: string
  slug: string | null
  price: number
  shopBy: string
  image: string
  hoverImage: string | null
  video: string | null
  metaTitle: string | null
  metaDescription: string | null
  inUse: boolean
  typeId: number | null
  cardTemplateId: number | null
  images: AdminImage[]
  options: ProductOption[]
  variants: ProductVariant[]
}

export interface OrderStatusValues {
  valid: string[]
}

export interface PlanInfo {
  id: number
  name: string
  limits: {
    productLimit: number
    storeLimit: number
    amountUsers: number
    applicationFeePercent: number
    applicationFeeFixed: number
    showAds: boolean
    seoEnabled: boolean
  }
}

export interface SubscriptionInfo {
  stripeSubscriptionId: string | null
  status: string
  periodStart: string | null
  periodEnd: string | null
  trialStart: string | null
  trialEnd: string | null
  cancelAtPeriodEnd: boolean
}

export interface PlanUsage {
  productCount: number
  productLimit: number
}

export interface TenantBilling {
  stripeSubscriptionId: string | null
  currentPeriodEnd: string | null
  planId: number
}

export interface AdminProductType {
  id: number
  name: string
  description: string | null
  productCount: number
  options: Array<{
    id: number
    typeId: number
    name: string
    displayOrder: number
    isRequired: boolean
    values: Array<{
      id: number
      typeOptionId: number
      value: string
      priceAdjustment: number
      displayOrder: number
    }>
  }>
  customFields: Array<{
    id: number
    typeId: number
    name: string
    type: string
    isRequired: boolean
    priceAdjustment: number
    validation: { minLength?: number; maxLength?: number } | null
    displayOrder: number
  }>
}

export interface DataSource {
  id: number
  name: string
  kind: string
  enabled: boolean
  connectedAt: string | null
  lastTestedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DataSourceConfig {
  host?: string
  port?: string
  database?: string
  user?: string
  password?: string
  url?: string
  secret?: string
  [key: string]: string | undefined
}

export interface AdminEndpoint {
  id: number
  name: string
  method: string
  path: string
  handlerKind: string
  handlerConfig: Record<string, unknown>
  enabled: boolean
  status: string
  createdAt: string
  updatedAt: string
}

export interface AdminCmsCollection {
  id: number
  name: string
  slug: string
  description: string | null
  fields: Array<{
    key: string
    label: string
    type: string
    required?: boolean
    options?: string[]
    validation?: Record<string, unknown>
  }>
  dataSourceId: number | null
  status: string
  entryCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminCmsEntry {
  id: number
  collectionId: number
  data: Record<string, unknown>
  status: string
  createdAt: string
  updatedAt: string
}

export interface AdminCardTemplate {
  id: number
  tenantId: number
  name: string
  width: number
  height: number
  bleed: number
  design: unknown | null
  createdAt: string
  updatedAt: string
}

export interface AdminApiKey {
  id: number
  name: string
  keyPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
  revokedAt: string | null
}

export interface AdminIntegration {
  id: string
  kind: string
  displayName: string
  description: string
  authMethod: string
  configFields: Array<{ key: string; label: string; required: boolean }>
  connected: boolean
  enabled: boolean
  connectedAt: string | null
  lastSyncAt: string | null
}

// Admin response shapes

export interface AdminListProductsResponse {
  products: AdminProduct[]
}

export interface AdminGetOrderResponse {
  order: AdminOrder
}

export interface AdminListOrdersResponse {
  orders: AdminOrder[]
}

export interface AdminListImagesResponse {
  images: AdminImage[]
}

export interface AdminListBannersResponse extends ListBannersResponse {}

export interface AdminGetBannerResponse {
  image: AdminImage
  banner: {
    bannerId: number
    image_id: number
    name: string
    type: string
    linkUrl: string | null
    description: string | null
    startDate: string | null
    endDate: string | null
    isActive: boolean
    displayOrder: number
  }
}

export interface AdminGetPlanResponse {
  plan: PlanInfo
  subscription: SubscriptionInfo
  usage: PlanUsage
  tenant: TenantBilling
}

export interface AdminListProductTypesResponse {
  productTypes: AdminProductType[]
}

export interface AdminGetProductTypeResponse {
  productType: AdminProductType
}

export interface AdminListDataSourcesResponse {
  dataSources: DataSource[]
}

export interface AdminGetDataSourceResponse {
  id: number
  name: string
  kind: string
  enabled: boolean
  config: DataSourceConfig
  connectedAt: string | null
  lastTestedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminListEndpointsResponse {
  endpoints: AdminEndpoint[]
}

export interface AdminListCmsCollectionsResponse {
  collections: AdminCmsCollection[]
}

export interface AdminGetCmsCollectionResponse {
  collection: AdminCmsCollection
}

export interface AdminListCmsEntriesResponse {
  entries: AdminCmsEntry[]
}

export interface AdminGetCmsEntryResponse {
  id: number
  collectionId: number
  data: Record<string, unknown>
  status: string
  createdAt: string
  updatedAt: string
}

export interface AdminListCardTemplatesResponse {
  templates: AdminCardTemplate[]
}

export interface AdminGetCardTemplateResponse {
  template: AdminCardTemplate
}

export interface AdminListApiKeysResponse {
  keys: AdminApiKey[]
}

export interface AdminCreateApiKeyResponse {
  success: boolean
  id: number
  key: string
}

export interface AdminRevokeApiKeyResponse {
  success: boolean
}

export interface AdminListIntegrationsResponse {
  integrations: AdminIntegration[]
}

export interface AdminConnectIntegrationResponse {
  success: boolean
  provider: string
}

export interface AdminTestIntegrationResponse {
  ok: boolean
  error?: string
}

export interface AdminMeResponse {
  isAdmin: boolean
  viaApiKey: boolean
}

export interface AdminSimpleSuccessResponse {
  success: boolean
}

export interface AgentMessage {
  role: "user" | "assistant"
  content: string
}

export type AgentPendingAction =
  | {
      type: "update_order_status"
      params: { orderId: number; status: string }
      summary: string
    }
  | {
      type: "update_product_price"
      params: { productId: number; price: number }
      summary: string
    }

export interface AgentUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd: number
  allowanceUsd: number
  overageUsd: number
  periodStart: string
  periodEnd: string
  blocked: boolean
}

export interface AgentChatInput {
  messages: AgentMessage[]
  model?: string
}

export interface AgentChatResponse {
  reply: string
  pendingActions: AgentPendingAction[]
  usage: AgentUsage
}

export interface AdminProductCreateInput {
  name: string
  slug?: string
  /** Listing type. Defaults to "physical" on the server. */
  kind?: ProductKind
  /** Settings for that kind; validated server-side (e.g. a download needs a URL). */
  fulfilment?: FulfilmentConfig
  metaTitle?: string
  metaDescription?: string
  price: number
  shopBy: string
  image: File | Blob
  imageName: string
  imageType?: string
  imageWidth?: number
  imageHeight?: number
  inUse?: boolean
  typeId?: number
}

export interface AdminProductUpdateInput {
  name: string
  slug?: string
  /** Changing this replaces the kind's settings; omit to leave both as they are. */
  kind?: ProductKind
  fulfilment?: FulfilmentConfig
  metaTitle?: string
  metaDescription?: string
  hoverImage?: File | Blob
  hoverImageUrl?: string
  video?: File | Blob
  videoUrl?: string
  price: number
  shopBy: string
  image?: File | Blob
  imageUrl?: string
  imageType?: string
  imageName?: string
  imageWidth?: number
  imageHeight?: number
  inUse?: boolean
  cardTemplateId?: number
}

export interface AdminBannerUpdateInput {
  bannerName: string
  image?: File | Blob
  imageName?: string
  imageWidth?: number
  imageHeight?: number
  bannerType?: string
  bannerLink?: string
  bannerDescription?: string
  startDate?: string
  endDate?: string
  isActive?: boolean
  displayOrder?: number
}

export interface OrderStatusUpdateInput {
  status: string
}

export interface OrderTrackingUpdateInput {
  trackingNumber?: string | null
  trackingCarrier?: string | null
  trackingUrl?: string | null
}

export interface AdminSettingsUpdateInput {
  [key: string]: unknown
}

export interface AdminProductTypeCreateInput {
  name: string
  description?: string
}

export interface AdminProductTypeUpdateInput {
  name?: string
  description?: string
  options?: Array<{
    id?: number | null
    name: string
    isRequired?: boolean
    displayOrder?: number
    values: Array<{
      id?: number | null
      value: string
      priceAdjustment?: number
      displayOrder?: number
    }>
  }>
  customFields?: Array<{
    id?: number | null
    name: string
    type: string
    isRequired?: boolean
    priceAdjustment?: number
    displayOrder?: number
    validation?: { minLength?: number; maxLength?: number } | null
  }>
}

export interface AdminDataSourceCreateInput {
  name: string
  kind: string
  config: Record<string, string>
}

export interface AdminDataSourceUpdateInput {
  name?: string
  enabled?: boolean
  config?: Record<string, string>
}

export interface AdminEndpointCreateInput {
  name: string
  method: string
  path: string
  handlerKind?: string
  handlerConfig?: Record<string, unknown>
  status?: string
}

export interface AdminEndpointUpdateInput {
  name?: string
  handlerConfig?: Record<string, unknown>
  enabled?: boolean
  status?: string
}

export interface AdminCmsCollectionCreateInput {
  name: string
  slug?: string
  description?: string
  fields: Array<{
    key: string
    label: string
    type: string
    required?: boolean
    options?: string[]
    validation?: Record<string, unknown>
  }>
  dataSourceId?: number | null
  status?: string
}

export interface AdminCmsCollectionUpdateInput {
  name?: string
  slug?: string
  description?: string | null
  fields?: Array<{
    key: string
    label: string
    type: string
    required?: boolean
    options?: string[]
    validation?: Record<string, unknown>
  }>
  dataSourceId?: number | null
  status?: string
}

export interface AdminCmsEntryCreateInput {
  data: Record<string, unknown>
  status?: string
}

export interface AdminCmsEntryUpdateInput {
  data?: Record<string, unknown>
  status?: string
}

export interface AdminCardTemplateCreateInput {
  name: string
  width: number
  height: number
  bleed?: number
  design?: unknown
}

export interface AdminCardTemplateUpdateInput {
  name?: string
  width?: number
  height?: number
  bleed?: number
  design?: unknown
}

export interface AdminBlogPostCreateInput {
  title: string
  slug?: string
  content: PostContent
  excerpt?: string | null
  featuredImage?: string | null
  /** Optional lead video (YouTube/Vimeo link or a video file URL). */
  videoUrl?: string | null
  status?: string
  /** Paywall: everyone, members only, or sold as a one-off unlock. */
  access?: PostAccess
  price?: number | null
  previewBlocks?: number
}

export interface AdminBlogPostUpdateInput {
  title?: string
  slug?: string
  content?: PostContent
  excerpt?: string | null
  featuredImage?: string | null
  videoUrl?: string | null
  status?: string
  access?: PostAccess
  price?: number | null
  previewBlocks?: number
}

export interface AdminIntegrationConnectInput {
  [key: string]: string
}

export interface AdminCreateApiKeyInput {
  name?: string
}

export interface PipelineStep {
  type: "collection" | "passthrough" | "query" | "function"
  collectionId?: number
  dataSourceId?: number
  sql?: string
  params?: unknown[]
  timeout?: number
  maxRows?: number
}

export interface DataSourceQueryResult {
  rows: Record<string, unknown>[]
  rowCount: number
}

// ---------------------------------------------------------------------------
// Buying & Value Intelligence (crowio)
// ---------------------------------------------------------------------------

export interface BuyingSourcePolicy {
  canStoreRaw: boolean
  rawRetentionSeconds?: number
  canStoreListings: boolean
  listingRetentionSeconds?: number
  canStorePriceObservations: boolean
  canAggregatePrices: boolean
  canCalculateDerivedAnalytics: boolean
  canCalculateValuation: boolean
  canDisplaySourceData: boolean
  attributionRequired: boolean
}

export interface BuyingSource {
  id: number
  name: string
  type: string
  region: string
  apiEnabled: boolean
  policyId: string
  credentialsConfigured: boolean
  policy: BuyingSourcePolicy
}

export interface BuyingSourcesResponse {
  sources: BuyingSource[]
}

export interface BuyingObservationInput {
  externalReference?: string
  price: number
  currency: string
  quantity: number
  condition: string
  basis: "ASKING" | "TRANSACTION" | "RETAIL"
  shippingCost?: number | null
  vatIncluded?: boolean | null
  seller?: string
  productStatus?: string
  region: string
}

export interface BuyingListingSummary {
  externalId: string
  title: string
  url?: string
  price?: number | null
  currency?: string
  condition?: string
  seller?: string
  availability?: string
  shippingCost?: number | null
}

export interface BuyingNormalizedProduct {
  canonicalName: string
  manufacturer?: string
  model?: string
  mpn?: string
  gtin?: string
  category?: string
  conditionType?: string
  attributes?: Record<string, unknown>
}

export interface BuyingSearchResult {
  source: string
  sourceId: number
  policyId: string
  product: BuyingNormalizedProduct
  productId: number | null
  listings: BuyingListingSummary[]
  observations: BuyingObservationInput[]
  observationsStored: boolean
}

export interface BuyingSearchResponse {
  query: string
  region: string
  resultCount: number
  productIds: number[]
  results: BuyingSearchResult[]
  attribution: string[]
}

export interface BuyingProductRecord {
  id: number
  canonicalName: string
  manufacturer: string | null
  model: string | null
  mpn: string | null
  gtin: string | null
  category: string | null
  conditionType: string
  attributes: Record<string, unknown>
}

export interface BuyingProductResponse {
  product: BuyingProductRecord
}

export interface BuyingPriceObservation {
  id: number
  productId: number
  sourceId: number
  externalReference: string | null
  price: number
  currency: string
  quantity: number
  condition: string
  basis: "ASKING" | "TRANSACTION" | "RETAIL"
  shippingCost: number | null
  vatIncluded: boolean | null
  seller: string | null
  productStatus: string | null
  region: string
  observedAt: string
}

export interface BuyingPricesResponse {
  observations: BuyingPriceObservation[]
}

export interface BuyingSourceBreakdown {
  sourceId: number
  name: string
  count: number
  min: number | null
  median: number | null
  max: number | null
}

export interface BuyingMarketRange {
  low: number | null
  high: number | null
  min: number | null
  max: number | null
}

export interface BuyingDataFreshness {
  newestAt: string | null
  oldestAt: string | null
  maxAgeHours: number | null
}

export interface BuyingDistribution {
  basis: "ASKING" | "TRANSACTION" | "RETAIL"
  condition: string
  currency: string
  count: number
  stats: {
    count: number
    min: number | null
    max: number | null
    median: number | null
    p25: number | null
    p75: number | null
    mean: number | null
    range: number | null
    dispersion: number | null
  }
  sources: BuyingSourceBreakdown[]
  dataFreshness: BuyingDataFreshness
  confidence: number
  trimmedCount: number
  discontinuedCount: number
}

export interface BuyingMarketResponse {
  product: BuyingProductRecord
  retail: BuyingDistribution | null
  secondary: BuyingDistribution | null
  staleExcluded: number
  staleDays: number
  methodologyVersion: string
}

export interface BuyingProductInput {
  name: string
  condition?: string
  manufacturer?: string
  model?: string
  mpn?: string
  gtin?: string
}

export interface BuyingListingInput {
  price?: number
  currency?: string
  url?: string
  title?: string
  seller?: string
  condition?: string
  shippingCost?: number
}

export interface BuyingAnalyseInput {
  productName?: string
  title?: string
  name?: string
  url?: string
  price?: number
  currency?: string
  condition?: string
  basis?: "ASKING" | "TRANSACTION" | "RETAIL"
  manufacturer?: string
  model?: string
  mpn?: string
  gtin?: string
  shippingCost?: number
  region?: string
  product?: {
    name?: string
    condition?: string
    manufacturer?: string
    model?: string
    mpn?: string
    gtin?: string
  }
  listing?: BuyingListingInput
}

export interface BuyingAnalyseResponse {
  item: {
    name: string
    canonicalProduct: string | null
    matchedProductId: number | null
    matchConfidence: number
    matchMethod: string
  }
  market: {
    retail: BuyingDistribution | null
    secondary: BuyingDistribution | null
  }
  listing: {
    price: number | null
    deliveredPrice: number | null
    currency: string
    condition: string
    basis: string | null
    url: string | null
  }
  assessment: {
    position: "below_median" | "at_median" | "above_median"
    percentile: number
    basisUsed: string | null
  } | null
  evidence: string[]
  freshness: BuyingDataFreshness
  confidence: { label: "low" | "medium" | "high"; score: number }
  methodologyVersion: string
  caveats: string[]
}

export interface BuyingWatchlist {
  id: number
  productId: number
  targetPrice: number | null
  note: string | null
  createdAt: string
  canonicalName: string | null
  manufacturer: string | null
  mpn: string | null
}

export interface BuyingWatchlistsResponse {
  watchlists: BuyingWatchlist[]
}

export interface BuyingWatchlistCreateInput {
  product: BuyingProductInput
  targetPrice?: number
  note?: string
}

export interface BuyingWatchlistCreateResponse {
  success: boolean
  productId: number
}

export interface BuyingSimpleSuccessResponse {
  success: boolean
}

// ---- Game (World of the Great Khan in-world storefronts) ----

export interface GameStore {
  subdomain: string
  name: string
  worldU: number
  worldZ: number
  icon: string | null
}

export interface ListGameStoresResponse {
  stores: GameStore[]
}

export interface GetGameStoreProductsResponse {
  store: { subdomain: string; name: string }
  products: Product[]
}

export interface GameStoreBlock {
  dx: number
  dy: number
  dz: number
  id: number
}

export interface GameStorefront {
  id: number
  tenantId: number
  enabled: boolean
  worldU: number
  worldZ: number
  name: string | null
  design: GameStoreBlock[]
  designVersion: number
}

export interface SaveGameStorefrontInput {
  enabled?: boolean
  worldU?: number
  worldZ?: number
  name?: string | null
  design?: GameStoreBlock[]
}
