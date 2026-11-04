import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { structureRoute } from "@/lib/structure/respond";
import { updateSeason } from "@/lib/structure/season";
import { parseSeasonPatch } from "@/lib/structure/validate";

type Context = RouteContext<"/api/seasons/[seasonId]">;

export async function PATCH(request: NextRequest, { params }: Context) {
  const { seasonId } = await params;
  return structureRoute(request, seasonId, parseSeasonPatch, (input) => updateSeason(db, { ...input, seasonId }));
}
