"use server";

import { apiRequest } from "@/lib/api";
import type { GateAlert, GateSilence } from "@/lib/types";

/**
 * Turnstile warnings (V63) — polled by the warning bar on every panel page and by
 * «Turnikeler». A lapsed session answers `null` rather than redirecting: a banner must
 * never yank somebody off the page they are working on; the page's own calls do that.
 */

export async function gateAlertsAction(): Promise<GateAlert[] | null> {
  const r = await apiRequest<GateAlert[]>("/api/v1/crm/gate/alerts");
  return r.kind === "ok" ? r.data : null;
}

export async function dismissGateAlertAction(id: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const r = await apiRequest<unknown>(`/api/v1/crm/gate/alerts/${id}/dismiss`, { method: "POST" });
  return r.kind === "ok";
}

export async function gateSilenceAction(): Promise<GateSilence | null> {
  const r = await apiRequest<GateSilence>("/api/v1/crm/gate/silence");
  return r.kind === "ok" ? r.data : null;
}

export async function dismissGateSilenceAction(key: string): Promise<boolean> {
  const r = await apiRequest<unknown>("/api/v1/crm/gate/silence/dismiss", { method: "POST", body: { key: key.slice(0, 64) } });
  return r.kind === "ok";
}
