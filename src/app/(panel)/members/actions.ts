"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { FormState } from "@/lib/formState";

/**
 * Every write the member screens make — mockup screen 7.
 *
 * Same shape as the lead actions and for the same reasons: server actions so the bearer
 * token stays in an httpOnly cookie, a `FormState` back rather than a throw so the
 * backend's own message survives.
 *
 * One thing here differs from the lead screens and it matters. **Profile, interests and
 * preferences are whole-object PUTs**, not PATCHes: an absent field is a cleared field,
 * and an absent interest is a removed interest. The lead PATCH cannot express "make
 * this empty" and its form says so; these can, and their forms say the opposite. Every
 * editable field is therefore rendered *and* submitted, including the ones the read
 * view used to leave out — a field that is editable but not on screen would be silently
 * wiped by the first save.
 *
 * Dates here are `LocalDate` on the wire, not `Instant`. They go across as plain
 * "YYYY-MM-DD" with no timezone arithmetic — deliberately unlike `addInteractionAction`,
 * which converts to İzmir noon because it is answering "when did this happen". A
 * membership term starts on a date, full stop; there is no instant to get wrong.
 */

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
/** Empty box → `null`, so the backend stores nothing rather than an empty string. */
const orNull = (f: FormData, k: string) => str(f, k) || null;

/**
 * Turns an `ApiResult` into something a form can render.
 *
 * `forbidden` is not a redirect: members are readable by all four panel roles but
 * writable only by ADMIN and SALES, so a reception user pressing save gets a permission
 * message and stays signed in. Logging them out would turn "you may not edit this" into
 * "the panel is broken".
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
      // The 360 and the list both read this member; the layout segment covers both.
      revalidatePath("/members", "layout");
      return { ok: successMessage };
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}

/**
 * The onboarding record — what was collected at the desk (V39).
 *
 * A **PUT**, like the profile beside it: an emptied box clears the field. The contract
 * is deliberately absent from it — a file cannot round-trip through a text form, so
 * clearing-by-omission would delete a scanned contract every time someone fixed a car
 * plate. It has its own upload below.
 *
 * ADMIN-only at the backend; the panel simply does not render this form for anyone else.
 */
export async function saveOnboardingAction(_prev: FormState, form: FormData): Promise<FormState> {
  const userId = str(form, "userId");
  const plates = [str(form, "vehiclePlate1"), str(form, "vehiclePlate2")].filter(Boolean);

  return write(
    `/api/v1/crm/members/${userId}/onboarding`,
    {
      emergencyContactName: orNull(form, "emergencyContactName"),
      emergencyContactPhone: orNull(form, "emergencyContactPhone"),
      emergencyContactGender: orNull(form, "emergencyContactGender"),
      paymentMethod: orNull(form, "paymentMethod"),
      nationalId: orNull(form, "nationalId"),
      vehiclePlates: plates,
    },
    "PUT",
    "Üyelik kaydı güncellendi."
  );
}

/** Uploads or replaces the scanned contract. Replacing deletes the old object. */
export async function uploadContractAction(_prev: FormState, form: FormData): Promise<FormState> {
  const userId = str(form, "userId");
  const file = form.get("contract");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bir dosya seçin." };
  }

  const body = new FormData();
  body.append("file", file, file.name);
  const result = await apiRequest<{ fileName: string }>(
    `/api/v1/crm/members/${userId}/contract`,
    { method: "POST", formData: body }
  );

  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind !== "ok") {
    return { error: result.kind === "forbidden" ? `Yetkiniz yok: ${result.message}` : result.message };
  }

  revalidatePath("/members", "layout");
  return { ok: `Sözleşme yüklendi: ${result.data.fileName}` };
}

/**
 * Fetches a short-lived link to the contract and hands it back for the browser to open.
 *
 * The URL is returned rather than stored anywhere: it carries its own authorisation, so
 * anyone it is forwarded to can open it until it expires. That is also why it is not
 * part of the 360 payload — a working key to a signed contract would otherwise sit in
 * every render of the page.
 */
export async function contractLinkAction(
  _prev: FormState,
  form: FormData
): Promise<FormState & { url?: string }> {
  const userId = str(form, "userId");
  const result = await apiRequest<{ url: string; fileName: string; expiresInSeconds: number }>(
    `/api/v1/crm/members/${userId}/contract`
  );

  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind !== "ok") {
    return { error: result.kind === "forbidden" ? `Yetkiniz yok: ${result.message}` : result.message };
  }

  const minutes = Math.max(1, Math.round(result.data.expiresInSeconds / 60));
  return { ok: `Bağlantı hazır — ${minutes} dakika geçerli.`, url: result.data.url };
}

export async function saveProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const userId = str(form, "userId");

  return write(
    `/api/v1/crm/members/${userId}/profile`,
    {
      birthDate: orNull(form, "birthDate"),
      gender: orNull(form, "gender"),
      occupation: orNull(form, "occupation"),
      company: orNull(form, "company"),
      city: orNull(form, "city"),
      instagramHandle: orNull(form, "instagramHandle"),
      linkedinUrl: orNull(form, "linkedinUrl"),
      padelLevel: orNull(form, "padelLevel"),
      preferredChannel: orNull(form, "preferredChannel"),
      notes: orNull(form, "notes"),
    },
    "PUT",
    "Profil kaydedildi."
  );
}

