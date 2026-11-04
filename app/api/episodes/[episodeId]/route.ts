import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { deleteEpisode, updateEpisode } from "@/lib/structure/episode";
import { structureRoute } from "@/lib/structure/respond";
import { parseEpisodePatch, parseVersion } from "@/lib/structure/validate";

type Context = RouteContext<"/api/episodes/[episodeId]">;

export async function PATCH(request: NextRequest, { params }: Context) {
  const { episodeId } = await params;
  return structureRoute(request, episodeId, parseEpisodePatch, (input) => updateEpisode(db, { ...input, episodeId }));
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const { episodeId } = await params;
  return structureRoute(request, episodeId, parseVersion, (version, userId) =>
    deleteEpisode(db, { episodeId, version, userId }),
  );
}
