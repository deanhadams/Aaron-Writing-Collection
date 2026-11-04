import { NextResponse, type NextRequest } from "next/server";
import { fail, requireSession } from "@/lib/characters/api-helpers";
import { db } from "@/lib/db";
import { episodeSeasonId, seasonDocx } from "@/lib/export/load";
import { docxResponse } from "@/lib/export/respond";
import { isUuid } from "@/lib/queries/library";

export async function GET(_request: NextRequest, { params }: RouteContext<"/api/export/episodes/[episodeId]">) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { episodeId } = await params;
  const seasonId = isUuid(episodeId) ? await episodeSeasonId(db, episodeId) : null;
  const document = seasonId ? await seasonDocx(db, seasonId, episodeId) : null;
  return document ? docxResponse(document) : fail("Not found", 404);
}
