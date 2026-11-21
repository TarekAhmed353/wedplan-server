import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not set. Add it to the .env file.");
}

const client = new MongoClient(uri);
const db = client.db(process.env.DB_NAME || "wedplan");

export const collections = {
  users: db.collection("user"),
  services: db.collection("services"),
  bookings: db.collection("bookings"),
  transactions: db.collection("transactions"),
};

export async function connectDB() {
  await client.connect();
  await db.command({ ping: 1 });
  return db.databaseName;
}
