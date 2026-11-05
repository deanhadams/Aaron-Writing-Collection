import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/lore/respond";
import { listDeletedEntries } from "@/lib/lore/write";

export async function GET() {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  return NextResponse.json(await listDeletedEntries(db));
}
