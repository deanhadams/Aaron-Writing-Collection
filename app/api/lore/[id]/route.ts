import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { fail, requireEntry, requireSession, respond } from "@/lib/lore/respond";
import { parseDraft, parseVersion } from "@/lib/lore/validate";
import { deleteEntry, saveEntry } from "@/lib/lore/write";

type Context = RouteContext<"/api/lore/[id]">;

export async function GET(_request: NextRequest, { params }: Context) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const entry = await requireEntry((await params).id);
  if (entry instanceof NextResponse) return entry;

  const { title, category, summary, body, coverKey, tags, aliases, version } = entry;
  return NextResponse.json({ title, category, summary, body, coverKey, tags, aliases, version });
}

export async function PUT(request: NextRequest, { params }: Context) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const entry = await requireEntry((await params).id);
  if (entry instanceof NextResponse) return entry;

  const body = await request.json().catch(() => null);
  const version = parseVersion(body);
  const draft = parseDraft(body, entry.slug);
  if (!version || !draft) return fail("Invalid entry", 400);

  return respond(await saveEntry(db, { id: entry.id, version, draft, userId: session.userId }));
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const entry = await requireEntry((await params).id);
  if (entry instanceof NextResponse) return entry;

  const version = parseVersion(await request.json().catch(() => null));
  if (!version) return fail("Invalid entry", 400);

  return respond(await deleteEntry(db, { id: entry.id, version, userId: session.userId }));
}
