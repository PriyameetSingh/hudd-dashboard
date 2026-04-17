import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/** Use the Supabase pooler URL (port 6543, `?pgbouncer=true&connection_limit=1`) for Vercel serverless. */
const datasourceUrl = process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    datasourceUrl
      ? {
          datasources: {
            db: {
              url: datasourceUrl,
            },
          },
        }
      : undefined,
  );

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}
