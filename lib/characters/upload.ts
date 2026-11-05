export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const ACCEPTED_TYPES = Object.keys(EXTENSIONS);

export const extensionFor = (contentType: string) => EXTENSIONS[contentType];

export type UploadKind = "portrait" | "image";

export type UploadRequest = { kind: UploadKind; contentType: string; size: number };

type Parsed = { ok: true; request: UploadRequest } | { ok: false; error: string };

export function parseUploadRequest(body: unknown): Parsed {
  const { kind, contentType, size } = (body ?? {}) as Record<string, unknown>;

  if (kind !== "portrait" && kind !== "image") return { ok: false, error: "Unknown upload kind" };
  if (typeof contentType !== "string" || !EXTENSIONS[contentType]) {
    return { ok: false, error: "Only PNG, JPG, WebP and GIF images can be uploaded" };
  }
  if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) {
    return { ok: false, error: "That file is empty" };
  }
  if (size > MAX_UPLOAD_BYTES) return { ok: false, error: "Images can be up to 10 MB" };

  return { ok: true, request: { kind, contentType, size } };
}

/** characters/<slug>.png for a portrait, characters/<slug>/<id>.<ext> for the rest. */
export function uploadKey(slug: string, { kind, contentType }: UploadRequest, randomId: string) {
  const extension = EXTENSIONS[contentType];
  return kind === "portrait"
    ? `characters/${slug}.${extension}`
    : `characters/${slug}/${randomId}.${extension}`;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A key handed back by the browser must be one this character could have been given. */
export function isOwnKey(slug: string, key: unknown, kind: UploadKind): key is string {
  if (typeof key !== "string") return false;

  const root = `characters/${escapeRegExp(slug)}`;
  const pattern = kind === "portrait"
    ? `^${root}\\.(png|jpg|webp|gif)$`
    : `^${root}/[a-z0-9-]+\\.(png|jpg|webp|gif)$`;
  return new RegExp(pattern).test(key);
}
