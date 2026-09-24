"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { FormState } from "@/lib/formState";
import type { CampaignDetail } from "@/lib/types";

/**
 * Every write the campaign screens make.
 *
 * Server actions rather than client fetches, for the reason the whole panel is
 * server-rendered: the bearer token lives in an httpOnly cookie and never reaches the
 * browser.
 *
 * ⚠️ **One of these sends real email to real members.** `sendCampaignAction` is the only
 * thing in this repo that does, and it is deliberately not reachable from any form that
 * also edits something — the screen puts it behind its own confirmation. The backend
 * refuses it outright unless `CRM_CAMPAIGN_SENDING_ENABLED` is set on the server, so
 * pressing it before the club has signed off produces a message, not an outbox.
 */

export type { FormState };

type SaveResult = { error: string } | { id: string };

/**
 * Create or update, sharing one path because the editor screen is the same screen.
 *
 * Returns the id rather than redirecting, so a failed save leaves the copy somebody has
 * written on screen with its message instead of navigating away from unfinished work.
 */
export async function saveCampaignAction(input: {
  id?: string;
  name: string;
  segmentId: string | null;
  subject: string;
  body: string;
}): Promise<SaveResult> {
  const editing = Boolean(input.id);
  const result = await apiRequest<CampaignDetail>(
    editing ? `/api/v1/crm/campaigns/${input.id}` : "/api/v1/crm/campaigns",
    {
      method: editing ? "PUT" : "POST",
      body: {
        name: input.name,
        segmentId: input.segmentId,
        subject: input.subject,
        body: input.body,
        // Only on create. The channel is fixed once the copy is written for a medium,
        // and the backend ignores it on an update — sending it would suggest otherwise
        // to the next reader.
        ...(editing ? {} : { channel: "EMAIL" }),
      },
    }
  );

  switch (result.kind) {
    case "ok":
      revalidatePath("/campaigns", "layout");
      return { id: result.data.campaign.id };
    case "unauthorized":
      redirect("/login");
    default:
      return { error: result.message };
  }
}

/**
 * ⚠️ **This sends.** Nothing else in the panel does.
 *
 * The success message names the number that actually left, because "gönderildi" alone
 * is the one thing somebody must not have to guess about afterwards. A campaign that
 * reaches nobody comes back `FAILED` from the backend and says so here.
 */
export async function sendCampaignAction(id: string): Promise<FormState> {
  const result = await apiRequest<CampaignDetail>(`/api/v1/crm/campaigns/${id}/send`, {
    method: "POST",
  });
  switch (result.kind) {
    case "ok": {
      const { funnel, campaign } = result.data;
      revalidatePath("/campaigns", "layout");
      if (campaign.status === "FAILED") {
        return {
          error:
            funnel.sent === 0 && funnel.suppressed > 0
              ? `Hiç gönderilmedi — ${funnel.suppressed} alıcının e-posta izni yok`
              : "Gönderim başarısız oldu. Alıcı listesindeki hata nedenlerine bakın.",
        };
      }
      return {
        ok:
          funnel.suppressed > 0
            ? `${funnel.sent} kişiye gönderildi · ${funnel.suppressed} kişi izin vermediği için atlandı`
            : `${funnel.sent} kişiye gönderildi`,
      };
    }
    case "unauthorized":
      redirect("/login");
    default:
      return { error: result.message };
  }
}

/** One copy to the signed-in user's own address. The address is not a parameter. */
export async function testSendAction(id: string): Promise<FormState> {
  const result = await apiRequest<{ message: string }>(`/api/v1/crm/campaigns/${id}/test`, {
    method: "POST",
  });
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind !== "ok") return { error: result.message };
  return { ok: result.data.message };
}

/**
 * Hands it to the dispatch job.
 *
 * The form sends an İzmir wall-clock date and time; this converts to the absolute
 * instant the backend compares against. Done here rather than in the browser so the
 * result does not depend on the timezone of the laptop the panel happens to be open on
 * — the same rule `lib/dates.ts` follows for display.
 */
export async function scheduleCampaignAction(
  id: string,
  izmirLocal: string
): Promise<FormState> {
  const at = izmirToInstant(izmirLocal);
  if (!at) return { error: "Tarih ve saat okunamadı" };

  const result = await apiRequest<CampaignDetail>(`/api/v1/crm/campaigns/${id}/schedule`, {
    method: "POST",
    body: { scheduledAt: at },
  });
  switch (result.kind) {
    case "ok":
      revalidatePath("/campaigns", "layout");
      return { ok: "Kampanya zamanlandı" };
    case "unauthorized":
      redirect("/login");
    default:
      return { error: result.message };
  }
}

export async function cancelCampaignAction(id: string): Promise<FormState> {
  const result = await apiRequest<CampaignDetail>(`/api/v1/crm/campaigns/${id}/cancel`, {
    method: "POST",
  });
  switch (result.kind) {
    case "ok":
      revalidatePath("/campaigns", "layout");
      return { ok: "Kampanya iptal edildi" };
    case "unauthorized":
      redirect("/login");
    default:
      return { error: result.message };
  }
}

export async function deleteCampaignAction(id: string): Promise<FormState> {
  const result = await apiRequest<unknown>(`/api/v1/crm/campaigns/${id}`, { method: "DELETE" });
  if (result.kind === "unauthorized") redirect("/login");
  // A sent campaign answers 409 here by design — its recipient rows are the club's
  // record that it emailed those people, and the message says so.
  if (result.kind !== "ok") return { error: result.message };
  revalidatePath("/campaigns", "layout");
  redirect("/campaigns");
}

/**
 * `"2026-10-04T09:30"` as typed into a datetime-local box, read as **İzmir** time.
 *
 * `new Date("2026-10-04T09:30")` parses a bare local string in the *runtime's* zone,
 * which is UTC on the server. A campaign the club schedules for 09:30 would go out at
 * 12:30 İzmir, and nothing about the result would look wrong until somebody noticed the
 * mail arrived three hours late.
 *
 * Turkey has been permanent UTC+3 with no DST since 2016, which is what makes the fixed
 * offset correct rather than merely convenient — the same assumption `hsCombine` makes
 * in both iOS apps.
 */
function izmirToInstant(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const t = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:00+03:00`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
