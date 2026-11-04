import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { reorderScenes } from "@/lib/structure/episode";
import { structureRoute } from "@/lib/structure/respond";
import { addScene } from "@/lib/structure/scene";
import { parseNewScene, parseOrder } from "@/lib/structure/validate";

type Context = RouteContext<"/api/episodes/[episodeId]/scenes">;

export async function POST(request: NextRequest, { params }: Context) {
  const { episodeId } = await params;
  return structureRoute(request, episodeId, parseNewScene, (input, userId) =>
    addScene(db, { ...input, episodeId, userId }),
  );
}

export async function PUT(request: NextRequest, { params }: Context) {
  const { episodeId } = await params;
  return structureRoute(request, episodeId, parseOrder, (input) => reorderScenes(db, { ...input, episodeId }));
}
