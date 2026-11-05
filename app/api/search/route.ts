import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/characters/api-helpers";
import { db } from "@/lib/db";
import { runSearch, SEARCH_TYPES, type SearchType } from "@/lib/search/run";

const MAX_QUERY = 200;
const MAX_LIMIT = 20;

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { searchParams } = request.nextUrl;
  const query = (searchParams.get("q") ?? "").slice(0, MAX_QUERY);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || MAX_LIMIT));
  const type = searchParams.get("type");

  const started = performance.now();
  const { jump, scenes, episodes, characters, lore } = await runSearch(db, query, {
    limit,
    type: SEARCH_TYPES.includes(type as SearchType) ? (type as SearchType) : undefined,
  });

  return NextResponse.json({ jump, scenes, episodes, characters, lore }, {
    headers: { "Server-Timing": `db;dur=${(performance.now() - started).toFixed(1)}`, "Cache-Control": "no-store" },
  });
}
