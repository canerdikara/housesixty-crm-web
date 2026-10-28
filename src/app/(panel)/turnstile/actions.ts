"use server";

import { API_BASE } from "@/lib/api";
import type { EntryPoint, GateDirection, TurnstileDirection, TurnstileResult } from "@/lib/types";

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
 * `/access/qr/validate` is `permitAll` — a turnstile has no user to sign in as — so this
 * sends no `Authorization` header at all and cannot expire. What it sends instead is the
 * gate key (turnstile.md §8): `X-HS-Gate-Key` from `GATE_API_KEY`, read here on the
 * server and never shipped to the browser. **Only when the variable is non-empty** — the
 * backend treats a blank header as missing, and while its `GATE_REQUIRE_KEY` is false a
 * missing key still passes, which is what lets the panel ship before the key is set.
 * The *page* is still behind the panel's login and Amplify's basic auth; that is what
 * controls who can open a scanner, and it is unaffected by a stale token because opening
 * the page is a navigation.
 */
export async function validateScanAction(input: {
  token: string;
  entryPoint: EntryPoint;
  direction: GateDirection;
}): Promise<TurnstileResult> {
  if (!API_BASE) {
    return { valid: false, memberName: null, userId: null, message: "CRM_API_BASE_URL ayarlı değil" };
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const gateKey = process.env.GATE_API_KEY?.trim();
    if (gateKey) headers["X-HS-Gate-Key"] = gateKey;

    const res = await fetch(`${API_BASE}/api/v1/access/qr/validate`, {
      method: "POST",
      headers,
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
        // 401 here is only ever the gate key (GATE_KEY_INVALID / GATE_KEY_REQUIRED): the
        // endpoint has no other authentication. Say so, or it reads as a member's problem.
        message:
          res.status === 401
            ? "Turnike anahtarı reddedildi — panelin GATE_API_KEY değeri sunucununkiyle aynı olmalı"
            : `Sunucu ${res.status} döndü`,
      };
    }
    return (await res.json()) as TurnstileResult;
  } catch (err) {
    // Path and error only, never the token — it is a live credential for 60 seconds.
    console.error("[turnstile] validate failed:", String(err));
    return { valid: false, memberName: null, userId: null, message: "Sunucuya ulaşılamadı" };
  }
}

/**
 * The supplier's turnstile (V60): the member's QR is one of the club's static 6-digit codes,
 * and the real reader reports `{reader, slot}` to `/access/gate/scan` after opening. The
 * panel never knows the slot numbers — the code list is the developers' and no panel route
 * shows it — so this sends the **code** instead, which the backend resolves itself.
 *
 * Same no-session reasoning as [validateScanAction] above; the key is required here.
 * The answer is an outcome, never a name: the same endpoint answers a third party.
 */
export async function scanCodeAction(input: {
  code: string;
  reader: number;
  direction: TurnstileDirection;
}): Promise<TurnstileResult> {
  const fail = (message: string): TurnstileResult => ({ valid: false, memberName: null, userId: null, message });
  if (!API_BASE) return fail("CRM_API_BASE_URL ayarlı değil");
  if (!/^\d{6}$/.test(input.code) || ![1, 2, 3, 4].includes(input.reader)) return fail("Geçersiz okutma");

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const gateKey = process.env.GATE_API_KEY?.trim();
    if (gateKey) headers["X-HS-Gate-Key"] = gateKey;

    const res = await fetch(`${API_BASE}/api/v1/access/gate/scan`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reader: input.reader, code: input.code }),
      cache: "no-store",
    });
    if (!res.ok) {
      return fail(
        res.status === 401
          ? "Turnike anahtarı reddedildi — panelin GATE_API_KEY değeri sunucununkiyle aynı olmalı"
          : res.status === 400
            ? "Sunucu bu okuyucuyu tanımıyor (GATE_READERS)"
            : `Sunucu ${res.status} döndü`,
      );
    }
    const { outcome } = (await res.json()) as { outcome: "ATTRIBUTED" | "DUPLICATE" | "UNKNOWN" };
    const direction = input.direction;
    switch (outcome) {
      case "ATTRIBUTED":
        return { valid: true, memberName: null, userId: null, direction, message: "Kodu o an tutan kişiye kaydedildi" };
      case "DUPLICATE":
        return { valid: true, memberName: null, userId: null, direction, message: "Aynı okuyucuda tekrar okuma — tek geçiş sayıldı" };
      default:
        return {
          ...fail("Bu kodu şu an kimse tutmuyor. Gerçek turnike yine de açılır; «bilinmeyen geçiş» olarak kaydedildi."),
          reason: "UNKNOWN_CODE",
          direction,
        };
    }
  } catch (err) {
    // Path and error only, never the code.
    console.error("[turnstile] scan failed:", String(err));
    return fail("Sunucuya ulaşılamadı");
  }
}
