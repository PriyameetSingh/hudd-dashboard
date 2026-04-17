import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

/** Use the Supabase pooler URL (port 6543, `?pgbouncer=true`) for serverless if you see slow connects or pool exhaustion. */
const datasourceUrl = process.env.DATABASE_URL;

export const prisma =
  global.prisma ??
  new PrismaClient(
    datasourceUrl
      ? {
          datasources: {
            db: {
              url: datasourceUrl,
            },
          },
        }
      : undefined
  );

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
