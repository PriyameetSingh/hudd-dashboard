import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

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
