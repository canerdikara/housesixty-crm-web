"use server";

import { API_BASE } from "@/lib/api";
import type { EntryPoint, TurnstileDirection, TurnstileResult } from "@/lib/types";

/**
 * Posting a scanned QR token to the backend, exactly as a real turnstile would.
 *
 * ## ⚠️ This one call deliberately does NOT go through `apiRequest`
 *
 * Every other server action in this panel uses it, and this one must not, for a reason
 * that only shows up after fifteen minutes: `apiRequest` requires a live session and
 * reports `unauthorized` when the access token has expired, which the caller turns into
 * a redirect to `/login`.
 *
 * That is right for every screen, because a screen is reached by navigating and
 * `middleware.ts` refreshes the token on the way in. **The scanner never navigates.** It
 * is a tab left open on a desk firing one action per scan, so its access token expires
 * under it and the next scan would bounce the whole page to the login screen mid-shift.
 *
 * `/access/qr/validate` is `permitAll` — a turnstile has no credentials, which is the
 * whole point of it — so this sends no `Authorization` header at all and cannot expire.
 * The *page* is still behind the panel's login and Amplify's basic auth; that is what
 * controls who can open a scanner, and it is unaffected by a stale token because opening
 * the page is a navigation.
 */
export async function validateScanAction(input: {
  token: string;
  entryPoint: EntryPoint;
  direction: TurnstileDirection;
}): Promise<TurnstileResult> {
  if (!API_BASE) {
    return { valid: false, memberName: null, userId: null, message: "CRM_API_BASE_URL ayarlı değil" };
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/access/qr/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });

    if (!res.ok) {
      // A turnstile would light red and let the person try again, so the page says what
      // happened rather than throwing — a thrown error in a server action becomes a
      // generic error page and takes the scanner down with it.
      return {
        valid: false,
        memberName: null,
        userId: null,
        message: `Sunucu ${res.status} döndü`,
      };
    }
    return (await res.json()) as TurnstileResult;
  } catch (err) {
    // Path and error only, never the token — it is a live credential for 60 seconds.
    console.error("[turnstile] validate failed:", String(err));
    return { valid: false, memberName: null, userId: null, message: "Sunucuya ulaşılamadı" };
  }
}
