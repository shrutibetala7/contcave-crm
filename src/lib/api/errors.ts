export class NotFoundError extends Error {
  constructor(entity: string = "Resource") {
    super(`${entity} not found`);
    this.name = "NotFoundError";
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}
