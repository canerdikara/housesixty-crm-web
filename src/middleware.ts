import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIES } from "@/lib/session";

/**
 * Route guard.
 *
 * This is a **cheap** check, not the security boundary. All it does is look for the
 * presence of session cookies and bounce anonymous visitors to the login page so they
 * do not watch a panel shell render and then empty itself. It cannot and does not
 * validate the token — middleware runs on every request and verifying a JWT signature
 * here would put a round trip or a crypto check in front of every navigation.
 *
 * The real boundary is the backend, which role-gates every `/api/v1/crm/**` endpoint.
 * Forging these cookies gets you an empty shell whose every request 401s.
 *
 * **Deployment note.** This file is the reason the Amplify app must be deployed as
 * **compute (SSR)** and not as a static export. A static deployment does not run
 * middleware at all — it does not fail, it silently skips it — and the panel would
 * serve its shell to anyone. That exact mistake has already cost this project hours on
 * the marketing site, where the symptom was a blank page. Here the symptom would be
 * worse: it would look like it worked.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const hasSession =
    req.cookies.has(SESSION_COOKIES.ACCESS) &&
    req.cookies.has(SESSION_COOKIES.REFRESH) &&
    req.cookies.has(SESSION_COOKIES.USER);

  const isLogin = pathname === "/login";

  if (!hasSession && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Where they were headed, so login can put them back there afterwards. Only the
    // path and query are kept, and the login page validates it before redirecting —
    // an open redirect on a login form is how a phishing page borrows your domain.
    const target = pathname + search;
    if (target && target !== "/") url.searchParams.set("next", target);
    return NextResponse.redirect(url);
  }

  if (hasSession && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Everything except Next's own assets and the favicon.
   *
   * `/api/auth/*` is deliberately NOT excluded even though login must be reachable
   * while signed out — those handlers live under /login's own flow as server actions,
   * so there is no unauthenticated API surface here to carve out. If a route handler
   * is ever added that must work signed out, exclude it here explicitly rather than
   * loosening the matcher.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
