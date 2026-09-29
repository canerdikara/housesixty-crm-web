"use client";

import { useActionState, useEffect, useState } from "react";
import { FormMessage, SubmitButton, formStyles as f } from "@/components/Form";
import { Badge, ui } from "@/components/ui";
import type { FormState } from "@/lib/formState";
import type { CalendarReservation, CalendarSlot, ReservationCalendar } from "@/lib/types";
import { bookSlotAction, cancelReservationAction, searchMembersAction } from "./actions";
import { GUEST_SEATS, OPEN_SEAT } from "./constants";
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
            {/* «Açık» leads: a desk scanning the grid is looking for a game somebody can
                still be put into, and that matters more at a glance than the headcount. */}
            {r.isOpen && "Açık · "}
            {`${r.playerCount}/4`}
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

        <dt>Oyuncular</dt>
        <dd>
          {/*
            All four seats, empties included. A padel court takes four and the desk's whole
            reason for asking was the record of who was on it — an omitted empty seat reads
            as a court that only takes three.
          */}
          <ol className={styles.seats}>
            {reservation.players.map((p) => (
              <li key={p.seat} className={p.fullName ? undefined : styles.seatEmpty}>
                {p.fullName ?? (p.isOpen ? "Açık — üyelere" : "—")}
              </li>
            ))}
          </ol>
        </dd>

        {reservation.guestsAllowed && (
          <>
            <dt>Görünürlük</dt>
            {/*
              Only a member can set this, from their own app — the desk cannot. It is shown
              because it means the game is visible to accounts outside the membership, which
              is not otherwise apparent from anything on this screen.
            */}
            <dd>⚠️ Misafir hesaplara da açık</dd>
          </>
        )}

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
type Picked = { id: string; fullName: string };

/**
 * One seat's control: search for a member, or mark the seat «Açık».
 *
 * The same component for all four seats — seat one just never offers «Açık», because the
 * owner is who the court is under and a booking with nobody on it is a blocked slot, which
 * is a different thing with its own status.
 */
function SeatPicker({
  seat,
  name,
  picked,
  onPick,
  open,
  onToggleOpen,
  taken,
}: {
  seat: number;
  name: string;
  picked: Picked | null;
  onPick: (p: Picked | null) => void;
  /** Whether this seat is marked «Açık». Seat one never is. */
  open: boolean;
  onToggleOpen: ((v: boolean) => void) | null;
  /** Ids already seated, so the same person cannot be offered twice. */
  taken: string[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; fullName: string; phone: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const id = `res-seat-${seat}`;

  /*
   * Debounced, and every stale response is discarded.
   *
   * `cancelled` is what stops a slow search for "ah" landing after a fast one for "ahmet"
   * and replacing the right results with the wrong ones — the classic out-of-order race,
   * which looks like a flickering bug rather than a logic error.
   */
  useEffect(() => {
    if (picked || open || query.trim().length < 2) {
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
  }, [query, picked, open]);

  // The value the action reads: an id, the open sentinel, or nothing at all.
  const value = picked ? picked.id : open ? OPEN_SEAT : "";

  return (
    <div className={f.field}>
      <label className={f.label} htmlFor={id}>
        {seat === 1 ? "1. oyuncu · rezervasyon sahibi" : `${seat}. oyuncu`}
      </label>
      <input type="hidden" name={name} value={value} />

      {picked ? (
        <div className={styles.picked}>
          <span>{picked.fullName}</span>
          <button type="button" className={styles.clear} onClick={() => onPick(null)}>
            değiştir
          </button>
        </div>
      ) : open ? (
        <div className={styles.picked}>
          <span className={ui.muted}>Açık — üyeler katılabilir</span>
          <button type="button" className={styles.clear} onClick={() => onToggleOpen?.(false)}>
            geri al
          </button>
        </div>
      ) : (
        <>
          <input
            id={id}
            className={f.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={seat === 1 ? "İsim, telefon veya e-posta" : "Boş bırakılabilir"}
            autoComplete="off"
          />
          {searching && <p className={f.hint}>Aranıyor…</p>}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className={f.hint}>Eşleşen üye yok.</p>
          )}
          <ul className={styles.results}>
            {results
              // Already seated elsewhere on this booking — offering them again only leads
              // to the duplicate error, so they are filtered out rather than refused later.
              .filter((m) => !taken.includes(m.id))
              .map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={styles.result}
                    onClick={() => onPick({ id: m.id, fullName: m.fullName })}
                  >
                    <span>{m.fullName}</span>
                    {m.phone && <span className={ui.muted}>{m.phone}</span>}
                  </button>
                </li>
              ))}
          </ul>
          {onToggleOpen && !query && (
            <button
              type="button"
              className={styles.openBtn}
              onClick={() => onToggleOpen(true)}
            >
              veya bu yeri «Açık» bırak
            </button>
          )}
        </>
      )}
    </div>
  );
}

function BookingForm({ slotId }: { slotId: string }) {
  const [state, action] = useActionState<FormState, FormData>(bookSlotAction, {});
  const [seats, setSeats] = useState<(Picked | null)[]>([null, null, null, null]);
  const [openSeats, setOpenSeats] = useState<boolean[]>([false, false, false, false]);

  const setSeat = (i: number, p: Picked | null) =>
    setSeats((prev) => prev.map((v, n) => (n === i ? p : v)));
  const setOpen = (i: number, v: boolean) => {
    setOpenSeats((prev) => prev.map((o, n) => (n === i ? v : o)));
    // A seat cannot be both somebody and open.
    if (v) setSeat(i, null);
  };

  const taken = seats.filter(Boolean).map((p) => p!.id);
  const anyOpen = openSeats.some(Boolean);

  return (
    <form action={action} className={styles.bookForm}>
      <input type="hidden" name="timeSlotId" value={slotId} />

      <SeatPicker
        seat={1}
        name="userId"
        picked={seats[0]}
        onPick={(p) => setSeat(0, p)}
        open={false}
        // Seat one is the owner: the court is under their name and cannot be «Açık».
        onToggleOpen={null}
        taken={taken.filter((id) => id !== seats[0]?.id)}
      />

      {GUEST_SEATS.map((seat, i) => (
        <SeatPicker
          key={seat}
          seat={seat}
          name={`player${seat}`}
          picked={seats[i + 1]}
          onPick={(p) => setSeat(i + 1, p)}
          open={openSeats[i + 1]}
          onToggleOpen={(v) => setOpen(i + 1, v)}
          taken={taken.filter((id) => id !== seats[i + 1]?.id)}
        />
      ))}

      {anyOpen && (
        <p className={f.hint}>
          ⚠️ «Açık» işaretlenen rezervasyonda <strong>boş kalan tüm yerler</strong> üyelere
          açılır — katılan kişi ilk boş yere yerleşir. Misafir hesaplara açılmaz.
        </p>
      )}

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
        {/* Disabled until the owner is chosen: the action refuses an empty seat one anyway,
            and an enabled button that always errors is worse than one that waits. Seats two
            to four are genuinely optional, so they gate nothing. */}
        {seats[0] ? (
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
