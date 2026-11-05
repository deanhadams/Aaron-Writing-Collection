import { NextResponse } from "next/server";
import { fail, requireSession } from "@/lib/characters/api-helpers";
import { db } from "@/lib/db";
import { loreEntries } from "@/lib/db/schema";
import { isUuid } from "@/lib/queries/library";
import { and, eq, isNull } from "drizzle-orm";

export { fail, requireSession };

export async function requireEntry(id: string) {
  if (!isUuid(id)) return fail("Not found", 404);

  const [entry] = await db
    .select()
    .from(loreEntries)
    .where(and(eq(loreEntries.id, id), isNull(loreEntries.deletedAt)));
  return entry ?? fail("Not found", 404);
}

export function respond(result: { status: string; title?: string; [key: string]: unknown }) {
  const { status, ...data } = result;
  switch (status) {
    case "conflict":
      return fail("Someone else changed this first", 409);
    case "not_found":
      return fail("Not found", 404);
    case "title_taken":
      return fail(`An entry called ${result.title} already exists`, 422);
    case "no_series":
      return fail("There is no series yet", 409);
    default:
      return NextResponse.json(data);
  }
}
