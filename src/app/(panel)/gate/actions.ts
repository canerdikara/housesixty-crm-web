"use server";

import { apiRequest } from "@/lib/api";
import type {
  GateAction,
  GateCommandLogItem,
  GateCommandStatus,
  GatePerson,
  GateStatus,
  TurnstileDirection,
} from "@/lib/types";

/**
 * «Turnikeler»'s calls to `/api/v1/crm/gate/*` (turnstile.md §9).
 *
 * All go through `apiRequest`, so unlike the simulator's validate call these **need a live
 * session** — and this page stays open all shift without navigating. `middleware.ts`
 * refreshes the token on every request its matcher covers, server-action POSTs included,
 * and the page also calls `router.refresh()` every few minutes as a belt to those braces
 * (§9.5). If a session does lapse, every action answers `{ kind: "unauthorized" }` and the
 * page sends the browser to /login itself — a redirect thrown from an action called by a
 * client component would otherwise surface as an error.
 */

export type Unauthorized = { kind: "unauthorized" };

export async function gateStatusAction(): Promise<{ kind: "ok"; data: GateStatus } | Unauthorized | { kind: "error"; message: string }> {
  const r = await apiRequest<GateStatus>("/api/v1/crm/gate/status");
  if (r.kind === "ok") return { kind: "ok", data: r.data };
  if (r.kind === "unauthorized") return r;
  return { kind: "error", message: r.message };
}

export type CreateCommandResult =
  | { kind: "ok"; id: string }
  | Unauthorized
  /** 409 GATE_OFFLINE — the bridge is not answering; open by hand. Never queued. */
  | { kind: "offline"; message: string }
  | { kind: "error"; message: string };

export async function createGateCommandAction(input: {
  turnstile: string;
  action: GateAction;
  direction?: TurnstileDirection;
  subjectUserId?: string;
  reservationId?: string;
  reason?: string;
}): Promise<CreateCommandResult> {
  const r = await apiRequest<{ id: string }>("/api/v1/crm/gate/commands", { method: "POST", body: input });
  if (r.kind === "ok") return { kind: "ok", id: r.data.id };
  if (r.kind === "unauthorized") return r;
  if (r.kind === "error" && r.status === 409) return { kind: "offline", message: r.message };
  return { kind: "error", message: r.message };
}

export async function gateCommandAction(
  id: string,
): Promise<{ kind: "ok"; status: GateCommandStatus; resultMessage: string | null } | Unauthorized | { kind: "error"; message: string }> {
  // The id comes from our own create call, but it still goes into a path — refuse anything
  // that is not a UUID rather than trusting it.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { kind: "error", message: "Geçersiz komut" };
  const r = await apiRequest<{ status: GateCommandStatus; resultMessage: string | null }>(`/api/v1/crm/gate/commands/${id}`);
  if (r.kind === "ok") return { kind: "ok", status: r.data.status, resultMessage: r.data.resultMessage };
  if (r.kind === "unauthorized") return r;
  return { kind: "error", message: r.message };
}

export async function gateLogAction(): Promise<{ kind: "ok"; data: GateCommandLogItem[] } | Unauthorized | { kind: "error"; message: string }> {
  const r = await apiRequest<GateCommandLogItem[]>("/api/v1/crm/gate/commands");
  if (r.kind === "ok") return { kind: "ok", data: r.data };
  if (r.kind === "unauthorized") return r;
  return { kind: "error", message: r.message };
}

export async function gatePeopleAction(q: string): Promise<{ kind: "ok"; data: GatePerson[] } | Unauthorized | { kind: "error"; message: string }> {
  const term = q.trim();
  if (term.length < 2) return { kind: "ok", data: [] };
  const r = await apiRequest<GatePerson[]>(`/api/v1/crm/gate/people?q=${encodeURIComponent(term)}`);
  if (r.kind === "ok") return { kind: "ok", data: r.data };
  if (r.kind === "unauthorized") return r;
  return { kind: "error", message: r.message };
}
