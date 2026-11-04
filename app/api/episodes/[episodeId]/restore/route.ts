import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { restoreEpisode } from "@/lib/structure/episode";
import { structureRoute } from "@/lib/structure/respond";
import { parseVersion } from "@/lib/structure/validate";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/episodes/[episodeId]/restore">) {
  const { episodeId } = await params;
  return structureRoute(request, episodeId, parseVersion, (version) => restoreEpisode(db, { episodeId, version }));
}
