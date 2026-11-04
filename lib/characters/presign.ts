import { createHash, createHmac } from "node:crypto";

const ALGORITHM = "AWS4-HMAC-SHA256";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const hmac = (key: Buffer | string, value: string) => createHmac("sha256", key).update(value).digest();

const encode = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const encodePath = (path: string) => path.split("/").map(encode).join("/");

type PresignInput = {
  method: string;
  host: string;
  path: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresSeconds: number;
  /** Beyond host. Signed, so the browser must send exactly these values. */
  headers?: Record<string, string>;
  now?: Date;
};

/** A SigV4 presigned URL, in query-string form. */
export function presignUrl({
  method,
  host,
  path,
  region,
  accessKeyId,
  secretAccessKey,
  expiresSeconds,
  headers = {},
  now = new Date(),
}: PresignInput) {
  const stamp = now.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const day = stamp.slice(0, 8);
  const scope = `${day}/${region}/s3/aws4_request`;

  const allHeaders = Object.entries({ ...headers, host })
    .map(([name, value]) => [name.toLowerCase(), value.trim()])
    .sort(([a], [b]) => (a < b ? -1 : 1));
  const signedHeaders = allHeaders.map(([name]) => name).join(";");

  const query = Object.entries({
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": stamp,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  })
    .map(([name, value]) => `${encode(name)}=${encode(value)}`)
    .sort()
    .join("&");

  const canonical = [
    method,
    encodePath(path),
    query,
    allHeaders.map(([name, value]) => `${name}:${value}\n`).join(""),
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [ALGORITHM, stamp, scope, sha256(canonical)].join("\n");
  const key = ["aws4_request"].reduce(
    (current, part) => hmac(current, part),
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, day), region), "s3"),
  );
  const signature = createHmac("sha256", key).update(stringToSign).digest("hex");

  return `https://${host}${encodePath(path)}?${query}&X-Amz-Signature=${signature}`;
}

const UPLOAD_EXPIRES_SECONDS = 300;

function r2Config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;

  return {
    host: `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    bucket: R2_BUCKET,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    region: "auto",
  };
}

/** Signs the type and exact size, so the upload cannot be swapped for something else. */
export function presignUpload(key: string, contentType: string, size: number) {
  const config = r2Config();
  if (!config) return null;

  const { bucket, ...signing } = config;
  return presignUrl({
    ...signing,
    method: "PUT",
    path: `/${bucket}/${key}`,
    expiresSeconds: UPLOAD_EXPIRES_SECONDS,
    headers: { "content-type": contentType, "content-length": String(size) },
  });
}
