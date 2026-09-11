"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiRequest } from "@/lib/api";
import type { FormState } from "@/lib/formState";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/**
 * Logs a renewal conversation against a term.
 *
 * One call, not two. The backend moves the status, stamps the contact clock and writes
 * the interaction together — see `RenewalService.logContact` for why splitting them
 * leaves the worklist unreadable.
 *
 * Note this is a POST, unlike the 360's term editor, and carries no `renewalStatusWas`.
 * That field exists there to avoid faking a contact when only a date was corrected;
 * here the call *is* the contact, so the stamp always moves — including when the status
 * is re-logged unchanged, which is a second real conversation.
 */
export async function logContactAction(_prev: FormState, form: FormData): Promise<FormState> {
  const termId = str(form, "termId");
  const note = str(form, "note");
  const renewalStatus = str(form, "renewalStatus");

  // Checked here as well as on the backend so the message arrives without a round trip
  // and the form keeps what was typed. The backend check is the one that enforces it.
  if (!note) return { error: "Görüşme notu gerekli." };
  if (!renewalStatus) return { error: "Yenileme durumu gerekli." };

  const result = await apiRequest<unknown>(`/api/v1/crm/renewals/${termId}/contact`, {
    method: "POST",
    body: {
      renewalStatus,
      interactionType: str(form, "interactionType") || "CALL",
      note,
      // Empty means "leave the worklist line alone", so it is omitted rather than sent
      // as an empty string — the backend reads an absent note as no change.
      renewalNote: str(form, "renewalNote") || undefined,
    },
  });

  switch (result.kind) {
    case "ok":
      // The list, the summary tiles and the member's own 360 all read this term.
      revalidatePath("/renewals", "layout");
      revalidatePath("/members", "layout");
      return { ok: "Görüşme kaydedildi." };
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      // Not a redirect: §6 gives MARKETING read on membership terms, so a marketing user
      // pressing save should be told they may not, not signed out of a screen they are
      // entitled to look at.
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}
