import { cookies } from "next/headers";

/**
 * The panel's server-side session.
 *
 * The JWT pair lives in httpOnly cookies and is never handed to the browser. That is
 * the whole reason this panel talks to the backend through its own route handlers
 * rather than calling the API from the client: a CRM access token can read every
 * member's phone number, and `localStorage` is readable by any script that ends up on
 * the page. The iOS apps keep their tokens in `UserDefaults` and that is already a
 * known weakness there; there is no reason to repeat it in a browser, where the attack
 * surface is larger.
 */

const ACCESS = "hs_at";
const REFRESH = "hs_rt";
const USER = "hs_u";

/**
 * Access token lifetime is 15 minutes, refresh is 7 days.
 *
 * The access cookie is deliberately given the *refresh* lifetime rather than 15
 * minutes. If it expired on its own the browser would drop it and the server would see
 * a session with a refresh token and no access token — an extra state to handle for no
 * benefit. Let the backend decide the token is expired; that is what the 401-refresh
 * path is for. The cookie's job is storage, not expiry policy.
 */
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

/**
 * Mirrors the backend `UserResponse` inside `AuthResponse`.
 *
 * `role` is a plain string, not a union. The backend can add roles — three were added
 * for the CRM in phase 0 — and a client that narrows this to a fixed set turns a new
 * role into a decode failure. Compare against the constants in `roles.ts` instead.
 */
export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  avatarUrl?: string | null;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    // Off in local development, where the dev server is plain http and a Secure cookie
    // would simply never be stored. Always on in production.
    secure: process.env.NODE_ENV === "production",
    // "lax" rather than "strict": the panel has a top-level login redirect, and a
    // strict cookie is withheld on that first cross-site navigation, which reads to
    // the user as "it logged me out again". Nothing here is triggered by a cross-site
    // form post, so lax gives the CSRF protection that matters without that cost.
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS)?.value;
  const refreshToken = jar.get(REFRESH)?.value;
  const rawUser = jar.get(USER)?.value;

  if (!accessToken || !refreshToken || !rawUser) return null;

  try {
    return { accessToken, refreshToken, user: JSON.parse(rawUser) as SessionUser };
  } catch {
    // A user cookie that will not parse is a broken session, not a logged-in one.
    // Returning null sends the visitor to login rather than throwing inside a layout,
    // which would render an error page for what is really just stale state.
    return null;
  }
}

export async function writeSession(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS, session.accessToken, cookieOptions(REFRESH_MAX_AGE));
  jar.set(REFRESH, session.refreshToken, cookieOptions(REFRESH_MAX_AGE));
  // Not httpOnly-sensitive in the same way — it holds no credential — but it is set
  // httpOnly anyway so that the entire session is one thing the client cannot touch.
  jar.set(USER, JSON.stringify(session.user), cookieOptions(REFRESH_MAX_AGE));
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  for (const name of [ACCESS, REFRESH, USER]) {
    jar.delete(name);
  }
}

/** Cookie names, for the middleware — which can only see cookies, not read them. */
export const SESSION_COOKIES = { ACCESS, REFRESH, USER } as const;
