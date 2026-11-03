"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { LOGIN_PATH, safeNextPath } from "./protection";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "./session";

export type LoginState = { error: string | null };

// Compared against when the email is unknown, so a wrong email takes as long
// as a wrong password and response times don't reveal who has an account.
const DUMMY_HASH =
  "$2b$12$Bh83.g5nlW5Sl.ckX4BmZe60i2fyyTziNAfGSvymYttTVC7CzIklC";

export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const matches = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_HASH,
  );

  if (!user || !matches) {
    return { error: "Wrong email or password." };
  }

  const token = await createSessionToken({ userId: user.id, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);

  redirect(safeNextPath(formData.get("next")));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect(LOGIN_PATH);
}
