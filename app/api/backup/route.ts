import { NextResponse } from "next/server";
import { requireSession } from "@/lib/characters/api-helpers";
import { db } from "@/lib/db";
import { backupChunks, backupFileName } from "@/lib/export/backup";
import { attachment } from "@/lib/export/respond";

export async function GET() {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const now = new Date();
  const chunks = backupChunks(db, { userId: session.userId, now });

  // Pulled, not pushed: a slow connection slows the database reads down with it.
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await chunks.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": attachment(backupFileName(now)),
      "Cache-Control": "no-store",
    },
  });
}
