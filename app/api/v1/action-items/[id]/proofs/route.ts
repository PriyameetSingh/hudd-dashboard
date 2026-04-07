import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDbUserBySession } from "@/lib/server-rbac";

export const runtime = "nodejs";

type Body = {
  name: string;
  url: string;
};

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as Body;

  const actionItem = await prisma.actionItem.findUnique({ where: { id } });
  if (!actionItem) {
    return NextResponse.json({ detail: "Action item not found" }, { status: 404 });
  }

  const actor = await getDbUserBySession();

  const existingFile = await prisma.file.findFirst({
    where: {
      name: body.name,
      url: body.url,
    },
    select: { id: true },
  });

  const file = existingFile
    ? await prisma.file.update({
        where: { id: existingFile.id },
        data: { uploadedById: actor?.id ?? null },
      })
    : await prisma.file.create({
        data: {
          name: body.name,
          url: body.url,
          uploadedById: actor?.id ?? null,
        },
      });

  await prisma.actionItemProof.upsert({
    where: {
      actionItemId_fileId: {
        actionItemId: actionItem.id,
        fileId: file.id,
      },
    },
    update: {
      uploadedById: actor?.id ?? null,
    },
    create: {
      actionItemId: actionItem.id,
      fileId: file.id,
      uploadedById: actor?.id ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
