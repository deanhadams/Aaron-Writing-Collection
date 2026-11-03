import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decideAccess } from "@/lib/auth/protection";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  const decision = decideAccess({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    isAuthenticated: session !== null,
  });

  switch (decision.action) {
    case "allow":
      return NextResponse.next();
    case "unauthorized":
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    case "redirect":
      return NextResponse.redirect(new URL(decision.to, request.nextUrl));
  }
}

export const config = {
  // Everything runs through the proxy except build assets and the favicon.
  matcher: ["/((?!_next/static/|_next/image$|favicon\\.ico$).*)"],
};
