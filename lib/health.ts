export const HEALTH_TIMEOUT_MS = 2000;

/** True if the ping answers in time. A hung database counts as unreachable. */
export async function isReachable(ping: () => Promise<unknown>, timeoutMs = HEALTH_TIMEOUT_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });

  try {
    return await Promise.race([ping().then(() => true as const), timeout]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
