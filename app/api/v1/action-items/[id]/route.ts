import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDbUserBySession } from "@/lib/server-rbac";

export const runtime = "nodejs";

type Body = {
  status?: "OPEN" | "IN_PROGRESS" | "PROOF_UPLOADED" | "UNDER_REVIEW" | "COMPLETED" | "OVERDUE";
  note?: string;
};

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

async function getActionItemById(id: string) {
  return prisma.actionItem.findUnique({
    where: { id },
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
  });
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const item = await getActionItemById(id);
  if (!item) {
    return NextResponse.json({ detail: "Action item not found" }, { status: 404 });
  }
  return NextResponse.json({ item: mapActionItem(item) });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as Body;

  const current = await prisma.actionItem.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ detail: "Action item not found" }, { status: 404 });
  }

  const actor = await getDbUserBySession();

  if (body.status && body.status !== current.status) {
    await prisma.actionItem.update({
      where: { id },
      data: { status: body.status },
    });
  }

  if (body.note && body.note.trim().length > 0) {
    await prisma.actionItemUpdate.create({
      data: {
        actionItemId: id,
        timestamp: new Date(),
        status: body.status ?? current.status,
        note: body.note,
        createdById: actor?.id ?? null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
