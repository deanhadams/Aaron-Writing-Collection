import { NextResponse, type NextRequest } from "next/server";
import { fail, requireCharacter, requireSession } from "@/lib/characters/api-helpers";
import { mergeCharacters } from "@/lib/characters/write";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/queries/library";

type Context = RouteContext<"/api/characters/[id]/merge">;

export async function POST(request: NextRequest, { params }: Context) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const character = await requireCharacter(id);
  if (character instanceof NextResponse) return character;

  const body = (await request.json().catch(() => null)) as { targetId?: unknown; version?: unknown } | null;
  const { targetId, version } = body ?? {};
  if (typeof targetId !== "string" || !isUuid(targetId) || !Number.isInteger(version)) {
    return fail("Invalid merge", 400);
  }

  const result = await mergeCharacters(db, {
    sourceId: id,
    targetId,
    version: version as number,
    userId: session.userId,
  });

  switch (result.status) {
    case "merged":
      return NextResponse.json(result);
    case "conflict":
      return NextResponse.json({ version: result.version }, { status: 409 });
    case "same_character":
      return fail("Choose a different character", 400);
    case "not_found":
      return fail("Not found", 404);
  }
}
