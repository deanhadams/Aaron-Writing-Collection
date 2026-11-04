import { NextResponse, type NextRequest } from "next/server";
import { fail, requireCharacter, requireSession } from "@/lib/characters/api-helpers";
import { parseCharacterPayload } from "@/lib/characters/validate";
import { deleteCharacter, saveCharacter } from "@/lib/characters/write";
import { db } from "@/lib/db";

type Context = RouteContext<"/api/characters/[id]">;

export async function PUT(request: NextRequest, { params }: Context) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const character = await requireCharacter(id);
  if (character instanceof NextResponse) return character;

  const payload = parseCharacterPayload(await request.json().catch(() => null));
  if (!payload) return fail("Invalid character", 400);

  const result = await saveCharacter(db, { ...payload, id, userId: session.userId });

  switch (result.status) {
    case "saved":
      return NextResponse.json({ version: result.version });
    case "conflict":
      return NextResponse.json({ version: result.version }, { status: 409 });
    case "name_taken":
      return fail(`${result.name} is already used by another card`, 422);
    case "not_found":
      return fail("Not found", 404);
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const character = await requireCharacter(id);
  if (character instanceof NextResponse) return character;

  const result = await deleteCharacter(db, id);

  switch (result.status) {
    case "deleted":
      return new NextResponse(null, { status: 204 });
    case "has_appearances":
      return fail("This character appears in scenes, so merge it instead", 409);
    case "not_found":
      return fail("Not found", 404);
  }
}
