"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { FormState } from "@/lib/formState";

/**
 * «Çalışan takibi»'s two writes: add an employee, and switch one on or off.
 *
 * ADMIN-only at the backend. The new account is the same one the admin apps create — the
 * person sets their own password on first sign-in in the member app.
 */

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createEmployeeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const body = { fullName: str(form, "fullName"), email: str(form, "email"), phone: str(form, "phone") };
  if (!body.fullName || !body.email || !body.phone) return { error: "Ad soyad, e-posta ve telefon gerekli." };

  const result = await apiRequest<{ userId: string }>("/api/v1/crm/employees", { method: "POST", body });
  switch (result.kind) {
    case "ok":
      revalidatePath("/employees", "layout");
      return {
        ok: `${body.fullName} eklendi. Üye uygulamasına bu e-posta ya da telefonla girip ilk girişte kendi şifresini belirleyecek.`,
      };
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}

export async function setEmployeeActiveAction(_prev: FormState, form: FormData): Promise<FormState> {
  const active = str(form, "active") === "true";
  const result = await apiRequest<unknown>(`/api/v1/crm/employees/${str(form, "userId")}/active`, {
    method: "PATCH",
    body: { active },
  });
  switch (result.kind) {
    case "ok":
      revalidatePath("/employees", "layout");
      return { ok: active ? "Hesap etkinleştirildi." : "Hesap devre dışı bırakıldı." };
    case "unauthorized":
      redirect("/login");
    default:
      return { error: result.message };
  }
}
