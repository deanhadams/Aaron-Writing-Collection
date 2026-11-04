import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/current-session";
import { db } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { isUuid } from "@/lib/queries/library";

export const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function requireSession() {
  const session = await getCurrentSession();
  return session ?? fail("Unauthorized", 401);
}

export async function requireCharacter(id: string) {
  if (!isUuid(id)) return fail("Not found", 404);

  const [character] = await db
    .select({ id: characters.id, slug: characters.slug })
    .from(characters)
    .where(eq(characters.id, id));
  return character ?? fail("Not found", 404);
}
