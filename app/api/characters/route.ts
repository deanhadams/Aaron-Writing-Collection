import { NextResponse, type NextRequest } from "next/server";
import { fail, requireSession } from "@/lib/characters/api-helpers";
import { createCharacter } from "@/lib/characters/write";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const body = (await request.json().catch(() => null)) as { name?: unknown; fullName?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() || null : null;
  if (!name || name.length > 200 || (fullName?.length ?? 0) > 200) return fail("Enter a name", 400);

  const result = await createCharacter(db, { name, fullName, userId: session.userId });

  switch (result.status) {
    case "created":
      return NextResponse.json(result, { status: 201 });
    case "name_taken":
      return fail(`${result.name} already has a card`, 409);
    case "no_series":
      return fail("Import a series first", 400);
  }
}
