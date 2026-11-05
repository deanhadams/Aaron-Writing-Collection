import { NextResponse } from "next/server";
import { connection } from "next/server";
import { pool } from "@/lib/db";
import { isReachable } from "@/lib/health";

const headers = { "Cache-Control": "no-store" };

/** Public, for Railway's health check. It says up or down and nothing else. */
export async function GET() {
  // Keeps this at request time, or the build could bake in a permanent "ok".
  await connection();

  return (await isReachable(() => pool.query("select 1")))
    ? NextResponse.json({ status: "ok" }, { headers })
    : NextResponse.json({ status: "unavailable" }, { status: 503, headers });
}
