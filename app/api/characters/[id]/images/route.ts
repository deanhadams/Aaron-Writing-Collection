import { NextResponse, type NextRequest } from "next/server";
import { fail, requireCharacter, requireSession } from "@/lib/characters/api-helpers";
import { isOwnKey } from "@/lib/characters/upload";
import { addImage, reorderImages } from "@/lib/characters/write";
import { db } from "@/lib/db";

type Context = RouteContext<"/api/characters/[id]/images">;

export async function POST(request: NextRequest, { params }: Context) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const character = await requireCharacter(id);
  if (character instanceof NextResponse) return character;

  const body = (await request.json().catch(() => null)) as { key?: unknown; caption?: unknown } | null;
  if (!isOwnKey(character.slug, body?.key, "image")) return fail("Invalid image", 400);

  const caption = typeof body?.caption === "string" ? body.caption.trim().slice(0, 300) || null : null;
  return NextResponse.json(await addImage(db, id, body.key, caption), { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const character = await requireCharacter(id);
  if (character instanceof NextResponse) return character;

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = body?.ids;
  if (!Array.isArray(ids) || !ids.every((value) => typeof value === "string")) return fail("Invalid order", 400);

  await reorderImages(db, id, ids as string[]);
  return new NextResponse(null, { status: 204 });
}
