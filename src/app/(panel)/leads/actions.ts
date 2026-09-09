"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { LeadDetail } from "@/lib/types";

/**
 * Every write the lead screens make.
 *
 * Server actions rather than client-side fetches, for the same reason the whole panel
 * is server-rendered: the bearer token lives in an httpOnly cookie and never reaches
 * the browser. A client component posting to the API directly would need it there.
 *
 * They all return a `FormState` instead of throwing. A thrown error in a server action
 * becomes a generic error page and loses the message the backend took the trouble to
 * write — and those messages are the useful part here ("A reason is required when
 * marking a lead as lost", "An email address is required to create a member").
 */

export type FormState = {
  error?: string;
  ok?: string;
};

/**
 * Turns an `ApiResult` into something a form can render.
 *
 * `forbidden` is deliberately not a redirect. A 403 means wrong role, and signing
 * someone out for it turns a permissions message into an apparently broken panel.
 */
async function write(
  path: string,
  body: unknown,
  method: "POST" | "PATCH",
  successMessage: string
): Promise<FormState> {
  const result = await apiRequest<unknown>(path, { method, body });

  switch (result.kind) {
    case "ok":
      // The detail screen and the list both read this lead. Revalidating the layout
      // segment covers both without naming every route that might show it.
      revalidatePath("/leads", "layout");
      return { ok: successMessage };
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function updateStatusAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "leadId");
  const status = str(form, "status");
  const lostReason = str(form, "lostReason");

  if (!status) return { error: "Durum seçilmedi." };

  // Caught here as well as on the backend so the message arrives without a round trip
  // and, more usefully, so the reason box can stay open with what they typed still in
  // it. The backend check is the one that actually enforces it.
  if (status === "LOST" && !lostReason) {
    return { error: "Olumsuz olarak işaretlemek için bir sebep gerekli." };
  }
  if (status === "WON") {
    return { error: "Üye oldu durumu, «Üyeye dönüştür» ile ayarlanır." };
  }

  return write(
    `/api/v1/crm/leads/${id}/status`,
    { status, lostReason: lostReason || null },
    "PATCH",
    "Durum güncellendi."
  );
}

export async function updateOwnerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "leadId");
  const ownerUserId = str(form, "ownerUserId");
  // An empty selection returns the lead to the unassigned pool, which is a real action
  // and not a validation failure.
  return write(
    `/api/v1/crm/leads/${id}/owner`,
    { ownerUserId: ownerUserId || null },
    "PATCH",
    ownerUserId ? "Sorumlu atandı." : "Sorumlu kaldırıldı."
  );
}

export async function addInteractionAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "leadId");
  const type = str(form, "type");
  const note = str(form, "note");
  const occurredOn = str(form, "occurredOn");

  if (!note) return { error: "Not boş olamaz." };

  /*
   * A date-only input, interpreted as İzmir noon.
   *
   * The field asks "when did this happen", and the answer is a day, not an instant.
   * Sending midnight would land the previous day for anyone whose browser is behind
   * İzmir, and midnight UTC is 03:00 İzmir — either way the entry can show up on the
   * wrong date. Noon is far enough from both boundaries that no plausible offset
   * moves it. Empty means now, which is the common case.
   */
  const occurredAt = occurredOn ? new Date(`${occurredOn}T12:00:00+03:00`).toISOString() : null;

  return write(
    `/api/v1/crm/leads/${id}/interactions`,
    { type, note, occurredAt },
    "POST",
    "Etkileşim kaydedildi."
  );
}

export async function updateLeadAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "leadId");
  const nextActionOn = str(form, "nextActionOn");

  // Only fields the user actually filled are sent. The PATCH treats null as "leave
  // alone", so sending empty strings would be indistinguishable from clearing them —
  // which the endpoint deliberately cannot express yet.
  const body: Record<string, unknown> = {};
  const notes = str(form, "notes");
  const nextActionNote = str(form, "nextActionNote");
  if (notes) body.notes = notes;
  if (nextActionNote) body.nextActionNote = nextActionNote;
  if (nextActionOn) body.nextActionAt = new Date(`${nextActionOn}T12:00:00+03:00`).toISOString();

  if (Object.keys(body).length === 0) return { error: "Değişiklik yok." };

  return write(`/api/v1/crm/leads/${id}`, body, "PATCH", "Kaydedildi.");
}

/**
 * Creates a lead from the manual-entry form, then opens it.
 *
 * The redirect is outside the try/catch on purpose — `redirect()` works by throwing,
 * so catching around it would swallow the navigation and leave the user on a form
 * that appears to have done nothing.
 */
export async function createLeadAction(_prev: FormState, form: FormData): Promise<FormState> {
  const fullName = str(form, "fullName");
  const phone = str(form, "phone");
  const email = str(form, "email");

  if (!fullName) return { error: "Ad soyad gerekli." };
  if (!phone && !email) return { error: "Telefon veya e-posta gerekli." };
  if (form.get("consentGranted") !== "on") {
    // Not a nicety. Typing someone's details into the CRM is processing personal data
    // exactly as the website form is, and KVKK does not care that a staff member did
    // the typing.
    return { error: "KVKK rızası olmadan aday kaydedilemez." };
  }

  const birthYear = str(form, "birthYear");
  const channels = form.getAll("consentChannels").map(String).filter(Boolean);

  const result = await apiRequest<LeadDetail>("/api/v1/crm/leads", {
    method: "POST",
    body: {
      fullName,
      phone: phone || null,
      email: email || null,
      birthYear: birthYear ? Number(birthYear) : null,
      occupation: str(form, "occupation") || null,
      company: str(form, "company") || null,
      city: str(form, "city") || null,
      interestedIn: str(form, "interestedIn") || null,
      source: str(form, "source") || "WALK_IN",
      notes: str(form, "notes") || null,
      consentGranted: true,
      consentTextVersion: str(form, "consentTextVersion") || "v1.0",
      consentChannels: channels,
    },
  });

  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind !== "ok") {
    return { error: result.kind === "forbidden" ? `Yetkiniz yok: ${result.message}` : result.message };
  }

  revalidatePath("/leads", "layout");
  redirect(`/leads/${result.data.id}`);
}

export async function convertLeadAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "leadId");
  const email = str(form, "email");
  const phone = str(form, "phone");

  const result = await apiRequest<{ createdUser: boolean; guestAccountToReview: string | null }>(
    `/api/v1/crm/leads/${id}/convert`,
    { method: "POST", body: { email: email || null, phone: phone || null } }
  );

  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind !== "ok") {
    return { error: result.kind === "forbidden" ? `Yetkiniz yok: ${result.message}` : result.message };
  }

  revalidatePath("/leads", "layout");
  const base = result.data.createdUser
    ? "Üye kaydı oluşturuldu. Üye ilk girişini yapmayı bekliyor."
    : "Aday mevcut bir üyeye bağlandı.";
  return {
    ok: result.data.guestAccountToReview
      ? `${base} Aynı telefona sahip bir misafir hesabı var — birleştirme kararı sizde.`
      : base,
  };
}
