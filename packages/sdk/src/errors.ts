export class ShopG41Error extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message)
    this.name = "ShopG41Error"
  }
}

export class ShopG41AuthError extends ShopG41Error {
  constructor(body?: unknown) {
    super("Authentication required", 401, body)
    this.name = "ShopG41AuthError"
  }
}

export class ShopG41ForbiddenError extends ShopG41Error {
  constructor(body?: unknown) {
    super("Forbidden", 403, body)
    this.name = "ShopG41ForbiddenError"
  }
}

export class ShopG41NotFoundError extends ShopG41Error {
  constructor(body?: unknown) {
    super("Not found", 404, body)
    this.name = "ShopG41NotFoundError"
  }
}

export class ShopG41ValidationError extends ShopG41Error {
  constructor(body?: unknown) {
    super("Validation error", 400, body)
    this.name = "ShopG41ValidationError"
  }
}

export class ShopG41ServerError extends ShopG41Error {
  constructor(body?: unknown) {
    super("Server error", 500, body)
    this.name = "ShopG41ServerError"
  }
}

export function buildError(status: number, body?: unknown): ShopG41Error {
  switch (status) {
    case 400:
      return new ShopG41ValidationError(body)
    case 401:
      return new ShopG41AuthError(body)
    case 403:
      return new ShopG41ForbiddenError(body)
    case 404:
      return new ShopG41NotFoundError(body)
    case 500:
      return new ShopG41ServerError(body)
    default:
      return new ShopG41Error(`API error ${status}`, status, body)
  }
}
