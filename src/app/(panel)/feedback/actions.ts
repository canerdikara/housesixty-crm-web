"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { FormState } from "@/lib/formState";

/**
 * Every write «Geri Bildirim» makes — mockup screen 16.
 *
 * Same shape as the event actions: server actions so the token stays in an httpOnly
 * cookie, a `FormState` back so the backend's Turkish message reaches the form.
 *
 * ⚠️ **`sendSurveyAction` reaches members' inboxes.** The backend refuses it (409) while
 * `CRM_CAMPAIGN_SENDING_ENABLED` is unset — the same switch as campaigns and events.
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
      revalidatePath("/feedback", "layout");
      return { ok };
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}

// ── Surveys ───────────────────────────────────────────────────────────────────

/**
 * The editor posts its questions as three parallel lists — `qId`, `qLabel`, `qType` — in
 * screen order. An empty `qId` is a new question; the backend gives it the next id.
 */
function surveyBody(form: FormData) {
  const ids = form.getAll("qId").map(String);
  const labels = form.getAll("qLabel").map((v) => String(v).trim());
  const types = form.getAll("qType").map(String);
  return {
    title: str(form, "title"),
    intro: str(form, "intro") || null,
    status: str(form, "status") || "DRAFT",
    questions: labels.map((label, i) => ({ id: ids[i] || null, label, type: types[i] })),
  };
}

export async function saveSurveyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "id");
  const body = surveyBody(form);
  if (!body.title) return { error: "Anket adı gerekli." };
  if (body.questions.length === 0) return { error: "En az bir soru ekleyin." };
  if (body.questions.some((q) => !q.label)) return { error: "Boş bir soru var — doldurun ya da silin." };

  if (id) {
    const r = await write(`/api/v1/crm/surveys/${id}`, "PUT", body, "Anket kaydedildi.");
    if (r.ok) redirect(`/feedback/surveys/${id}`);
    return r;
  }

  const result = await apiRequest<{ id: string }>("/api/v1/crm/surveys", { method: "POST", body });
  switch (result.kind) {
    case "ok":
      revalidatePath("/feedback", "layout");
      redirect(`/feedback/surveys/${result.data.id}`);
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}

/** «Aç» / «Kapat» on the survey screen — the whole survey re-sent with a new status. */
export async function setSurveyStatusAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "id");
  const current = await apiRequest<{
    title: string; intro: string | null; questions: { id: string; label: string; type: string }[];
  }>(`/api/v1/crm/surveys/${id}`);
  if (current.kind === "unauthorized") redirect("/login");
  if (current.kind !== "ok") return { error: current.message };
  const { title, intro, questions } = current.data;
  return write(
    `/api/v1/crm/surveys/${id}`, "PUT",
    { title, intro, questions, status: str(form, "status") },
    "Durum güncellendi."
  );
}

export async function deleteSurveyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await apiRequest<unknown>(`/api/v1/crm/surveys/${str(form, "id")}`, { method: "DELETE" });
  switch (result.kind) {
    case "ok":
      revalidatePath("/feedback", "layout");
      redirect("/feedback");
    case "unauthorized":
      redirect("/login");
    default:
      return { error: result.message };
  }
}

