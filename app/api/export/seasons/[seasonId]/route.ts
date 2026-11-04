import { NextResponse, type NextRequest } from "next/server";
import { fail, requireSession } from "@/lib/characters/api-helpers";
import { db } from "@/lib/db";
import { seasonDocx } from "@/lib/export/load";
import { docxResponse } from "@/lib/export/respond";
import { isUuid } from "@/lib/queries/library";

export async function GET(_request: NextRequest, { params }: RouteContext<"/api/export/seasons/[seasonId]">) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { seasonId } = await params;
  const document = isUuid(seasonId) ? await seasonDocx(db, seasonId) : null;
  return document ? docxResponse(document) : fail("Not found", 404);
}
