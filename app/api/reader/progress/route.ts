import { NextResponse, type NextRequest } from "next/server";
import { fail, requireSession } from "@/lib/characters/api-helpers";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/queries/library";
import { saveProgress } from "@/lib/reader/read";

export async function POST(request: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const body = (await request.json().catch(() => null)) as { sceneId?: unknown } | null;
  const sceneId = body?.sceneId;
  if (typeof sceneId !== "string" || !isUuid(sceneId)) return fail("Invalid scene", 400);

  const saved = await saveProgress(db, { userId: session.userId, sceneId });
  return saved ? NextResponse.json({ saved }) : fail("Not found", 404);
}
