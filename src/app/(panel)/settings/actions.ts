"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { FormState } from "@/lib/formState";

/**
 * «Ayarlar»'s one write: giving an account a panel role, changing it, or taking it away
 * (MEMBER). Accounts themselves are created in the admin app (user's decision,
 * 2026-10-06) — this screen only does what the admin app cannot.
 *
 * ⚠️ Taking a panel role away signs that person out everywhere at once — the backend
 * stamps their token-revocation time. That is the point, and the confirm text says so.
 */
export async function changeRoleAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get("id") ?? "");
  const role = String(form.get("role") ?? "");
  if (!id || !role) return { error: "Kullanıcı ve rol gerekli." };

  const result = await apiRequest<unknown>(`/api/v1/crm/users/${id}/role`, { method: "PATCH", body: { role } });
  switch (result.kind) {
    case "ok":
      revalidatePath("/settings");
      return { ok: "Rol güncellendi." };
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}

/**
 * «İYS'ye direkt aktar» (V64): the İYS rows of the chosen dates go to İYS's API. The dates
 * come from the card's own «İzin tarihi» filter, carried in hidden fields.
 */
export async function iysApiSendAction(_prev: FormState, form: FormData): Promise<FormState> {
  const q = new URLSearchParams();
  for (const k of ["from", "to"]) {
    const v = String(form.get(k) ?? "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) q.set(k, v);
  }
  const result = await apiRequest<{ rowCount: number; acceptedBatches: number; status: string; error: string | null }>(
    `/api/v1/crm/consents/iys-api/send${q.size ? `?${q}` : ""}`,
    { method: "POST" },
  );
  switch (result.kind) {
    case "ok": {
      revalidatePath("/settings");
      const s = result.data;
      if (s.status === "FAILED") return { error: `İYS gönderimi reddetti: ${s.error ?? "bilinmeyen hata"}` };
      if (s.status === "PARTIAL") return { error: `${s.rowCount} satırın bir kısmı gönderilemedi: ${s.error ?? ""}` };
      return { ok: `${s.rowCount} satır İYS'ye gönderildi. İYS bunları arka planda işler — birkaç dakika sonra «Sonucu kontrol et».` };
    }
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}

/** Asks İYS how each batch of a send went. */
export async function iysApiCheckAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Geçersiz gönderim" };
  const result = await apiRequest<{ resultSummary: string | null }>(`/api/v1/crm/consents/iys-api/sends/${id}/check`, { method: "POST" });
  switch (result.kind) {
    case "ok":
      revalidatePath("/settings");
      return { ok: result.data.resultSummary ?? "İYS yanıtı kaydedildi." };
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}