/**
 * Interests, as the checkbox group submits them.
 *
 * A ticked box contributes its category to `interest`; its level rides in a companion
 * field named per category. Reading the level off `interest` order would break the
 * moment a browser reorders the pairs, and unticked boxes send nothing at all — which
 * is exactly the removal the whole-set PUT needs.
 */
export async function saveInterestsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const userId = str(form, "userId");

  const interests = form
    .getAll("interest")
    .map(String)
    .filter(Boolean)
    .map((category) => {
      const level = Number(String(form.get(`level-${category}`) ?? "1"));
      return { category, level: Number.isFinite(level) ? Math.min(3, Math.max(1, level)) : 1 };
    });

  return write(
    `/api/v1/crm/members/${userId}/interests`,
    { interests },
    "PUT",
    interests.length === 0 ? "İlgi alanları temizlendi." : "İlgi alanları kaydedildi."
  );
}

/**
 * Preferences — free key/value pairs, submitted as two parallel lists.
 *
 * Paired by index, which is safe because both fields sit in the same row of the form
 * and a browser submits controls in document order. A row whose key was emptied simply
 * does not survive the filter, and since this is a whole-set PUT that is how a
 * preference is deleted.
 */
export async function savePreferencesAction(_prev: FormState, form: FormData): Promise<FormState> {
  const userId = str(form, "userId");

  const keys = form.getAll("prefKey").map((v) => String(v).trim());
  const values = form.getAll("prefValue").map((v) => String(v).trim());

  const seen = new Set<string>();
  const preferences: { key: string; value: string }[] = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = values[i] ?? "";
    // Both halves required: a key with no value says nothing, and a value with no key
    // cannot be displayed. Either alone is an abandoned row, not an error.
    if (!key || !value) continue;
    // Last row wins on a repeated key, matching what the server does with duplicates.
    if (seen.has(key)) {
      const at = preferences.findIndex((p) => p.key === key);
      preferences[at] = { key, value };
      continue;
    }
    seen.add(key);
    preferences.push({ key, value });
  }

  return write(
    `/api/v1/crm/members/${userId}/preferences`,
    { preferences },
    "PUT",
    preferences.length === 0 ? "Tercihler temizlendi." : "Tercihler kaydedildi."
  );
}

export async function createTermAction(_prev: FormState, form: FormData): Promise<FormState> {
  const userId = str(form, "userId");
  const membershipType = str(form, "membershipType");
  const startDate = str(form, "startDate");
  const endDate = str(form, "endDate");

  if (!membershipType) return { error: "Üyelik tipi gerekli." };
  if (!startDate || !endDate) return { error: "Başlangıç ve bitiş tarihi gerekli." };
  // Checked here as well as on the backend so the message arrives without a round trip
  // and the form keeps what was typed. The backend check is the one that enforces it.
  if (endDate < startDate) return { error: "Bitiş tarihi başlangıçtan önce olamaz." };

  return write(
    "/api/v1/crm/members/terms",
    {
      userId,
      membershipType,
      startDate,
      endDate,
      status: str(form, "status") || "ACTIVE",
      renewalStatus: str(form, "renewalStatus") || "NOT_CONTACTED",
      renewalNote: orNull(form, "renewalNote"),
    },
    "POST",
    "Dönem eklendi."
  );
}

/**
 * Updates a term.
 *
 * A PATCH, and one field is deliberately withheld rather than always sent.
 *
 * **`renewalStatus` goes only when it actually changed.** The server stamps
 * `lastRenewalContactAt = now()` on any renewal-status field it receives, and the
 * renewals screen sorts on that stamp. Sending the unchanged value along with a
 * corrected end date would move the member to the top of the "recently contacted" list
 * for a change that involved no contact at all — a quiet falsification of the one
 * column that screen exists to show. The form carries the original in a hidden field so
 * this can tell the difference.
 *
 * Everything else is sent every time, because every other field is on the form.
 * `renewalNote` goes as a string rather than null even when empty: the endpoint reads
 * an absent note as "leave alone" and an empty one as "clear", and emptying the box
 * should clear it.
 */
export async function updateTermAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "termId");
  const membershipType = str(form, "membershipType");
  const startDate = str(form, "startDate");
  const endDate = str(form, "endDate");
  const renewalStatus = str(form, "renewalStatus");
  const renewalStatusWas = str(form, "renewalStatusWas");

  if (!membershipType) return { error: "Üyelik tipi gerekli." };
  if (!startDate || !endDate) return { error: "Başlangıç ve bitiş tarihi gerekli." };
  if (endDate < startDate) return { error: "Bitiş tarihi başlangıçtan önce olamaz." };

  const body: Record<string, unknown> = {
    membershipType,
    startDate,
    endDate,
    status: str(form, "status"),
    renewalNote: str(form, "renewalNote"),
  };
  if (renewalStatus && renewalStatus !== renewalStatusWas) {
    body.renewalStatus = renewalStatus;
  }

  return write(
    `/api/v1/crm/members/terms/${id}`,
    body,
    "PATCH",
    renewalStatus !== renewalStatusWas
      ? "Dönem güncellendi, yenileme teması kaydedildi."
      : "Dönem güncellendi."
  );
}
