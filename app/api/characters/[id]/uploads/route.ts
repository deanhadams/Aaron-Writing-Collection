import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { fail, requireCharacter, requireSession } from "@/lib/characters/api-helpers";
import { presignUpload } from "@/lib/characters/presign";
import { parseUploadRequest, uploadKey } from "@/lib/characters/upload";
import { imageUrl } from "@/lib/images";

type Context = RouteContext<"/api/characters/[id]/uploads">;

export async function POST(request: NextRequest, { params }: Context) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const character = await requireCharacter(id);
  if (character instanceof NextResponse) return character;

  const parsed = parseUploadRequest(await request.json().catch(() => null));
  if (!parsed.ok) return fail(parsed.error, 400);

  const key = uploadKey(character.slug, parsed.request, randomUUID());
  const url = presignUpload(key, parsed.request.contentType, parsed.request.size);
  if (!url) return fail("Image storage is not set up", 503);

  return NextResponse.json({ url, key, publicUrl: imageUrl(key) });
}
