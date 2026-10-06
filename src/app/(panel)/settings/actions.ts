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
