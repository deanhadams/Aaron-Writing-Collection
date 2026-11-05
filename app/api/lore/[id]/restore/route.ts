import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/queries/library";
import { fail, requireSession, respond } from "@/lib/lore/respond";
import { parseVersion } from "@/lib/lore/validate";
import { restoreEntry } from "@/lib/lore/write";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/lore/[id]/restore">) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const version = parseVersion(await request.json().catch(() => null));
  if (!version || !isUuid(id)) return fail("Invalid entry", 400);

  return respond(await restoreEntry(db, { id, version }));
}
