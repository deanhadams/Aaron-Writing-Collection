import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/current-session";
import { isUuid } from "@/lib/queries/library";
import { heartbeat, leaveScene } from "@/lib/scenes/presence";

type Context = RouteContext<"/api/scenes/[sceneId]/presence">;

export async function POST(_request: NextRequest, { params }: Context) {
  const session = await getCurrentSession();
  const { sceneId } = await params;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(sceneId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ others: await heartbeat(db, { sceneId, userId: session.userId }) });
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const session = await getCurrentSession();
  const { sceneId } = await params;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(sceneId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await leaveScene(db, { sceneId, userId: session.userId });
  return new NextResponse(null, { status: 204 });
}
