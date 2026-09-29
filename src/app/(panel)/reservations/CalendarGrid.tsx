"use client";

import { useActionState, useEffect, useState } from "react";
import { FormMessage, SubmitButton, formStyles as f } from "@/components/Form";
import { Badge, ui } from "@/components/ui";
import type { FormState } from "@/lib/formState";
import type { CalendarReservation, CalendarSlot, ReservationCalendar } from "@/lib/types";
import { bookSlotAction, cancelReservationAction, searchMembersAction } from "./actions";
import styles from "./reservations.module.css";

/**
 * The day's grid — courts across, hours down — and the panel that opens beside it.
 *
 * ## Why this is a client component when almost nothing else here is
 *
 * The panel's rule is that filters live in the URL and screens stay server-rendered. This
 * one breaks it deliberately: booking a court is a three-step action at a counter — pick a
 * cell, find the member, confirm — and putting each step in the URL would mean three page
 * loads while somebody is on the phone. The *day* and the *facility type* are still URL
 * filters, so a particular day is still bookmarkable and sendable; only the transient part
 * of making one booking is local state.
 *
 * ## The cell is the control
 *
 * A free cell is a button and a taken one shows who has it. There is no separate "new
 * reservation" form, because the slot is most of what such a form would ask for and the
 * desk has already pointed at it.
 */
