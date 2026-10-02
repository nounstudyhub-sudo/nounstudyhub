import mongoose from "mongoose";

type MongooseCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  __nounStudyHubMongoose?: MongooseCache;
};

const cache = globalForMongoose.__nounStudyHubMongoose ?? {
  connection: null,
  promise: null,
};

globalForMongoose.__nounStudyHubMongoose = cache;

export async function connectToDatabase() {
  if (cache.connection && mongoose.connection.readyState === 1) return cache.connection;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured.");

  if (!cache.promise) cache.promise = mongoose.connect(uri);

  try {
    cache.connection = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }

  return cache.connection;
}
