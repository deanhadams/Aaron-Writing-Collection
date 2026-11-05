import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { presignUpload } from "@/lib/characters/presign";
import { extensionFor, parseUploadRequest } from "@/lib/characters/upload";
import { imageUrl } from "@/lib/images";
import { fail, requireEntry, requireSession } from "@/lib/lore/respond";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/lore/[id]/uploads">) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const entry = await requireEntry((await params).id);
  if (entry instanceof NextResponse) return entry;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseUploadRequest({ ...body, kind: "image" });
  if (!parsed.ok) return fail(parsed.error, 400);

  const { contentType, size } = parsed.request;
  const key = `lore/${entry.slug}/${randomUUID()}.${extensionFor(contentType)}`;
  const url = presignUpload(key, contentType, size);
  if (!url) return fail("Image storage is not set up", 503);

  return NextResponse.json({ url, key, publicUrl: imageUrl(key) });
}
