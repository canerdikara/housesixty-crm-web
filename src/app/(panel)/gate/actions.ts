"use server";

import { apiRequest, type ApiResult } from "@/lib/api";
import { izmirLocalInputToIso } from "@/lib/dates";
import type { DeskVisit, GatePerson } from "@/lib/types";

/**
 * «Turnikeler»'s calls to `/api/v1/crm/gate/visits*` (V61): the desk's hand-written log of
 * who it let through with the turnstile's physical button.
 *
 * All go through `apiRequest`, so they need a live session — and this page stays open all
 * shift. `middleware.ts` refreshes the token on every request its matcher covers, server-
 * action POSTs included, and the page also calls `router.refresh()` every few minutes. If a
 * session does lapse, every action answers `{ kind: "unauthorized" }` and the page sends the
 * browser to /login itself (a redirect thrown from an action called by a client component
 * would otherwise surface as an error).
 *
 * Times arrive as `datetime-local` text and are read as İzmir time here, on the server, so
 * the laptop's own time zone never shifts a record.
 */

export type Unauthorized = { kind: "unauthorized" };
type Result<T> = { kind: "ok"; data: T } | Unauthorized | { kind: "error"; message: string };

const UUID = /^[0-9a-f-]{36}$/i;

function settle<T>(r: ApiResult<T>): Result<T> {
  if (r.kind === "ok") return { kind: "ok", data: r.data };
  if (r.kind === "unauthorized") return r;
  return { kind: "error", message: r.message };
}

export async function deskPeopleAction(q: string): Promise<Result<GatePerson[]>> {
  const term = q.trim();
  if (term.length < 2) return { kind: "ok", data: [] };
  return settle(await apiRequest<GatePerson[]>(`/api/v1/crm/gate/visits/people?q=${encodeURIComponent(term)}`));
}

export async function createDeskVisitAction(input: {
  userId?: string;
  guestName?: string;
  note?: string;
  entryLocal: string;
}): Promise<Result<DeskVisit>> {
  const entryAt = izmirLocalInputToIso(input.entryLocal);
  if (!entryAt) return { kind: "error", message: "Giriş tarihini ve saatini seçin" };
  if (input.userId && !UUID.test(input.userId)) return { kind: "error", message: "Geçersiz kişi" };
  return settle(
    await apiRequest<DeskVisit>("/api/v1/crm/gate/visits", {
      method: "POST",
      body: {
        userId: input.userId || undefined,
        guestName: input.guestName?.trim() || undefined,
        note: input.note?.trim() || undefined,
        entryAt,
      },
    }),
  );
}

export async function exitDeskVisitAction(id: string, exitLocal: string): Promise<Result<DeskVisit>> {
  if (!UUID.test(id)) return { kind: "error", message: "Geçersiz kayıt" };
  const exitAt = izmirLocalInputToIso(exitLocal);
  if (!exitAt) return { kind: "error", message: "Çıkış tarihini ve saatini seçin" };
  return settle(await apiRequest<DeskVisit>(`/api/v1/crm/gate/visits/${id}/exit`, { method: "POST", body: { exitAt } }));
}

export async function deleteDeskVisitAction(id: string): Promise<Result<null>> {
  if (!UUID.test(id)) return { kind: "error", message: "Geçersiz kayıt" };
  const r = await apiRequest<unknown>(`/api/v1/crm/gate/visits/${id}`, { method: "DELETE" });
  if (r.kind === "ok") return { kind: "ok", data: null };
  if (r.kind === "unauthorized") return r;
  return { kind: "error", message: r.message };
}

/** The «Çıkış» list and the day's log, together — one refresh after every change. */
export async function deskVisitsAction(date: string): Promise<Result<{ open: DeskVisit[]; day: DeskVisit[] }>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { kind: "error", message: "Geçersiz tarih" };
  const [open, day] = await Promise.all([
    apiRequest<DeskVisit[]>("/api/v1/crm/gate/visits/open"),
    apiRequest<DeskVisit[]>(`/api/v1/crm/gate/visits?date=${date}`),
  ]);
  if (open.kind === "unauthorized" || day.kind === "unauthorized") return { kind: "unauthorized" };
  if (open.kind !== "ok") return { kind: "error", message: open.message };
  if (day.kind !== "ok") return { kind: "error", message: day.message };
  return { kind: "ok", data: { open: open.data, day: day.data } };
}
