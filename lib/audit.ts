import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export async function logAudit(
  actorUserId: string | null | undefined,
  actionType: string,
  entityType: string,
  entityId: string | null | undefined,
  before: JsonValue | null,
  after: JsonValue | null,
  metadata?: JsonValue | null,
) {
  await prisma.auditLog.create({
    data: {
      actorUserId: actorUserId ?? null,
      actionType,
      entityType,
      entityId: entityId ?? null,
      before: before === null ? Prisma.JsonNull : (before as Prisma.InputJsonValue),
      after: after === null ? Prisma.JsonNull : (after as Prisma.InputJsonValue),
      metadata: metadata === null || metadata === undefined ? undefined : (metadata as Prisma.InputJsonValue),
    },
  });
}

export function getAuditRequestContext(request: NextRequest): { ip: string | null; userAgent: string | null } {
  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null;
  const userAgent = request.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}
