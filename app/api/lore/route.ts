import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { LORE_CATEGORIES, type LoreCategory } from "@/lib/lore/categories";
import { fail, requireSession, respond } from "@/lib/lore/respond";
import { createEntry } from "@/lib/lore/write";

export async function POST(request: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const body = (await request.json().catch(() => null)) as { title?: unknown; category?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const category = LORE_CATEGORIES.find((name) => name === body?.category) ?? "Other";
  if (!title || title.length > 200) return fail("Give the entry a title", 400);

  return respond(await createEntry(db, { title, category: category as LoreCategory, userId: session.userId }));
}
