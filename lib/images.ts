export function imageUrl(key: string | null, changedAt?: number | null) {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!key || !base) return null;

  // A new portrait overwrites the same key, so this gets past caches.
  return `${base}/${key}${changedAt ? `?v=${changedAt}` : ""}`;
}
