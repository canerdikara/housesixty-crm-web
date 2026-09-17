import "server-only";

import { readSession, type SessionUser } from "./session";

/**
 * The panel's only route to the backend. Server-side, always.
 *
 * `server-only` at the top makes importing this from a client component a build error
 * rather than a runtime surprise — which matters, because everything below reads the
 * session cookies and attaches a bearer token.
 */

export const API_BASE = (process.env.CRM_API_BASE_URL ?? "").replace(/\/$/, "");

/** Backend error envelope: `{ status, error, message, timestamp }`. */
export type ApiError = {
  status: number;
  error: string;
  message: string;
};

/**
 * The result of a call.
 *
 * A discriminated union rather than exceptions, because the three failure modes here
 * mean genuinely different things to the caller and collapsing them into one `throw`
 * is how the 401/403 distinction gets lost:
 *
 *  - `ok`         — the data.
 *  - `unauthorized` — no session, or the token was refused despite middleware having
 *                   just ensured a fresh one. Send them to login.
 *  - `forbidden`  — signed in, wrong role. Show a permission message. **Never log out.**
 *  - `error`      — everything else, with the backend's own message.
 */
export type ApiResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized" }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; status: number; message: string };

/** `AuthResponse` — access token, refresh token, and the complete user. */
type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

function requireBase(): string {
  if (!API_BASE) {
    // Loud, immediately, with the fix in the message. The alternative is every screen
    // rendering an empty state because fetch("/api/v1/...") resolved against the panel
    // itself and 404'd — which looks like a data problem and is not one.
    throw new Error(
      "CRM_API_BASE_URL is not set. Point it at the backend, scheme and host only."
    );
  }
  return API_BASE;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as Partial<ApiError>;
    if (typeof body.message === "string" && body.message.length > 0) return body.message;
  } catch {
    /* not JSON — fall through */
  }
  return `Beklenmeyen bir hata oluştu (${res.status}).`;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  /**
   * A multipart body, for the one endpoint that takes a file (the scanned contract).
   *
   * Mutually exclusive with `body`. **`Content-Type` is deliberately not set** when
   * this is used: fetch has to write it itself so it can append the multipart boundary,
   * and setting it by hand produces a body the server cannot parse — with an error that
   * blames the file rather than the header.
   */
  formData?: FormData;
  /** Forwarded to fetch. Defaults to no-store — CRM data is never stale-served. */
  cache?: RequestCache;
  signal?: AbortSignal;
};

/**
 * An authenticated call to the backend.
 *
 * ## This function does not refresh
 *
 * Token refresh happens in `middleware.ts`, before the render starts, and that is not
 * a stylistic choice: **Next.js throws if cookies are written during a Server
 * Component render**. Refreshing here would therefore have to either crash the page or
 * discard the new tokens and refresh again on every subsequent request. Middleware may
 * write cookies, so it does the refresh, and by the time this function runs the access
 * token is already fresh.
 *
 * ## The rule this exists to enforce
 *
 * - **401** → the token was rejected even though middleware had just ensured a fresh
 *   one, so it has been revoked or the account is gone. Report `unauthorized`; the
 *   caller sends them to login and middleware clears the cookies on the way.
 * - **403** → authenticated, wrong role. Report `forbidden`, and **do not log out**.
 *   A refresh would not help, and signing someone out turns "you cannot see the
 *   consent log" into "the panel is broken".
 *
 * The backend's `SecurityConfig` has an `exceptionHandling` block specifically to keep
 * these apart — without it Spring falls back to `Http403ForbiddenEntryPoint` and
 * answers 403 for an *expired* token. If sessions ever start dying on the
 * fifteen-minute mark, check that block before looking at this file.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  const session = await readSession();
  if (!session) return { kind: "unauthorized" };

  let res: Response;
  try {
    res = await fetch(`${requireBase()}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      cache: options.cache ?? "no-store",
      signal: options.signal,
    });
  } catch {
    return { kind: "error", status: 0, message: "Sunucuya ulaşılamadı." };
  }

  if (res.status === 401) {
    return { kind: "unauthorized" };
  }

  // Deliberately a separate branch from 401 and deliberately not falling into it.
  if (res.status === 403) {
    return { kind: "forbidden", message: await readError(res) };
  }

  if (!res.ok) {
    return { kind: "error", status: res.status, message: await readError(res) };
  }

  // 204, or a 200 with an empty body. Several backend endpoints answer this way and
  // res.json() would throw on them.
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return { kind: "ok", data: undefined as T };
  }

  try {
    return { kind: "ok", data: (await res.json()) as T };
  } catch {
    return { kind: "ok", data: undefined as T };
  }
}

/**
 * Signs in and returns the full `AuthResponse`.
 *
 * Unauthenticated, so it does not go through [apiRequest] — there is no session to
 * attach yet. The caller decides whether the resulting role may use the panel and
 * whether to write a session.
 */
export async function login(
  email: string,
  password: string
): Promise<ApiResult<AuthResponse>> {
  let res: Response;
  try {
    res = await fetch(`${requireBase()}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return { kind: "error", status: 0, message: "Sunucuya ulaşılamadı." };
  }

  if (res.status === 401 || res.status === 403) {
    // Both are "these credentials do not work", and the panel says exactly that for
    // either. Distinguishing a wrong password from a disabled account would confirm
    // which addresses are real to anyone probing the login form.
    return { kind: "error", status: res.status, message: "E-posta veya parola hatalı." };
  }

  if (!res.ok) {
    return { kind: "error", status: res.status, message: await readError(res) };
  }

  return { kind: "ok", data: (await res.json()) as AuthResponse };
}
