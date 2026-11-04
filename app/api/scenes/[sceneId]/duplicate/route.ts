import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { structureRoute } from "@/lib/structure/respond";
import { duplicateScene } from "@/lib/structure/scene";
import { parseVersion } from "@/lib/structure/validate";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/scenes/[sceneId]/duplicate">) {
  const { sceneId } = await params;
  return structureRoute(request, sceneId, parseVersion, (version, userId) =>
    duplicateScene(db, { sceneId, version, userId }),
  );
}
