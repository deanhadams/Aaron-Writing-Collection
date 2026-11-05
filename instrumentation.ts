/** Runs once as the server starts, so a bad setting stops a deploy instead of a request. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertEnv } = await import("./lib/env");
  assertEnv();
}
