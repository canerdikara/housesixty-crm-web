"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { FormState } from "@/lib/formState";
import type { BankLookup, PaymentDetail } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/**
 * «Elle iade» (virtual_pos.md §9.1): the primary sale back in full. Only from «Tahsil
 * edildi»; the note is required, and the server refuses without one too.
 */
export async function refundPaymentAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "paymentId");
  const note = str(form, "note");
  if (!note) return { error: "İade nedeni zorunludur." };

  const result = await apiRequest<{ outcome: string; detail: PaymentDetail }>(
    `/api/v1/crm/payments/${id}/refund`,
    { method: "POST", body: { note } }
  );
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind !== "ok") return { error: result.message };

  revalidatePath("/payments", "layout");
  revalidatePath("/reservations", "layout");
  return result.data.outcome === "REFUNDED"
    ? { ok: "İade bankaca onaylandı." }
    : { ok: "İade gönderildi, banka henüz onaylamadı. Sistem tekrar deneyecek; liste «Dikkat gerektirenler»de gösterir." };
}

/**
 * «Bankaya sor»: asks the bank afresh and applies the answer as the reconciler would. The
 * result is summarised from parsed fields only — never the raw response.
 */
export async function inquirePaymentAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, "paymentId");
  const result = await apiRequest<{ applied: { orderId: string; result: string }[]; lookup: BankLookup | null }>(
    `/api/v1/crm/payments/${id}/inquire`,
    { method: "POST", body: {} }
  );
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind !== "ok") return { error: result.message };

  revalidatePath("/payments", "layout");
  const l = result.data.lookup;
  const parts: string[] = [];
  if (!l || !l.answered) parts.push("Banka yanıt vermedi.");
  else {
    parts.push(`Banka: ${l.status ?? "durum yok"}`);
    if (l.authAmount) parts.push(`tutar ${l.authAmount}`);
    if (l.rrn) parts.push(`RRN ${l.rrn}`);
    if (l.authDate) parts.push(`tarih ${l.authDate}`);
    if (l.history.length) parts.push(`geçmişte ${l.history.length} hareket`);
    if (l.reasonCode && l.code !== "00") parts.push(`kod ${l.reasonCode}`);
  }
  if (result.data.applied.length) {
    parts.push(`açık denemeler: ${result.data.applied.map((a) => `${a.orderId} → ${a.result}`).join(", ")}`);
  }
  return { ok: parts.join(" · ") };
}
