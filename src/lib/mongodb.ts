import { MongoClient, type Db } from "mongodb";

/**
 * Cached Mongo connection across warm serverless invocations (spec §7).
 * Skipping this caching is "the single most common way this stack falls
 * over" — do not remove it.
 */

declare global {
  var _mongo: { conn: Promise<Db> | null } | undefined;
}

function connect(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;

  if (!uri || !dbName) {
    throw new Error(
      "MONGODB_URI / MONGODB_DB are not set. Copy .env.example to .env.local and fill in real values."
    );
  }

  const client = new MongoClient(uri, { maxPoolSize: 10 });
  return client.connect().then((c) => c.db(dbName));
}

export function getDb(): Promise<Db> {
  const cached = global._mongo ?? (global._mongo = { conn: null });
  if (!cached.conn) {
    cached.conn = connect();
  }
  return cached.conn;
}
