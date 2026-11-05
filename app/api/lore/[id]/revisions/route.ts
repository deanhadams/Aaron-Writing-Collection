import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/queries/library";
import { fail, requireEntry, requireSession, respond } from "@/lib/lore/respond";
import { parseVersion } from "@/lib/lore/validate";
import { listLoreRevisions, restoreLoreRevision } from "@/lib/lore/write";

type Context = RouteContext<"/api/lore/[id]/revisions">;

export async function GET(_request: NextRequest, { params }: Context) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const entry = await requireEntry((await params).id);
  if (entry instanceof NextResponse) return entry;

  return NextResponse.json(await listLoreRevisions(db, entry.id));
}

export async function POST(request: NextRequest, { params }: Context) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const entry = await requireEntry((await params).id);
  if (entry instanceof NextResponse) return entry;

  const body = (await request.json().catch(() => null)) as { revisionId?: unknown } | null;
  const version = parseVersion(body);
  const { revisionId } = body ?? {};
  if (!version || typeof revisionId !== "string" || !isUuid(revisionId)) return fail("Invalid revision", 400);

  return respond(await restoreLoreRevision(db, { id: entry.id, revisionId, version, userId: session.userId }));
}
