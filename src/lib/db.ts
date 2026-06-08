/**
 * lib/db.ts
 * Singleton Prisma Client for Prisma v7.
 *
 * The Prisma 7 generator emits a driverless (adapter-based) client build.
 * This means PrismaClient ALWAYS requires an adapter at runtime, regardless
 * of how prisma.config.ts is configured (the config only affects CLI/migrations).
 *
 * We use the @prisma/adapter-pg driver adapter to supply the PostgreSQL connection.
 * The singleton pattern prevents creating multiple connections on Next.js hot-reload.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
      "Please add it to your .env.local file."
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
