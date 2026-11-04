import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/current-session";
import { isUuid } from "@/lib/queries/library";
import { getSavedScene, saveScene } from "@/lib/scenes/save-scene";
import { parseSavePayload } from "@/lib/scenes/validate";

type Context = RouteContext<"/api/scenes/[sceneId]">;

export async function GET(_request: NextRequest, { params }: Context) {
  const { sceneId } = await params;
  const scene = isUuid(sceneId) ? await getSavedScene(db, sceneId) : null;

  return scene
    ? NextResponse.json(scene)
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(request: NextRequest, { params }: Context) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sceneId } = await params;
  const payload = parseSavePayload(await request.json().catch(() => null));
  if (!payload || !isUuid(sceneId)) {
    return NextResponse.json({ error: "Invalid scene" }, { status: 400 });
  }

  const result = await saveScene(db, { ...payload, sceneId, userId: session.userId });

  switch (result.status) {
    case "saved":
      return NextResponse.json({ version: result.version });
    case "conflict":
      return NextResponse.json({ version: result.version }, { status: 409 });
    case "not_found":
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
