"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { FormState } from "@/lib/formState";

/**
 * «Silme talepleri»'s two writes (V65): anonymise the member, or reject an unverified
 * request. ADMIN and RECEPTION at the backend, which also refuses to reject a verified
 * request (the app stores require the deletion to happen) — that 409's message is shown.
 */

const UUID = /^[0-9a-f-]{36}$/i;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function act(kind: "complete" | "reject", form: FormData): Promise<FormState> {
  const id = str(form, "id");
  if (!UUID.test(id)) return { error: "Geçersiz talep." };
  const result = await apiRequest<unknown>(`/api/v1/crm/deletion-requests/${id}/${kind}`, {
    method: "POST",
    body: { note: str(form, "note") || undefined },
  });
  switch (result.kind) {
    case "ok":
      revalidatePath("/deletion-requests");
      return { ok: kind === "complete" ? "Kişi anonimleştirildi." : "Talep reddedildi." };
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}

export async function completeDeletionAction(_prev: FormState, form: FormData): Promise<FormState> {
  return act("complete", form);
}

export async function rejectDeletionAction(_prev: FormState, form: FormData): Promise<FormState> {
  return act("reject", form);
}
