import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const prismaLogs =
  process.env.NODE_ENV === "development"
    ? process.env.PRISMA_LOG_QUERY === "1"
      ? ["query", "warn", "error"]
      : ["warn", "error"]
    : ["error"];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: prismaLogs
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
