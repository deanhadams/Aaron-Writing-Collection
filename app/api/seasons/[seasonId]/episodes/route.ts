import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { structureRoute } from "@/lib/structure/respond";
import { createEpisode, reorderEpisodes } from "@/lib/structure/season";
import { parseNewEpisode, parseOrder } from "@/lib/structure/validate";

type Context = RouteContext<"/api/seasons/[seasonId]/episodes">;

export async function POST(request: NextRequest, { params }: Context) {
  const { seasonId } = await params;
  return structureRoute(request, seasonId, parseNewEpisode, (input) => createEpisode(db, { ...input, seasonId }));
}

export async function PUT(request: NextRequest, { params }: Context) {
  const { seasonId } = await params;
  return structureRoute(request, seasonId, parseOrder, (input) => reorderEpisodes(db, { ...input, seasonId }));
}
