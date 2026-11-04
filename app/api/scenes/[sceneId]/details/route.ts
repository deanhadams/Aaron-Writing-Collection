import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { updateSceneDetails } from "@/lib/scenes/save-scene";
import { structureRoute } from "@/lib/structure/respond";
import { parseSceneDetails } from "@/lib/structure/validate";

export async function PATCH(request: NextRequest, { params }: RouteContext<"/api/scenes/[sceneId]/details">) {
  const { sceneId } = await params;
  return structureRoute(request, sceneId, parseSceneDetails, (input, userId) =>
    updateSceneDetails(db, { ...input, sceneId, userId }),
  );
}
