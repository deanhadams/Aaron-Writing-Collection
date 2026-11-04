import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/current-session";
import { isUuid } from "@/lib/queries/library";
import { listRevisions, restoreRevision } from "@/lib/scenes/save-scene";

type Context = RouteContext<"/api/scenes/[sceneId]/revisions">;

export async function GET(_request: NextRequest, { params }: Context) {
  const { sceneId } = await params;
  if (!isUuid(sceneId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(await listRevisions(db, sceneId));
}

export async function POST(request: NextRequest, { params }: Context) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sceneId } = await params;
  const body = await request.json().catch(() => null);
  const { revisionId, version } = (body ?? {}) as { revisionId?: unknown; version?: unknown };

  if (!isUuid(sceneId) || typeof revisionId !== "string" || !isUuid(revisionId) || !Number.isInteger(version)) {
    return NextResponse.json({ error: "Invalid restore" }, { status: 400 });
  }

  const result = await restoreRevision(db, {
    sceneId,
    revisionId,
    userId: session.userId,
    version: version as number,
  });

  switch (result.status) {
    case "saved":
      return NextResponse.json(result);
    case "conflict":
      return NextResponse.json({ version: result.version }, { status: 409 });
    case "not_found":
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