/** From a segment, or one picked member — whichever field the form carried. */
export async function addRecipientsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "surveyId");
  const segmentId = str(form, "segmentId");
  const userId = str(form, "userId");
  if (!segmentId && !userId) return { error: "Bir segment seçin." };

  const result = await apiRequest<{ added: number; alreadyAdded: number }>(
    `/api/v1/crm/surveys/${id}/recipients`,
    { method: "POST", body: segmentId ? { segmentId } : { userIds: [userId] } }
  );
  switch (result.kind) {
    case "ok": {
      revalidatePath("/feedback", "layout");
      const { added, alreadyAdded } = result.data;
      return {
        ok: added === 0
          ? `Yeni üye eklenmedi${alreadyAdded ? ` — ${alreadyAdded} kişi zaten listede` : ""}.`
          : `${added} üye eklendi${alreadyAdded ? ` (${alreadyAdded} kişi zaten listedeydi)` : ""}.`,
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

export async function removeRecipientAction(_prev: FormState, form: FormData): Promise<FormState> {
  return write(
    `/api/v1/crm/surveys/${str(form, "surveyId")}/recipients/${str(form, "userId")}`,
    "DELETE", undefined, "Listeden çıkarıldı."
  );
}

/**
 * A paper form typed in. Every question arrives as a field named by its id; blanks are
 * left out rather than sent empty, so "not answered" stays not answered.
 */
export async function recordAnswersAction(_prev: FormState, form: FormData): Promise<FormState> {
  const surveyId = str(form, "surveyId");
  const userId = str(form, "userId");
  const answers: Record<string, string | number> = {};
  for (const [k, v] of form.entries()) {
    if (!/^q\d+$/.test(k)) continue;
    const s = String(v).trim();
    if (!s) continue;
    answers[k] = form.get(`type_${k}`) === "RATING" ? Number(s) : s;
  }
  if (Object.keys(answers).length === 0) return { error: "En az bir soruyu yanıtlayın." };

  const r = await write(
    `/api/v1/crm/surveys/${surveyId}/responses`, "PUT", { userId, answers }, "Yanıt kaydedildi."
  );
  if (r.ok) redirect(`/feedback/surveys/${surveyId}`);
  return r;
}

export async function clearAnswersAction(_prev: FormState, form: FormData): Promise<FormState> {
  return write(
    `/api/v1/crm/surveys/${str(form, "surveyId")}/responses/${str(form, "userId")}`,
    "DELETE", undefined, "Yanıt silindi."
  );
}

/** ⚠️ **This sends.** INVITE (not yet sent) or REMIND (sent, unanswered); `userId` narrows. */
export async function sendSurveyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "surveyId");
  const result = await apiRequest<{ sent: number; notSent: number }>(
    `/api/v1/crm/surveys/${id}/send`,
    { method: "POST", body: { kind: str(form, "kind"), userId: str(form, "userId") || null } }
  );
  switch (result.kind) {
    case "ok": {
      revalidatePath("/feedback", "layout");
      const { sent, notSent } = result.data;
      return { ok: `${sent} üyeye ulaştı${notSent ? ` · ${notSent} üyeye ulaşılamadı (satırlardaki nota bakın)` : ""}.` };
    }
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}

// ── Tickets ───────────────────────────────────────────────────────────────────

export async function createTicketAction(_prev: FormState, form: FormData): Promise<FormState> {
  const body = {
    subject: str(form, "subject"),
    description: str(form, "description") || null,
    type: str(form, "type"),
    userId: str(form, "userId"),
    assigneeUserId: str(form, "assigneeUserId") || null,
  };
  if (!body.userId) return { error: "Önce üyeyi seçin." };
  if (!body.subject) return { error: "Konu gerekli." };

  const result = await apiRequest<{ id: string }>("/api/v1/crm/tickets", { method: "POST", body });
  switch (result.kind) {
    case "ok":
      revalidatePath("/feedback", "layout");
      redirect(`/feedback/tickets/${result.data.id}`);
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}

/**
 * The whole ticket. An assignee who is not an admin sees only status and note on the
 * form; the other fields travel as hidden inputs carrying the current values, and the
 * backend ignores them for that person anyway.
 */
export async function updateTicketAction(_prev: FormState, form: FormData): Promise<FormState> {
  return write(
    `/api/v1/crm/tickets/${str(form, "id")}`, "PUT",
    {
      subject: str(form, "subject"),
      description: str(form, "description") || null,
      type: str(form, "type"),
      status: str(form, "status"),
      assigneeUserId: str(form, "assigneeUserId") || null,
      resolutionNote: str(form, "resolutionNote") || null,
    },
    "Talep güncellendi."
  );
}

export async function deleteTicketAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await apiRequest<unknown>(`/api/v1/crm/tickets/${str(form, "id")}`, { method: "DELETE" });
  switch (result.kind) {
    case "ok":
      revalidatePath("/feedback", "layout");
      redirect("/feedback");
    case "unauthorized":
      redirect("/login");
    default:
      return { error: result.message };
  }
}
