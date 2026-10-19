import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Neon closes idle connections and suspends idle computes: drop our own idle clients
    // first, keep live ones alive through NAT/proxies, and give a waking compute time to answer.
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
  });
  // A pooled idle client closed by the server emits "error" on the pool; without a listener
  // Node treats it as unhandled and crashes the process. The pool discards that client on its own.
  pool.on("error", (error) => {
    console.error("[prisma] Idle database connection closed by the server:", error.message);
  });

  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

// Reused across dev hot reloads — otherwise every reload opens a new pool and leaks the old
// one's connections to the database.
const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
