"use server";

import { redirect } from "next/navigation";
import { login as apiLogin } from "@/lib/api";
import { clearSession, writeSession } from "@/lib/session";
import { canAccessPanel, roleLabel } from "@/lib/roles";

export type LoginState = { error?: string };

/**
 * Where the login form may send someone afterwards.
 *
 * Only a same-origin path: it must start with a single `/`, and `//evil.example.com`
 * is a protocol-relative URL that browsers treat as absolute — which is how a login
 * form becomes an open redirect and lends this domain to a phishing page. Anything
 * that is not obviously an internal path falls back to the dashboard.
 */
function safeNext(next: FormDataEntryValue | null): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.startsWith("/login")) return "/";
  return next;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    return { error: "E-posta ve parola gerekli." };
  }

  const result = await apiLogin(email, password);

  if (result.kind !== "ok") {
    const message = result.kind === "error" ? result.message : "E-posta veya parola hatalı.";
    return { error: message };
  }

  const { accessToken, refreshToken, user } = result.data;

  /*
   * Role comes from the user object in AuthResponse, never from decoding the token.
   *
   * The access token does carry a `role` claim, so reading it here would work today —
   * and would keep working right up until the first refresh fifteen minutes later,
   * because the *refresh* token has no role claim. Reading it from the user object is
   * the same line of code and does not have a fifteen-minute fuse on it.
   */
  if (!canAccessPanel(user.role)) {
    // Credentials were valid — this is a real House Sixty member, trainer or guest who
    // typed them into the wrong login form. Say so plainly rather than "wrong
    // password", which would send them off resetting a password that works fine.
    await clearSession();
    return {
      error: `Bu hesabın CRM paneline erişimi yok (${roleLabel(user.role)}).`,
    };
  }

  await writeSession({ accessToken, refreshToken, user });
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
