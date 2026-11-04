import { NextResponse, type NextRequest } from "next/server";
import { fail, requireCharacter, requireSession } from "@/lib/characters/api-helpers";
import { deleteImage, updateImageCaption } from "@/lib/characters/write";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/queries/library";

type Context = RouteContext<"/api/characters/[id]/images/[imageId]">;

export async function PATCH(request: NextRequest, { params }: Context) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { id, imageId } = await params;
  const character = await requireCharacter(id);
  if (character instanceof NextResponse) return character;
  if (!isUuid(imageId)) return fail("Not found", 404);

  const body = (await request.json().catch(() => null)) as { caption?: unknown } | null;
  const caption = typeof body?.caption === "string" ? body.caption.trim().slice(0, 300) || null : null;

  await updateImageCaption(db, id, imageId, caption);
  return new NextResponse(null, { status: 204 });
}

// The file stays in R2: only the database row goes.
export async function DELETE(_request: NextRequest, { params }: Context) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { id, imageId } = await params;
  const character = await requireCharacter(id);
  if (character instanceof NextResponse) return character;
  if (!isUuid(imageId)) return fail("Not found", 404);

  await deleteImage(db, id, imageId);
  return new NextResponse(null, { status: 204 });
}
