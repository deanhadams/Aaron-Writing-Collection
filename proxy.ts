import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decideAccess, type AccessDecision } from "@/lib/auth/protection";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { contentSecurityPolicy } from "@/lib/security/headers";

function answer(decision: AccessDecision, request: NextRequest) {
  switch (decision.action) {
    case "allow":
      return NextResponse.next();
    case "unauthorized":
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    case "redirect":
      // Absolute here, because Next's proxy crashes on a relative one. It sends the
      // address back relative, so an internal host can't leak behind Railway's proxy.
      return NextResponse.redirect(new URL(decision.to, request.url));
  }
}

export async function proxy(request: NextRequest) {
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  const decision = decideAccess({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    isAuthenticated: session !== null,
  });

  const response = answer(decision, request);
  response.headers.set("Content-Security-Policy", contentSecurityPolicy(process.env));
  return response;
}

export const config = {
  // Everything runs through the proxy except build assets, the favicon and robots.txt.
  matcher: ["/((?!_next/static/|_next/image$|favicon\\.ico$|robots\\.txt$).*)"],
};
