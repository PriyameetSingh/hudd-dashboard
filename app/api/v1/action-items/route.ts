import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mapActionItem(item: any) {
  const now = Date.now();
  const dueTime = item.dueDate.getTime();
  const overdueDays = dueTime < now ? Math.floor((now - dueTime) / (24 * 60 * 60 * 1000)) : undefined;

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    vertical: item.vertical?.name ?? "",
    priority: item.priority,
    dueDate: toIsoDate(item.dueDate),
    status: item.status,
    assignedTo: item.assignedTo?.name ?? "",
    reviewer: item.reviewer?.name ?? "",
    schemeId: item.scheme.code,
    daysOverdue: overdueDays,
    updates: item.updates.map((update: any) => ({
      timestamp: toIsoDate(update.timestamp),
      actor: update.createdBy?.name ?? "",
      status: update.status,
      note: update.note,
    })),
    proofFiles: item.proofs.map((proof: any) => ({
      name: proof.file.name,
      link: proof.file.url,
    })),
  };
}

export async function GET() {
  const items = await prisma.actionItem.findMany({
    include: {
      scheme: { select: { code: true } },
      vertical: { select: { name: true } },
      assignedTo: { select: { name: true } },
      reviewer: { select: { name: true } },
      updates: {
        orderBy: { timestamp: "asc" },
        include: {
          createdBy: { select: { name: true } },
        },
      },
      proofs: {
        include: {
          file: { select: { name: true, url: true } },
        },
      },
    },
    orderBy: [{ dueDate: "asc" }, { title: "asc" }],
  });

  return NextResponse.json({
    items: items.map(mapActionItem),
  });
}
