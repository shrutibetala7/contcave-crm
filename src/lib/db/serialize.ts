import type { ObjectId } from "mongodb";

/** Any Mongo-stored document: real ObjectId primary key, string references. */
export type Mongo<T extends { id: string }> = Omit<T, "id"> & { _id: ObjectId };

/**
 * _id: ObjectId -> id: string — the only shape conversion at the DB
 * boundary. Generic is inferred from the *input* (M), not asserted on the
 * output, so TypeScript can actually solve it at call sites (inferring a
 * type parameter through `Omit<T, "id">` the other way around is not
 * something the compiler can invert).
 */
export function serialize<M extends { _id: ObjectId }>(doc: M): Omit<M, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { id: _id.toHexString(), ...rest } as Omit<M, "_id"> & { id: string };
}

export function serializeAll<M extends { _id: ObjectId }>(docs: M[]): (Omit<M, "_id"> & { id: string })[] {
  return docs.map(serialize);
}

export function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const clone = { ...obj };
  delete clone[key];
  return clone;
}
