"use client";

import { useActionState, useEffect, useState } from "react";
import { FormMessage, SubmitButton, formStyles as f } from "@/components/Form";
import { Badge, ui } from "@/components/ui";
import type { FormState } from "@/lib/formState";
import type { CalendarReservation, CalendarSlot, ReservationCalendar } from "@/lib/types";
import { bookSlotAction, cancelReservationAction, createDeskSlotAction, searchMembersAction } from "./actions";
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
  initialSlotId,
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
  /**
   * `?slot=` — the slot «Rezervasyon ekle» just opened. Its booking panel starts open, so
   * the desk goes straight from "open an hour" to "who is it for".
   */
  initialSlotId?: string;
}) {
  const find = (id: string | undefined) => {
    if (!id) return null;
    for (const fac of calendar.facilities) {
      const slot = fac.slots.find((s) => s.slotId === id);
      if (slot) return { slot, facility: fac.name };
    }
    return null;
  };
  const [selected, setSelected] = useState<{ slot: CalendarSlot; facility: string } | null>(() => find(initialSlotId));
  const [adding, setAdding] = useState(false);

  /*
   * Close the panel whenever the server sends a new grid.
   *
   * After a booking the action revalidates and this component re-renders with fresh data;
   * without this the panel stays open over a cell that is now taken, showing a booking form
   * for a court somebody just got. Keyed on the counts rather than on a render, so an
   * unrelated re-render does not close a panel the user is halfway through.
   */
  useEffect(() => {
    // The just-opened slot stays selected across the re-render a booking causes, so the
    // panel turns into the booking's detail — the confirmation the desk is looking for.
    setSelected(find(initialSlotId));
    setAdding(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar.date, calendar.facilityType, calendar.bookedCount, initialSlotId]);

  const canAdd = canWrite && !readOnly && calendar.facilityOptions.length > 0;

  return (
    <div className={styles.layout}>
      {/* Its own scroller: six columns of an hour each can exceed a narrow window, and the
          page body must never scroll sideways. */}
      <div className={styles.scroller}>
        {calendar.facilities.length === 0 ? (
          /*
           * A day nobody generated slots for. Not an error, and no longer a dead end: the
           * month picker is still beside it, and «Rezervasyon ekle» opens an hour.
           */
          <div className={styles.emptyDay}>
            <p className={styles.emptyDayTitle}>Bu tarihte seans yok</p>
            <p className={styles.emptyDayText}>
              Bu gün için {calendar.facilityType === "SPA" ? "spa" : "padel"} seansı oluşturulmamış.
              {canAdd
                ? " «Rezervasyon ekle» ile tek bir saat açıp hemen rezervasyon yapabilirsiniz; toplu seanslar yönetici uygulamasındaki «Seans oluştur» ekranından tanımlanır."
                : readOnly
                  ? " Geçmiş bir güne rezervasyon eklenemez."
                  : " Seanslar yönetici uygulamasındaki «Seans oluştur» ekranından tanımlanır."}
            </p>
          </div>
        ) : (
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
        )}
      </div>

      <div className={styles.side}>
        {canAdd && !adding && (
          <button type="button" className={ui.button} onClick={() => { setSelected(null); setAdding(true); }}>
            + Rezervasyon ekle
          </button>
        )}
        {adding && (
          <AddSlotPanel
            calendar={calendar}
            dateLabel={dateLabel}
            onClose={() => setAdding(false)}
          />
        )}
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
                {p.fullName ??
                  (p.isOpen
                    ? reservation.guestsAllowed
                      ? "Açık — üyelere ve misafirlere"
                      : "Açık — üyelere"
                    : "—")}
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
          {/* Deliberately does not say WHO may join: that is the booking-level guest
              choice below, which can still be changed after this seat is marked. Saying
              "üyeler" here was wrong the moment the guest box was ticked. */}
          <span className={ui.muted}>Açık — katılıma açık</span>
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

      {/*
        Booking-level, not seat-level — shown once, under the seats, and only when at least
        one seat is open. Putting the guest choice beside a single seat would imply it
        belongs to that seat; it belongs to the booking, exactly as `isOpen` does.

        ⚠️ Unmounted rather than hidden when no seat is open. A hidden-but-present checkbox
        keeps its checked state and would submit a stale `true` — which is precisely the bug
        the member app shipped, where `guestsAllowed` was computed off a control that had
        been hidden instead of reset. The action also re-applies `isOpen &&`.
      */}
      {anyOpen && (
        <div className={f.field}>
          <p className={f.hint}>
            ⚠️ «Açık» işaretlenen rezervasyonda <strong>boş kalan tüm yerler</strong>{" "}
            açılır — katılan kişi ilk boş yere yerleşir.
          </p>
          <label className={styles.guestToggle}>
            <input type="checkbox" name="guestsAllowed" />
            <span>
              Misafir hesaplar da görebilsin ve katılmak için istek gönderebilsin
            </span>
          </label>
          <p className={f.hint}>
            İşaretlenmezse oyunu yalnızca üyeler görür. Misafiri bu formdan oyuncu olarak
            <strong> ekleyemezsiniz</strong> — misafir açık oyuna kendi isteğiyle katılır.
          </p>
        </div>
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

/**
 * «Rezervasyon ekle» — open one hour on one court, then book it.
 *
 * Price, discount and length default to what that court's most recent slot carried, so a
 * desk opening an hour on an ordinary day changes nothing but the time. The backend refuses
 * an hour in the past and any overlap with an existing slot on that court.
 */
function AddSlotPanel({
  calendar,
  dateLabel,
  onClose,
}: {
  calendar: ReservationCalendar;
  dateLabel: string;
  onClose: () => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(createDeskSlotAction, {});
  const options = calendar.facilityOptions;
  const [facilityId, setFacilityId] = useState(options[0]?.id ?? "");
  const fac = options.find((o) => o.id === facilityId);
  // Keyed on the court, so switching court re-seeds price and length from that court.
  const seedKey = facilityId;
  const durations = [30, 60, 90, 120];
  const lastDuration = fac?.lastDurationMinutes ?? 60;

  return (
    <aside className={styles.panel} aria-label="Rezervasyon ekle">
      <div className={styles.panelHead}>
        <div>
          <p className={styles.panelTitle}>Rezervasyon ekle</p>
          <p className={styles.panelSub}>{dateLabel} · önce saat açılır, sonra üye seçilir</p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Kapat">×</button>
      </div>
      <form action={action} className={f.form}>
        <input type="hidden" name="date" value={calendar.date} />
        <input type="hidden" name="type" value={calendar.facilityType} />
        <FormMessage state={state} />
        <div className={f.field}>
          <label className={f.label} htmlFor="ds-fac">{calendar.facilityType === "SPA" ? "Oda" : "Kort"}</label>
          <select id="ds-fac" name="facilityId" className={f.select} value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className={f.row}>
          <div className={f.field}>
            <label className={f.label} htmlFor="ds-time">Başlangıç</label>
            <input id="ds-time" name="startTime" type="time" step={900} className={f.input} required defaultValue="18:00" />
          </div>
          <div className={f.field}>
            <label className={f.label} htmlFor="ds-dur">Süre</label>
            <select key={`d-${seedKey}`} id="ds-dur" name="durationMinutes" className={f.select}
              defaultValue={String(durations.includes(lastDuration) ? lastDuration : 60)}>
              {durations.map((d) => <option key={d} value={d}>{d} dk</option>)}
            </select>
          </div>
        </div>
        <div className={f.row}>
          <div className={f.field}>
            <label className={f.label} htmlFor="ds-price">Ücret (₺)</label>
            <input key={`p-${seedKey}`} id="ds-price" name="price" inputMode="decimal" className={f.input} required
              defaultValue={fac?.lastPrice != null ? String(fac.lastPrice) : ""} placeholder="0" />
          </div>
          <div className={f.field}>
            <label className={f.label} htmlFor="ds-disc">Üye indirimi (%)</label>
            <input key={`m-${seedKey}`} id="ds-disc" name="memberDiscountPercent" type="number" min={0} max={100}
              className={f.input} defaultValue={String(fac?.lastMemberDiscountPercent ?? 0)} />
          </div>
        </div>
        {fac?.lastPrice == null && (
          <p className={f.hint}>Bu {calendar.facilityType === "SPA" ? "oda" : "kort"} için daha önce seans açılmamış — ücreti girin.</p>
        )}
        <div className={f.actions}>
          <SubmitButton pendingLabel="Açılıyor…">Saati aç ve üye seç</SubmitButton>
        </div>
      </form>
    </aside>
  );
}
