/**
 * Reads the `exp` claim out of a JWT **without verifying it**.
 *
 * That is deliberate and safe here, because nothing security-relevant is decided from
 * the result. The only question being asked is "is it worth spending a round trip to
 * refresh this before the page renders" — and the backend still verifies the signature
 * on every single request regardless of what this function says. A forged token with a
 * distant `exp` buys an attacker exactly one thing: their own forged token being sent
 * to a backend that rejects it.
 *
 * Verifying properly would mean shipping the JWT secret to the panel, which is a far
 * worse trade than trusting a timestamp we only use as a scheduling hint.
 *
 * Runs in the Edge runtime, so no Buffer and no Node crypto — `atob` and manual
 * base64url padding only.
 */
export function jwtExpiresAt(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    // base64url → base64, then pad to a multiple of 4. atob rejects unpadded input.
    const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    // Unparseable is treated the same as expired by the caller, which is the right
    // failure direction: refresh, and let the backend be the judge.
    return null;
  }
}

/**
 * Refresh this far before the token actually expires.
 *
 * Without a skew a token with four seconds left passes the check, and then the request
 * it was fetched for arrives at the backend expired — a 401 the panel then has no
 * chance to recover from within that render. Sixty seconds is comfortably longer than
 * any request here takes and costs one extra refresh per fifteen-minute cycle.
 */
export const REFRESH_SKEW_MS = 60_000;