export function CalendarGrid({
  calendar,
  dateLabel,
  canWrite,
  readOnly,
  aside,
}: {
  calendar: ReservationCalendar;
  /** The day, already formatted for İzmir by the server. */
  dateLabel: string;
  /** ADMIN / RECEPTION. Presentation only — the backend is the control. */
  canWrite: boolean;
  /** A past day: courts cannot be booked, but existing bookings still show. */
  readOnly: boolean;
  /**
   * The month picker, rendered on the server and passed through.
   *
   * This component owns the two-column layout rather than the page, because the slot panel
   * has to open in the **right** column: below the grid it lands under eight rows of
   * courts, so clicking a cell at 20:00 scrolls the form out of sight — which at a counter,
   * mid-phone-call, reads as the click having done nothing. A server component passed as a
   * prop renders on the server and costs the client bundle nothing.
   */
  aside: React.ReactNode;
}) {
  const [selected, setSelected] = useState<{ slot: CalendarSlot; facility: string } | null>(null);

  /*
   * Close the panel whenever the server sends a new grid.
   *
   * After a booking the action revalidates and this component re-renders with fresh data;
   * without this the panel stays open over a cell that is now taken, showing a booking form
   * for a court somebody just got. Keyed on the counts rather than on a render, so an
   * unrelated re-render does not close a panel the user is halfway through.
   */
  useEffect(() => {
    setSelected(null);
  }, [calendar.date, calendar.facilityType, calendar.bookedCount]);

  return (
    <div className={styles.layout}>
      {/* Its own scroller: six columns of an hour each can exceed a narrow window, and the
          page body must never scroll sideways. */}
      <div className={styles.scroller}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th className={styles.timeHead}>Saat</th>
              {calendar.facilities.map((fac) => (
                <th key={fac.id} className={styles.facHead}>
                  <span className={styles.facName}>{fac.name}</span>
                  <span className={styles.facCap}>{fac.capacity} kişi</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calendar.times.map((time) => (
              <tr key={time}>
                <th className={styles.timeCell}>{time.slice(0, 5)}</th>
                {calendar.facilities.map((fac) => {
                  /*
                   * Matched on start time, not on index. Courts whose slots were generated
                   * on different schedules have different counts, and an index join would
                   * silently draw one court's 18:00 booking in another's 09:00 row.
                   */
                  const slot = fac.slots.find((s) => s.startTime === time);
                  if (!slot) {
                    return <td key={fac.id} className={styles.cellNone} aria-label="seans yok" />;
                  }
                  return (
                    <Cell
                      key={fac.id}
                      slot={slot}
                      selected={selected?.slot.slotId === slot.slotId}
                      canWrite={canWrite && !readOnly}
                      onPick={() => setSelected({ slot, facility: fac.name })}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.side}>
        {/* Above the month picker, not instead of it: picking another day is the next thing
            the desk does when the court they wanted is taken. */}
        {selected && (
          <SlotPanel
            slot={selected.slot}
            facilityName={selected.facility}
            dateLabel={dateLabel}
            canWrite={canWrite && !readOnly}
            onClose={() => setSelected(null)}
          />
        )}
        {aside}
      </div>
    </div>
  );
}

function Cell({
  slot,
  selected,
  canWrite,
  onPick,
}: {
  slot: CalendarSlot;
  selected: boolean;
  canWrite: boolean;
  onPick: () => void;
}) {
  const r = slot.reservation;

  if (r) {
    return (
      <td className={styles.cell}>
        <button
          type="button"
          onClick={onPick}
          className={`${styles.booked} ${selected ? styles.cellOn : ""}`}
        >
          <span className={styles.who}>{r.fullName}</span>
          <span className={styles.meta}>
            {r.playerCount > 1 ? `${r.playerCount} kişi` : "1 kişi"}
            {/* The desk mark, because CONFIRMED alone no longer says how it got there. */}
            {r.bookedAtDesk && " · resepsiyon"}
          </span>
        </button>
      </td>
    );
  }

  /*
   * Anything that is not AVAILABLE and carries no booking is not offerable.
   *
   * BLOCKED is the ordinary case — a court closed for maintenance. The other is a slot
   * marked BOOKED whose reservation is gone, which the app cannot produce (it writes both
   * together in one transaction) but a hand-edited database can. Offering it would draw a
   * "+ Ekle" button whose only possible outcome is a 409, so both render as unavailable
   * and only the expected one gets the word.
   */
  if (slot.status !== "AVAILABLE") {
    return (
      <td className={styles.cell}>
        <span className={styles.blocked}>{slot.status === "BLOCKED" ? "Kapalı" : "Müsait değil"}</span>
      </td>
    );
  }

  if (!canWrite) {
    // Free, and not something this viewer can act on — drawn as empty rather than as a
    // button that would 403, or worse, look broken.
    return (
      <td className={styles.cell}>
        <span className={styles.free}>Boş</span>
      </td>
    );
  }

  return (
    <td className={styles.cell}>
      <button
        type="button"
        onClick={onPick}
        className={`${styles.freeBtn} ${selected ? styles.cellOn : ""}`}
      >
        + Ekle
      </button>
    </td>
  );
}

/** The panel beside the grid: book this slot, or look at and cancel what is on it. */
function SlotPanel({
  slot,
  facilityName,
  dateLabel,
  canWrite,
  onClose,
}: {
  slot: CalendarSlot;
  facilityName: string;
  dateLabel: string;
  canWrite: boolean;
  onClose: () => void;
}) {
  return (
    <aside className={styles.panel} aria-label="Seans detayı">
      <div className={styles.panelHead}>
        <div>
          <p className={styles.panelTitle}>
            {facilityName} · {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}
          </p>
          <p className={styles.panelSub}>{dateLabel}</p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Kapat">
          ×
        </button>
      </div>

      {slot.reservation ? (
        <BookingDetail reservation={slot.reservation} canWrite={canWrite} />
      ) : (
        <BookingForm slotId={slot.slotId} />
      )}
    </aside>
  );
}

function BookingDetail({
  reservation,
  canWrite,
}: {
  reservation: CalendarReservation;
  canWrite: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(cancelReservationAction, {});
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={styles.detail}>
      <p className={styles.who}>{reservation.fullName}</p>
      {reservation.phone && <p className={`${ui.muted} tnum`}>{reservation.phone}</p>}

      <dl className={styles.facts}>
        <dt>Durum</dt>
        <dd>
          {/*
            Two facts, because one of them is not in the status. CONFIRMED has meant "a card
            payment was verified" since V44 and also means "the desk booked it" since V46, so
            the badge says which — a reader cannot tell from the word alone.
          */}
          <Badge tone={reservation.status === "CONFIRMED" ? "good" : "neutral"}>
            {reservation.status === "CONFIRMED" ? "Onaylı" : "Beklemede"}
          </Badge>
        </dd>

        <dt>Kaynak</dt>
        <dd>
          {reservation.bookedAtDesk
            ? `Resepsiyon${reservation.bookedByName ? ` · ${reservation.bookedByName}` : ""}`
            : "Üyenin kendi rezervasyonu"}
        </dd>

        <dt>Kişi</dt>
        <dd>{reservation.playerCount}</dd>

        {reservation.deskNote && (
          <>
            <dt>Not</dt>
            <dd>{reservation.deskNote}</dd>
          </>
        )}
      </dl>

      {canWrite && (
        <form action={action}>
          <input type="hidden" name="reservationId" value={reservation.id} />
          <FormMessage state={state} />
          {confirming ? (
            <>
              <p className={f.hint}>
                Rezervasyon iptal edilir ve kort tekrar rezervasyona açılır.
              </p>
              <SubmitButton variant="danger" pendingLabel="İptal ediliyor…">
                Emin misiniz? İptal et
              </SubmitButton>
            </>
          ) : (
            <button
              type="button"
              className={`${f.submit} ${f.submitGhost}`}
              onClick={() => setConfirming(true)}
            >
              Rezervasyonu iptal et
            </button>
          )}
        </form>
      )}
    </div>
  );
}

/**
 * Book this slot for a member.
 *
 * The member is chosen by typing a name and picking from what comes back, rather than from
 * a dropdown of everybody: the club's list will not stay short, and a `<select>` of every
 * member is both a slow payload and a worse way to find the person on the phone.
 */
function BookingForm({ slotId }: { slotId: string }) {
  const [state, action] = useActionState<FormState, FormData>(bookSlotAction, {});
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; fullName: string; phone: string | null }[]>([]);
  const [picked, setPicked] = useState<{ id: string; fullName: string } | null>(null);
  const [searching, setSearching] = useState(false);

  /*
   * Debounced, and every stale response is discarded.
   *
   * `cancelled` is what stops a slow search for "ah" landing after a fast one for "ahmet"
   * and replacing the right results with the wrong ones — the classic out-of-order race,
   * and one that looks like a flickering bug rather than a logic error.
   */
  useEffect(() => {
    if (picked || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const found = await searchMembersAction(query);
      if (!cancelled) {
        setResults(found);
        setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, picked]);

  return (
    <form action={action} className={styles.bookForm}>
      <input type="hidden" name="timeSlotId" value={slotId} />
      <input type="hidden" name="userId" value={picked?.id ?? ""} />

      <div className={f.field}>
        <label className={f.label} htmlFor="res-member">
          Üye
        </label>
        {picked ? (
          <div className={styles.picked}>
            <span>{picked.fullName}</span>
            <button type="button" className={styles.clear} onClick={() => setPicked(null)}>
              değiştir
            </button>
          </div>
        ) : (
          <>
            <input
              id="res-member"
              className={f.input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="İsim, telefon veya e-posta"
              autoComplete="off"
            />
            {searching && <p className={f.hint}>Aranıyor…</p>}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className={f.hint}>Eşleşen üye yok.</p>
            )}
            <ul className={styles.results}>
              {results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={styles.result}
                    onClick={() => setPicked({ id: m.id, fullName: m.fullName })}
                  >
                    <span>{m.fullName}</span>
                    {m.phone && <span className={ui.muted}>{m.phone}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className={f.field}>
        <label className={f.label} htmlFor="res-note">
          Not
        </label>
        <input
          id="res-note"
          name="note"
          className={f.input}
          maxLength={500}
          placeholder="Telefonla aradı"
        />
        <p className={f.hint}>
          Rezervasyon onaylı olarak oluşturulur ve sizin adınıza kaydedilir. Tahsilat bu
          ekrandan yapılmaz.
        </p>
      </div>

      <FormMessage state={state} />
      <div className={f.actions}>
        {/* Disabled until somebody is chosen: the action refuses an empty member anyway,
            and an enabled button that always errors is worse than one that waits. */}
        {picked ? (
          <SubmitButton pendingLabel="Oluşturuluyor…">Rezervasyon oluştur</SubmitButton>
        ) : (
          <button type="button" className={f.submit} disabled>
            Rezervasyon oluştur
          </button>
        )}
      </div>
    </form>
  );
}
