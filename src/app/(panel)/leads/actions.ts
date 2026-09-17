"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { FormState } from "@/lib/formState";
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

export type { FormState };

/**
 * Turns an `ApiResult` into something a form can render.
 *
 * `forbidden` is deliberately not a redirect. A 403 means wrong role, and signing
 * someone out for it turns a permissions message into an apparently broken panel.
 */
async function write(
  path: string,
  body: unknown,
  method: "POST" | "PATCH" | "PUT",
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
  const note = str(form, "note");
  const occurredOn = str(form, "occurredOn");

  /*
   * «Tür» is a radio group — one channel per entry (2026-09-16). `getAll` still reads
   * it, which is why this did not have to change when the control did, and it keeps
   * working if a caller ever posts several again.
   *
   * The empty check stays even though a radio group cannot be emptied from the UI: a
   * form post is not a promise about the form, and the backend would otherwise reject
   * the body with its own unhelpful enum parse error.
   */
  const types = form.getAll("type").map((v) => String(v).trim()).filter(Boolean);
  const [type, ...additionalTypes] = types;

  if (!type) return { error: "En az bir tür seçin." };
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
    { type, additionalTypes, note, occurredAt },
    "POST",
    "Etkileşim kaydedildi."
  );
}

/**
 * The whole of a lead's profile, from the detail screen's editor.
 *
 * A **PUT**, unlike `updateLeadAction` beside it: every field is sent every time, so an
 * emptied box clears the field. That is the only way to correct a lead — the PATCH
 * cannot express "no company after all" — and the form says so above the first input.
 *
 * Nothing here touches notes, the next action, the status or the owner. Each has its
 * own control on the same screen, and folding them in would mean one form quietly
 * wiping what another just saved.
 */
/**
 * Assembles «gün · ay · yıl» into what the backend takes.
 *
 * Three outcomes, and the middle one is the point: a full date, a **bare year** when
 * that is all anyone knows, or nothing. The backend has always accepted a year on its
 * own — it is what the website form and the enquiry importer supply — so a partial
 * answer is recorded rather than thrown away.
 *
 * Returns an error for a day or month without a year, which is neither a date nor a
 * year and cannot be stored as either.
 */
function birthFields(form: FormData):
  | { birthDate: string | null; birthYear: number | null }
  | { error: string } {
  const day = str(form, "birthDay");
  const month = str(form, "birthMonth");
  const year = str(form, "birthYear");

  if (!year) {
    if (day || month) return { error: "Doğum tarihi için yıl da seçin." };
    return { birthDate: null, birthYear: null };
  }
  if (day && month) {
    // The control cannot offer an impossible day, but a post is not a promise about
    // the control that made it.
    const iso = `${year}-${month}-${day}`;
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) {
      return { error: "Geçersiz doğum tarihi." };
    }
    return { birthDate: iso, birthYear: null };
  }
  // A year with at most one of day/month is no more than a year.
  return { birthDate: null, birthYear: Number(year) };
}

