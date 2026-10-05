import { Db, MongoClient } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoIndexesReady: Promise<void> | undefined;
}

// Lazy on purpose: importing this module must not throw, so `next build`
// works without secrets. The cached promise is shared per server instance
// (also across dev hot reloads, which would otherwise leak connections).
function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (see .env.example).");
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri)
      .connect()
      .catch((err) => {
        global._mongoClientPromise = undefined; // allow a retry on the next request
        throw err;
      });
  }
  return global._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const db = (await getClient()).db(process.env.MONGODB_DB ?? "taskmaster");
  if (!global._mongoIndexesReady) {
    global._mongoIndexesReady = Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db.collection("habits").createIndex({ userId: 1, createdAt: 1 }),
    ])
      .then(() => undefined)
      .catch((err) => {
        global._mongoIndexesReady = undefined;
        throw err;
      });
  }
  await global._mongoIndexesReady;
  return db;
}
