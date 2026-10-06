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
  /*
   * Guests may be allowed to see and request an open game — but only an open one. Sent as
   * `isOpen &&` here as well as enforced at the backend, so the checkbox cannot leave a
   * stale `true` behind if somebody ticks it and then un-marks every open seat. That exact
   * shape of bug shipped once in the member app, where `guestsAllowed` was computed off a
   * control that had been hidden rather than reset.
   */
  const guestsAllowed = isOpen && str(form, "guestsAllowed") === "on";
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
    body: {
      timeSlotId, userId, player2Id, player3Id, player4Id,
      isOpen, guestsAllowed, note: note || null,
    },
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
      (isOpen
        ? guestsAllowed
          ? " · boş yerler üyelere ve misafirlere açık."
          : " · boş yerler üyelere açık."
        : "."),
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

/**
 * «Rezervasyon ekle» — opens ONE slot, then lands back on the day with that slot's booking
 * panel already open (`?slot=`), so the booking itself goes through [bookSlotAction] and
 * every one of its rules. For a day nobody generated slots on, or an hour outside them.
 */
export async function createDeskSlotAction(_prev: FormState, form: FormData): Promise<FormState> {
  const date = str(form, "date");
  const type = str(form, "type");
  const price = str(form, "price").replace(",", ".");
  const body = {
    facilityId: str(form, "facilityId"),
    date,
    startTime: str(form, "startTime"),
    durationMinutes: Number(str(form, "durationMinutes") || "60"),
    price: price === "" ? null : Number(price),
    memberDiscountPercent: Number(str(form, "memberDiscountPercent") || "0"),
  };
  if (!body.facilityId) return { error: "Kort / oda seçin." };
  if (!body.startTime) return { error: "Başlangıç saati gerekli." };
  if (body.price === null || Number.isNaN(body.price)) return { error: "Ücret gerekli." };

  const result = await apiRequest<{ slotId: string }>("/api/v1/crm/reservations/slots", { method: "POST", body });
  switch (result.kind) {
    case "ok":
      revalidatePath("/reservations", "layout");
      redirect(`/reservations?date=${date}&type=${type}&slot=${result.data.slotId}`);
    case "unauthorized":
      redirect("/login");
    case "forbidden":
      return { error: `Yetkiniz yok: ${result.message}` };
    default:
      return { error: result.message };
  }
}
