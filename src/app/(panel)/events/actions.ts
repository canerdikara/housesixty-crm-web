"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { FormState } from "@/lib/formState";

/**
 * Every write «Etkinlikler» makes — mockup screens 13 and 14.
 *
 * Same shape as the member and campaign actions: server actions so the bearer token stays
 * in an httpOnly cookie, a `FormState` back rather than a throw so the backend's own
 * Turkish message reaches the form.
 *
 * ⚠️ **`sendEventMessagesAction` reaches members' inboxes and phones.** It is the only
 * action here that does, and the backend refuses it outright (409) while
 * `CRM_CAMPAIGN_SENDING_ENABLED` is unset — the same switch as campaigns.
 */

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function write(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: unknown,
  ok: string
): Promise<FormState> {
  const result = await apiRequest<unknown>(path, { method, body });
  switch (result.kind) {
    case "ok":
      revalidatePath("/events", "layout");
      return { ok };
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}

function eventBody(form: FormData) {
  const capacity = str(form, "capacity");
  return {
    title: str(form, "title"),
    description: str(form, "description") || null,
    type: str(form, "type"),
    eventDate: str(form, "eventDate"),
    startTime: str(form, "startTime"),
    location: str(form, "location") || null,
    // Empty is "no limit", which the backend stores as null — never zero.
    capacity: capacity ? Number(capacity) : null,
    status: str(form, "status") || "DRAFT",
  };
}

/**
 * Create or update. Create lands on the new event's screen, because the next thing
 * anybody does with a new event is invite people to it.
 */
export async function saveEventAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "id");
  const body = eventBody(form);
  if (!body.title) return { error: "Etkinlik adı gerekli." };
  if (!body.eventDate || !body.startTime) return { error: "Tarih ve saat gerekli." };
  if (body.capacity !== null && (!Number.isInteger(body.capacity) || body.capacity < 1)) {
    return { error: "Kontenjan boş bırakılmalı ya da 1 veya üzeri olmalı." };
  }

  if (id) {
    const r = await write(`/api/v1/crm/events/${id}`, "PUT", body, "Etkinlik kaydedildi.");
    if (r.ok) redirect(`/events/${id}`);
    return r;
  }

  const result = await apiRequest<{ id: string }>("/api/v1/crm/events", { method: "POST", body });
  switch (result.kind) {
    case "ok":
      revalidatePath("/events", "layout");
      redirect(`/events/${result.data.id}`);
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}

export async function deleteEventAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "id");
  const result = await apiRequest<unknown>(`/api/v1/crm/events/${id}`, { method: "DELETE" });
  switch (result.kind) {
    case "ok":
      revalidatePath("/events", "layout");
      redirect("/events");
    case "unauthorized":
      redirect("/login");
    default:
      return { error: result.message };
  }
}

/** From a segment, or one picked member — whichever field the form carried. */
export async function inviteAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "eventId");
  const segmentId = str(form, "segmentId");
  const userId = str(form, "userId");
  if (!segmentId && !userId) return { error: "Bir segment seçin." };

  const result = await apiRequest<{ added: number; alreadyInvited: number }>(
    `/api/v1/crm/events/${id}/invite`,
    { method: "POST", body: segmentId ? { segmentId } : { userIds: [userId] } }
  );
  switch (result.kind) {
    case "ok": {
      revalidatePath("/events", "layout");
      const { added, alreadyInvited } = result.data;
      return {
        ok: added === 0
          ? `Yeni davetli yok${alreadyInvited ? ` — ${alreadyInvited} kişi zaten davetli` : ""}.`
          : `${added} üye davet listesine eklendi${alreadyInvited ? ` (${alreadyInvited} kişi zaten davetliydi)` : ""}.`,
      };
    }
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}

export async function uninviteAction(_prev: FormState, form: FormData): Promise<FormState> {
  return write(
    `/api/v1/crm/events/${str(form, "eventId")}/invitations/${str(form, "userId")}`,
    "DELETE", undefined, "Davet kaldırıldı."
  );
}

/** Staff recording an answer by hand. */
export async function setRsvpAction(_prev: FormState, form: FormData): Promise<FormState> {
  return write(
    `/api/v1/crm/events/${str(form, "eventId")}/invitations/${str(form, "userId")}/rsvp`,
    "PATCH", { rsvp: str(form, "rsvp") }, "Yanıt kaydedildi."
  );
}

export async function checkInAction(_prev: FormState, form: FormData): Promise<FormState> {
  return write(
    `/api/v1/crm/events/${str(form, "eventId")}/attendance`,
    "POST", { userId: str(form, "userId") }, "Katılım alındı."
  );
}

export async function undoCheckInAction(_prev: FormState, form: FormData): Promise<FormState> {
  return write(
    `/api/v1/crm/events/${str(form, "eventId")}/attendance/${str(form, "userId")}`,
    "DELETE", undefined, "Katılım geri alındı."
  );
}

/**
 * ⚠️ **This sends.** «Davet gönder» (everyone not yet sent to), «Hatırlat» (everyone who
 * has not answered), or one row's «Hatırlat» when `userId` is present.
 */
export async function sendEventMessagesAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "eventId");
  const kind = str(form, "kind");
  const channels = form.getAll("channel").map(String);
  const userId = str(form, "userId") || null;
  if (channels.length === 0) return { error: "En az bir kanal seçin." };

  const result = await apiRequest<{ sent: number; notSent: number }>(
    `/api/v1/crm/events/${id}/send`,
    { method: "POST", body: { kind, channels, userId } }
  );
  switch (result.kind) {
    case "ok": {
      revalidatePath("/events", "layout");
      const { sent, notSent } = result.data;
      return {
        ok: `${sent} üyeye ulaştı${notSent ? ` · ${notSent} üyeye ulaşılamadı (satırlardaki nota bakın)` : ""}.`,
      };
    }
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}
