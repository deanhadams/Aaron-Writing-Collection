import { NextResponse, type NextRequest } from "next/server";
import { fail, requireCharacter, requireSession } from "@/lib/characters/api-helpers";
import { isOwnKey } from "@/lib/characters/upload";
import { setPortrait } from "@/lib/characters/write";
import { db } from "@/lib/db";

type Context = RouteContext<"/api/characters/[id]/portrait">;

export async function POST(request: NextRequest, { params }: Context) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const character = await requireCharacter(id);
  if (character instanceof NextResponse) return character;

  const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
  if (!isOwnKey(character.slug, body?.key, "portrait")) return fail("Invalid image", 400);

  await setPortrait(db, id, body.key, session.userId);
  return new NextResponse(null, { status: 204 });
}
