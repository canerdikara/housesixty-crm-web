"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { FormState } from "@/lib/formState";
import type { SegmentDetail, SegmentPreview, SegmentRule } from "@/lib/types";

/**
 * Every write the segment screens make, plus the live preview.
 *
 * Server actions rather than client fetches, for the reason the whole panel is
 * server-rendered: the bearer token lives in an httpOnly cookie and never reaches the
 * browser. The builder screen is a client component and still never sees it.
 */

export type { FormState };

/** The builder posts rules on every change; this is the only read that is an action. */
export type PreviewState =
  | { kind: "ok"; preview: SegmentPreview }
  | { kind: "error"; message: string };

/**
 * `POST /crm/segments/preview` — what these rules match, without saving.
 *
 * Errors come back as a value rather than a throw because they are **expected**: a
 * half-finished rule is invalid by definition, and the builder shows the backend's own
 * message ("last_visit_days needs a whole number") beside the count rather than an error
 * page. Debouncing is the caller's job — see `SegmentBuilder`.
 */
export async function previewSegmentAction(rules: SegmentRule[]): Promise<PreviewState> {
  const result = await apiRequest<SegmentPreview>("/api/v1/crm/segments/preview", {
    method: "POST",
    body: { rules },
  });
  switch (result.kind) {
    case "ok":
      return { kind: "ok", preview: result.data };
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { kind: "error", message: result.message };
    default:
      return { kind: "error", message: result.message };
  }
}

type SaveResult = { error: string } | { id: string };

/**
 * Create or update, sharing one path because the builder screen is the same screen.
 *
 * Returns the id instead of redirecting: the caller redirects, so that a failed save
 * leaves the half-built segment on screen with its message rather than navigating away
 * from work somebody has not finished.
 */
export async function saveSegmentAction(input: {
  id?: string;
  name: string;
  description?: string;
  isDynamic: boolean;
  rules: SegmentRule[];
}): Promise<SaveResult> {
  const editing = Boolean(input.id);
  const result = await apiRequest<SegmentDetail>(
    editing ? `/api/v1/crm/segments/${input.id}` : "/api/v1/crm/segments",
    {
      method: editing ? "PUT" : "POST",
      // `isDynamic` is fixed at creation, so an update must not carry it — the backend
      // ignores it there, and sending it would suggest otherwise to the next reader.
      body: editing
        ? { name: input.name, description: input.description, rules: input.rules }
        : input,
    }
  );

  switch (result.kind) {
    case "ok":
      revalidatePath("/segments", "layout");
      return { id: result.data.segment.id };
    case "unauthorized":
      redirect("/login");
    default:
      return { error: result.message };
  }
}

export async function runSegmentAction(id: string): Promise<FormState> {
  const result = await apiRequest<SegmentDetail>(`/api/v1/crm/segments/${id}/run`, {
    method: "POST",
  });
  switch (result.kind) {
    case "ok":
      revalidatePath("/segments", "layout");
      return { ok: `Yeniden hesaplandı — ${result.data.preview.matched} üye` };
    case "unauthorized":
      redirect("/login");
    default:
      return { error: result.message };
  }
}

export async function deleteSegmentAction(id: string): Promise<FormState> {
  const result = await apiRequest<unknown>(`/api/v1/crm/segments/${id}`, { method: "DELETE" });
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind !== "ok") return { error: result.message };
  revalidatePath("/segments", "layout");
  // Deleting from the detail screen leaves nowhere to go back to.
  redirect("/segments");
}
