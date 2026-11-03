export const LOGIN_PATH = "/login";

export type AccessDecision =
  | { action: "allow" }
  | { action: "redirect"; to: string }
  | { action: "unauthorized" };

type AccessRequest = {
  pathname: string;
  search: string;
  isAuthenticated: boolean;
};

function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function decideAccess({
  pathname,
  search,
  isAuthenticated,
}: AccessRequest): AccessDecision {
  if (pathname === LOGIN_PATH) {
    return isAuthenticated ? { action: "redirect", to: "/" } : { action: "allow" };
  }

  if (isAuthenticated) return { action: "allow" };
  if (isApiPath(pathname)) return { action: "unauthorized" };
  if (pathname === "/") return { action: "redirect", to: LOGIN_PATH };

  const next = encodeURIComponent(pathname + search);
  return { action: "redirect", to: `${LOGIN_PATH}?next=${next}` };
}

// Only same-site paths survive, so a crafted /login?next= link cannot send
// someone to another site after they sign in. Parsing with URL matches how
// browsers treat tricks like "//evil.com" and "/\evil.com".
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";

  const base = "http://app.invalid";
  try {
    const url = new URL(value, base);
    if (url.origin !== base) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
