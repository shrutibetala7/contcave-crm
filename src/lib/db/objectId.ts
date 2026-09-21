import { ObjectId } from "mongodb";

export class InvalidIdError extends Error {
  constructor(id: string) {
    super(`Invalid id: ${id}`);
    this.name = "InvalidIdError";
  }
}

/** Convert a serialized id string to the ObjectId used for _id lookups. */
export function toObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) throw new InvalidIdError(id);
  return new ObjectId(id);
}
