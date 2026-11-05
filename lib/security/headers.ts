type Env = Record<string, string | undefined>;

const originOf = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
};

/**
 * Built per request from the environment, so it follows the bucket's real
 * address. Next and the app use inline scripts and styles, and nonces would
 * rule out the partial prerendering every page relies on.
 */
export function contentSecurityPolicy(env: Env) {
  const isDev = env.NODE_ENV === "development";
  const images = originOf(env.R2_PUBLIC_URL);
  const uploads = env.R2_ACCOUNT_ID ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : null;

  const directives: [string, (string | null | false)[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "'unsafe-inline'", isDev && "'unsafe-eval'"]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", images]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'", uploads, isDev && "ws:"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];

  return directives.map(([name, sources]) => [name, ...sources.filter(Boolean)].join(" ")).join("; ");
}

/** On every response, including static files, which never reach the proxy. */
export const STATIC_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];
