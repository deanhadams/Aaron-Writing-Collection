import { NextResponse, type NextRequest } from "next/server";
import { fail, requireSession } from "@/lib/characters/api-helpers";
import { isUuid } from "@/lib/queries/library";

type Result = { status: string; [key: string]: unknown };

/** One meaning per status, so every structural route answers alike. */
export function respond({ status, ...data }: Result) {
  switch (status) {
    case "ok":
    case "saved":
      return NextResponse.json(data);
    case "conflict":
      return fail("Someone else changed this first", 409);
    case "not_found":
      return fail("Not found", 404);
    case "number_taken":
      return fail(`Episode ${data.number} already exists`, 422);
    case "episode_deleted":
      return fail(`Restore Episode ${data.number} first`, 422);
    default:
      return fail("Something went wrong", 500);
  }
}

/** Signed in, a well-formed id, then a body the parser accepts, then the work. */
export async function structureRoute<P>(
  request: NextRequest,
  id: string,
  parse: (body: unknown) => P | null,
  run: (payload: P, userId: string) => Promise<Result>,
) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const payload = parse(await request.json().catch(() => null));
  if (!payload || !isUuid(id)) return fail("Invalid request", 400);

  return respond(await run(payload, session.userId));
}
