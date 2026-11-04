import { NextResponse, type NextRequest } from "next/server";
import { fail, requireSession } from "@/lib/characters/api-helpers";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/queries/library";
import { listDeleted } from "@/lib/structure/season";

export async function GET(_request: NextRequest, { params }: RouteContext<"/api/seasons/[seasonId]/deleted">) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { seasonId } = await params;
  if (!isUuid(seasonId)) return fail("Not found", 404);

  return NextResponse.json(await listDeleted(db, seasonId));
}
