import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIES } from "@/lib/session";
import { jwtExpiresAt, REFRESH_SKEW_MS } from "@/lib/jwt";

/**
 * Route guard **and** the one place token refresh happens.
 *
 * ## Why refresh lives here and not in the API client
 *
 * The obvious design is for `apiRequest` to catch a 401, refresh, and replay. That is
 * what the iOS and Android clients do, and it is what this panel did first — and it
 * crashes, because **Next.js forbids writing cookies during a Server Component
 * render**. A page that calls the API is not a Server Action or a Route Handler, so
 * `cookies().set()` throws there. The failure is nasty precisely because it is
 * invisible: everything works for the first fifteen minutes of a session, and then
 * every page 500s the moment the access token expires.
 *
 * Middleware, by contrast, may set cookies. So it refreshes *before* the render, and
 * `apiRequest` is left with no refresh responsibility at all.
 *
 * ## What `/auth/refresh` actually does
 *
 * It **re-issues** both tokens; it does not revoke the old ones. Verified against the
 * live backend: the previous refresh token is still accepted afterwards, and the
 * "new" one is frequently byte-identical, because it is a stateless JWT over the same
 * claims and `iat` has one-second resolution. There is no server-side token store.
 *
 * That is worth knowing for two reasons. It means a dropped refresh result is
 * recoverable here rather than session-ending — do not write code that relies on the
 * opposite. And it means **a leaked refresh token is valid for its full seven days**
 * with only one lever to stop it: changing the user's password. `AuthService.refreshToken`
 * compares the token's `iat` against `users.password_changed_at` (V26) and refuses
 * anything older, which is the only revocation this system has.
 *
 * The new tokens are still persisted on every path below, because the alternative is
 * refreshing on every single request.
 *
 * ## Proactive, not reactive
 *
 * The check is on the access token's own `exp` (with a skew), not on a 401 coming
 * back. That means the refresh happens before the page's own API calls go out, so
 * those calls never see a 401 in the first place.
 *
 * ## Deployment
 *
 * This file is why the Amplify app must be **compute (SSR)**, not a static export. A
 * static deployment does not run middleware — it does not error, it silently skips it
 * — which here would mean no guard *and* no refresh. That mistake has already cost
 * this project hours on the marketing site, where at least the symptom was an
 * obviously blank page.
 */

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: unknown;
};

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

function toLogin(req: NextRequest, opts: { clear: boolean; keepNext: boolean }) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (opts.keepNext) {
    const target = req.nextUrl.pathname + req.nextUrl.search;
    if (target && target !== "/") url.searchParams.set("next", target);
  }
  const res = NextResponse.redirect(url);
  if (opts.clear) {
    for (const name of Object.values(SESSION_COOKIES)) res.cookies.delete(name);
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const isLogin = req.nextUrl.pathname === "/login";

  const access = req.cookies.get(SESSION_COOKIES.ACCESS)?.value;
  const refresh = req.cookies.get(SESSION_COOKIES.REFRESH)?.value;
  const userCookie = req.cookies.get(SESSION_COOKIES.USER)?.value;
  const hasSession = !!access && !!refresh && !!userCookie;

  if (!hasSession) {
    return isLogin ? NextResponse.next() : toLogin(req, { clear: false, keepNext: true });
  }

  if (isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const expiresAt = jwtExpiresAt(access);
  const needsRefresh = expiresAt === null || expiresAt - Date.now() < REFRESH_SKEW_MS;
  if (!needsRefresh) return NextResponse.next();

  const base = (process.env.CRM_API_BASE_URL ?? "").replace(/\/$/, "");
  if (!base) {
    // Misconfiguration, not an expired session. Bouncing to login would produce an
    // endless loop between here and a login page that also cannot reach the backend.
    console.error("[middleware] CRM_API_BASE_URL is not set; cannot refresh");
    return NextResponse.next();
  }

  let auth: AuthResponse | null = null;
  try {
    const res = await fetch(`${base}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // camelCase, and @NotBlank on the backend — `refresh_token` is rejected.
      body: JSON.stringify({ refreshToken: refresh }),
      cache: "no-store",
    });
    if (res.ok) auth = (await res.json()) as AuthResponse;
  } catch (err) {
    // The backend being unreachable is not the same as the session being over. Let the
    // request through on the old token: the page's own call will fail and report
    // "sunucuya ulaşılamadı", which is the truth. Clearing the session here would log
    // everyone out of the panel every time the API restarts.
    console.error("[middleware] refresh unreachable:", err instanceof Error ? err.name : "unknown");
    return NextResponse.next();
  }

  if (!auth) {
    // A refused refresh is different: the token is genuinely spent or revoked, and no
    // amount of retrying changes that. Clear and send them to sign in again.
    return toLogin(req, { clear: true, keepNext: true });
  }

  /*
   * Write the new tokens to the request as well as the response.
   *
   * The response cookies are for the browser's next request. The *request* cookies are
   * what this render sees — without `NextResponse.next({ request })` the page would
   * still read the old, now-spent token out of `cookies()` and send it to the backend,
   * which is the exact 401 this refresh just prevented.
   */
  const headers = new Headers(req.headers);
  const jar = new Map<string, string>();
  req.cookies.getAll().forEach((c) => jar.set(c.name, c.value));
  jar.set(SESSION_COOKIES.ACCESS, auth.accessToken);
  jar.set(SESSION_COOKIES.REFRESH, auth.refreshToken);
  // The user object is rewritten from the refresh response too. It is the only place
  // the role is authoritative — the refresh *token* carries no role claim at all.
  jar.set(SESSION_COOKIES.USER, JSON.stringify(auth.user));
  headers.set(
    "cookie",
    Array.from(jar.entries())
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("; ")
  );

  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(SESSION_COOKIES.ACCESS, auth.accessToken, cookieOptions());
  res.cookies.set(SESSION_COOKIES.REFRESH, auth.refreshToken, cookieOptions());
  res.cookies.set(SESSION_COOKIES.USER, JSON.stringify(auth.user), cookieOptions());
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
