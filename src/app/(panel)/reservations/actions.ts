"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { FormState } from "@/lib/formState";
import { OPEN_SEAT } from "./constants";

/**
 * The two writes the reservations calendar makes.
 *
 * Both are ADMIN / RECEPTION at the backend. `forbidden` is returned as a message rather
 * than a redirect, the same as everywhere else here: a marketing user pressing a button
 * they can see is told they may not, not signed out.
 */

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/**
 * Books a court for a member, from the desk.
 *
 * ⚠️ **The booking is created CONFIRMED**, which on this platform has meant "a card
 * payment was verified" since V44. A desk booking carries `bookedAtDesk`, and that is what
 * separates the two — nothing is charged here and no payment row is written.
 *
 * `revalidatePath` on the layout rather than the page: the grid and the day's counters are
 * both server-rendered, and a booking changes both.
 */
export async function bookSlotAction(_prev: FormState, form: FormData): Promise<FormState> {
  const timeSlotId = str(form, "timeSlotId");
  const userId = str(form, "userId");
  const note = str(form, "note");

  if (!userId) return { error: "Bir üye seçin." };

  /*
   * Seats two to four. Each arrives as either a member id, the sentinel below, or empty.
   *
   * ⚠️ «Açık» collapses to ONE flag. `Reservation.isOpen` is per booking, not per seat —
   * a join request fills the first empty seat — so marking any seat open opens all the
   * empty ones. The form says so; this is where the collapse happens.
   */
  const seats = [str(form, "player2"), str(form, "player3"), str(form, "player4")];
  const isOpen = seats.includes(OPEN_SEAT);
  const [player2Id, player3Id, player4Id] = seats.map((v) =>
    v && v !== OPEN_SEAT ? v : null
  );

  // Caught here as well as at the backend, because the message is better: the form knows
  // which seat is the duplicate and the API only knows that one exists.
  const named = [userId, player2Id, player3Id, player4Id].filter(Boolean);
  if (new Set(named).size !== named.length) {
    return { error: "Aynı kişi birden fazla oyuncu olarak seçilemez." };
  }

  const result = await apiRequest<{ fullName: string }>("/api/v1/crm/reservations", {
    method: "POST",
    body: { timeSlotId, userId, player2Id, player3Id, player4Id, isOpen, note: note || null },
  });

  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind !== "ok") {
    return {
      error: result.kind === "forbidden" ? `Yetkiniz yok: ${result.message}` : result.message,
    };
  }

  revalidatePath("/reservations", "layout");
  const others = named.length - 1;
  return {
    ok:
      `${result.data.fullName} için rezervasyon oluşturuldu` +
      (others > 0 ? ` (+${others} oyuncu)` : "") +
      (isOpen ? " · boş yerler üyelere açık." : "."),
  };
}

/**
 * Cancels a booking and releases the court.
 *
 * A DELETE that cancels rather than deletes: the row stays, carrying who cancelled it and
 * when. Works on a booking the member made themselves as well as a desk one — that is what
 * a desk is for.
 */
export async function cancelReservationAction(
  _prev: FormState,
  form: FormData
): Promise<FormState> {
  const id = str(form, "reservationId");

  const result = await apiRequest<unknown>(`/api/v1/crm/reservations/${id}`, {
    method: "DELETE",
  });

  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind !== "ok") {
    return {
      error: result.kind === "forbidden" ? `Yetkiniz yok: ${result.message}` : result.message,
    };
  }

  revalidatePath("/reservations", "layout");
  return { ok: "Rezervasyon iptal edildi, kort tekrar açıldı." };
}

/**
 * Members matching a search, for the booking form's picker.
 *
 * A server action rather than a client fetch, so the bearer token stays in an httpOnly
 * cookie — the same reason every other call in this panel goes through one. Returns a
 * short list: the desk is typing a name they already know, not browsing.
 */
export async function searchMembersAction(
  query: string
): Promise<{ id: string; fullName: string; phone: string | null }[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const result = await apiRequest<{
    content: { userId: string; fullName: string; phone: string | null }[];
  }>(`/api/v1/crm/members?q=${encodeURIComponent(q)}&size=10`);

  if (result.kind !== "ok") return [];
  return result.data.content.map((m) => ({
    id: m.userId,
    fullName: m.fullName,
    phone: m.phone,
  }));
}
