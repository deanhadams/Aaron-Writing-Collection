export function imageUrl(key: string | null) {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  return key && base ? `${base}/${key}` : null;
}
