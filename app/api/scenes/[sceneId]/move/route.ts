import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { structureRoute } from "@/lib/structure/respond";
import { moveScene } from "@/lib/structure/scene";
import { parseMove } from "@/lib/structure/validate";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/scenes/[sceneId]/move">) {
  const { sceneId } = await params;
  return structureRoute(request, sceneId, parseMove, (input) => moveScene(db, { ...input, sceneId }));
}