export async function updateLeadProfileAction(
  _prev: FormState,
  form: FormData
): Promise<FormState> {
  const id = str(form, "leadId");
  const fullName = str(form, "fullName");
  const phone = str(form, "phone");
  const email = str(form, "email");
  const source = str(form, "source");
  const birth = birthFields(form);
  if ("error" in birth) return { error: birth.error };

  if (!fullName) return { error: "Ad soyad gerekli." };
  if (!phone && !email) return { error: "Telefon veya e-posta gerekli." };
  if (!source) return { error: "Kaynak seçilmedi." };

  return write(
    `/api/v1/crm/leads/${id}/profile`,
    {
      fullName,
      // Empty string means "clear it", which is the whole point of this endpoint —
      // hence `|| null` rather than dropping the key.
      phone: phone || null,
      email: email || null,
      // A date when there is one, otherwise the bare year. Never both: the backend
      // derives the year from a date and would ignore one sent alongside it.
      birthDate: birth.birthDate,
      birthYear: birth.birthYear,
      occupation: str(form, "occupation") || null,
      company: str(form, "company") || null,
      city: str(form, "city") || null,
      address: str(form, "address") || null,
      source,
      // Only the field matching the chosen source is rendered, and the backend nulls
      // the other regardless.
      referredByName: str(form, "referredByName") || null,
      eventName: str(form, "eventName") || null,
      interests: form.getAll("interests").map(String).filter(Boolean),
    },
    "PUT",
    "Profil güncellendi."
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

  const birth = birthFields(form);
  if ("error" in birth) return { error: birth.error };
  const channels = form.getAll("consentChannels").map(String).filter(Boolean);

  const result = await apiRequest<LeadDetail>("/api/v1/crm/leads", {
    method: "POST",
    body: {
      fullName,
      phone: phone || null,
      email: email || null,
      // A date when there is one, otherwise the bare year. Never both: the backend
      // derives the year from a date and would ignore one sent alongside it.
      birthDate: birth.birthDate,
      birthYear: birth.birthYear,
      occupation: str(form, "occupation") || null,
      company: str(form, "company") || null,
      city: str(form, "city") || null,
      address: str(form, "address") || null,
      // A checkbox group, so the browser posts one entry per ticked box. The primary
      // interest is derived server-side from this set — nothing sends `interestedIn`.
      interests: form.getAll("interests").map(String).filter(Boolean),
      source: str(form, "source") || "WALK_IN",
      // Only one of these is ever rendered, so only one is ever posted. The backend
      // drops whichever does not match the source regardless — this is the convenience,
      // that is the boundary.
      referredByName: str(form, "referredByName") || null,
      eventName: str(form, "eventName") || null,
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

/**
 * Turns a lead into a member, with everything the admin collected at the desk.
 *
 * Two calls, deliberately in this order and not one:
 *
 *  1. `POST /crm/leads/{id}/convert` — creates the member, the onboarding record and
 *     the membership, all inside one backend transaction.
 *  2. the contract upload, if a file was chosen, against the **new member's id**.
 *
 * A file cannot travel in a JSON body, and putting the whole thing behind a multipart
 * endpoint would mean a half-made member if the file failed. This way the worst case is
 * a member whose contract is missing — which an admin can fix from the 360 in ten
 * seconds, and which the returned message tells them to do.
 */
export async function convertLeadAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "leadId");
  const email = str(form, "email");
  const phone = str(form, "phone");

  const plates = [str(form, "vehiclePlate1"), str(form, "vehiclePlate2")].filter(Boolean);
  const tierId = str(form, "tierId");
  const startDate = str(form, "membershipStart");
  const endDate = str(form, "membershipEnd");

  // A tier without dates is not a membership — say so here rather than letting the
  // backend reject a body the admin cannot see.
  if (tierId && (!startDate || !endDate)) {
    return { error: "Üyelik tipi seçtiyseniz başlangıç ve bitiş tarihi de gerekli." };
  }
  if (startDate && endDate && endDate < startDate) {
    return { error: "Bitiş tarihi başlangıçtan önce olamaz." };
  }

  const onboarding = {
    emergencyContactName: str(form, "emergencyContactName") || null,
    emergencyContactPhone: str(form, "emergencyContactPhone") || null,
    emergencyContactGender: str(form, "emergencyContactGender") || null,
    paymentMethod: str(form, "paymentMethod") || null,
    nationalId: str(form, "nationalId") || null,
    vehiclePlates: plates,
  };
  // Sent only when something was actually filled in. An empty block would create a row
  // of nulls and, worse, a 403 for a SALES user converting a lead normally — the
  // backend refuses the block itself, not its contents.
  const hasOnboarding = Object.values(onboarding).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== null
  );

  const result = await apiRequest<{
    userId: string;
    createdUser: boolean;
    guestAccountToReview: string | null;
  }>(`/api/v1/crm/leads/${id}/convert`, {
    method: "POST",
    body: {
      email: email || null,
      phone: phone || null,
      onboarding: hasOnboarding ? onboarding : null,
      membership: tierId ? { tierId, startDate, endDate } : null,
    },
  });

  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind !== "ok") {
    return { error: result.kind === "forbidden" ? `Yetkiniz yok: ${result.message}` : result.message };
  }

  const base = result.data.createdUser
    ? "Üye kaydı oluşturuldu. Üye ilk girişini yapmayı bekliyor."
    : "Aday mevcut bir üyeye bağlandı.";
  const guestNote = result.data.guestAccountToReview
    ? " Aynı telefona sahip bir misafir hesabı var — birleştirme kararı sizde."
    : "";

  // The contract, now that there is a member to attach it to.
  const contract = form.get("contract");
  let contractNote = "";
  if (contract instanceof File && contract.size > 0) {
    const upload = await uploadContract(result.data.userId, contract);
    contractNote = upload
      ? ` Ancak sözleşme yüklenemedi (${upload}). Üye sayfasından tekrar yükleyebilirsiniz.`
      : " Sözleşme yüklendi.";
  }

  revalidatePath("/leads", "layout");
  revalidatePath("/members", "layout");
  return { ok: `${base}${guestNote}${contractNote}` };
}

/**
 * Posts the scanned contract. Returns null on success, or a message describing the
 * failure — never throws, because by the time it runs the member already exists and
 * losing that fact to an exception would be far worse than a missing file.
 */
async function uploadContract(userId: string, file: File): Promise<string | null> {
  const body = new FormData();
  body.append("file", file, file.name);
  const result = await apiRequest<{ fileName: string }>(
    `/api/v1/crm/members/${userId}/contract`,
    { method: "POST", formData: body }
  );
  if (result.kind === "ok") return null;
  if (result.kind === "unauthorized") return "oturum süresi doldu";
  return result.message;
}
