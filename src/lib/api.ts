import "server-only";

import { clearSession, readSession, writeSession, type Session, type SessionUser } from "./session";

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
 *  - `unauthorized` — refresh failed or there is no session. Send them to login.
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

/**
 * Exchanges the refresh token for a new pair, and rewrites the session.
 *
 * **The role trap.** `/auth/refresh` returns a full `AuthResponse` including the whole
 * user object, and that is where the role must come from. The refresh token itself
 * carries only `sub`, `type`, `iat` and `exp` — **no `role` claim**. Any code that
 * reads the role out of the token comes up empty fifteen minutes into every session,
 * once the first refresh has happened. So the user object is rewritten here from the
 * response body, not preserved from the old session.
 */
async function refreshSession(session: Session): Promise<Session | null> {
  const res = await fetch(`${requireBase()}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // camelCase and @NotBlank on the backend — `refresh_token` is silently rejected.
    body: JSON.stringify({ refreshToken: session.refreshToken }),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const auth = (await res.json()) as AuthResponse;
  const next: Session = {
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    user: auth.user,
  };
  await writeSession(next);
  return next;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  /** Forwarded to fetch. Defaults to no-store — CRM data is never stale-served. */
  cache?: RequestCache;
  signal?: AbortSignal;
};

/**
 * An authenticated call to the backend, with one refresh-and-replay on 401.
 *
 * ## The rule this exists to enforce
 *
 * - **401** → the token is expired or absent. Refresh once and replay the original
 *   request. If the replay is also 401, the session is genuinely dead: clear it and
 *   report `unauthorized`.
 * - **403** → the caller is authenticated but lacks the role. Report `forbidden` and
 *   **do not refresh and do not log out.** Refreshing would not help, and logging out
 *   turns "you cannot see the consent log" into "you have been signed out", which
 *   staff read as a broken panel.
 *
 * The backend's `SecurityConfig` has an `exceptionHandling` block specifically to keep
 * these two apart — without it Spring falls back to `Http403ForbiddenEntryPoint` and
 * answers 403 for an *expired* token, which would silently kill every session here at
 * the fifteen-minute mark. If sessions ever start dying on the hour, check that block
 * before looking at this file.
 *
 * Only one replay, never a loop: if a fresh token is still refused, retrying cannot
 * change the answer and would only turn a dead session into a hot loop against the API.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  let session = await readSession();
  if (!session) return { kind: "unauthorized" };

  const send = (token: string) =>
    fetch(`${requireBase()}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: options.cache ?? "no-store",
      signal: options.signal,
    });

  let res: Response;
  try {
    res = await send(session.accessToken);
  } catch {
    return { kind: "error", status: 0, message: "Sunucuya ulaşılamadı." };
  }

  if (res.status === 401) {
    const refreshed = await refreshSession(session);
    if (!refreshed) {
      await clearSession();
      return { kind: "unauthorized" };
    }
    session = refreshed;
    try {
      res = await send(session.accessToken);
    } catch {
      return { kind: "error", status: 0, message: "Sunucuya ulaşılamadı." };
    }
    if (res.status === 401) {
      await clearSession();
      return { kind: "unauthorized" };
    }
  }

  // Deliberately after the 401 branch and deliberately not falling into it.
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
