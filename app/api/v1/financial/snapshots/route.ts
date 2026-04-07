import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDbUserBySession } from "@/lib/server-rbac";

export const runtime = "nodejs";

type Body = {
  schemeCode: string;
  asOfDate: string;
  soExpenditureCr: number;
  ifmsExpenditureCr: number;
  remarks?: string;
  financialYearLabel?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Body;

  const scheme = await prisma.scheme.findUnique({ where: { code: body.schemeCode } });
  if (!scheme) {
    return NextResponse.json({ detail: "Scheme not found" }, { status: 404 });
  }

  const fy = body.financialYearLabel
    ? await prisma.financialYear.findUnique({ where: { label: body.financialYearLabel } })
    : await prisma.financialYear.findFirst({ orderBy: { endDate: "desc" } });

  if (!fy) {
    return NextResponse.json({ detail: "Financial year not found" }, { status: 404 });
  }

  const createdBy = await getDbUserBySession();
  const asOfDate = new Date(`${body.asOfDate}T00:00:00.000Z`);

  const existing = await prisma.financeExpenditureSnapshot.findFirst({
    where: {
      schemeId: scheme.id,
      financialYearId: fy.id,
      asOfDate,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.financeExpenditureSnapshot.update({
      where: { id: existing.id },
      data: {
        soExpenditureCr: body.soExpenditureCr,
        ifmsExpenditureCr: body.ifmsExpenditureCr,
        remarks: body.remarks,
        createdById: createdBy?.id ?? null,
      },
    });
  } else {
    await prisma.financeExpenditureSnapshot.create({
      data: {
        schemeId: scheme.id,
        subschemeId: null,
        financialYearId: fy.id,
        asOfDate,
        soExpenditureCr: body.soExpenditureCr,
        ifmsExpenditureCr: body.ifmsExpenditureCr,
        remarks: body.remarks,
        createdById: createdBy?.id ?? null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
