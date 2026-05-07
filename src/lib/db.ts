import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const isDev = process.env.NODE_ENV === "development";
const logQueries = process.env.PRISMA_LOG_QUERIES === "1";

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? (logQueries ? ["query", "error", "warn"] : ["error", "warn"]) : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
