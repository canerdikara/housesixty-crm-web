import Link from "next/link";
import styles from "@/app/(panel)/reports/reports.module.css";

/**
 * A month grid for picking a day.
 *
 * Shared by «Günlük rapor» and the reservations calendar, which want opposite halves of
 * the year: a report can only be run on a day that has happened, and a court can only be
 * booked on one that has not. [maxDate] and [minDate] are what separate them — a screen
 * passes the bound that is true for it and the grid disables the rest.
 *
 * ## Links, not a date input
 *
 * Every cell is an `<a href="/reports/daily?date=…">`, so this stays a server component,
 * the chosen day lives in the URL — a particular day can be bookmarked or sent to a
 * colleague, the convention every filter in this panel follows — and it needs nothing in
 * the client bundle. `<input type="date">` was the other option and was rejected on the
 * same screen-by-screen evidence as the lead form's date of birth (§1m): it opens on the
 * current month with no indication of which days have anything in them.
 *
 * ## Everything is computed in İzmir
 *
 * The grid is built from plain `YYYY-MM-DD` strings and arithmetic on UTC midnights,
 * never from `new Date()` in the viewer's zone. A manager opening this from abroad, or a
 * front-desk machine on a wrong clock, must see the club's calendar — the same rule
 * `lib/dates.ts` follows for display, applied to the grid itself.
 */

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export function Calendar({
  selected,
  today,
  hrefFor,
  maxDate,
  minDate,
}: {
  /** `YYYY-MM-DD`, the day being shown. The grid opens on its month. */
  selected: string;
  /** `YYYY-MM-DD` in İzmir. Marked, so "today" is findable whatever else is selectable. */
  today: string;
  /** The link a day cell points at. Keeps this component route-agnostic. */
  hrefFor: (date: string) => string;
  /** Latest selectable day, inclusive. Omit for no upper bound. */
  maxDate?: string;
  /** Earliest selectable day, inclusive. Omit for no lower bound. */
  minDate?: string;
}) {
  /** Outside the bounds this screen allows — drawn, but not a link. */
  const disabled = (iso: string) =>
    (maxDate !== undefined && iso > maxDate) || (minDate !== undefined && iso < minDate);
  const [year, month] = selected.split("-").map(Number) as [number, number, number];

  // UTC throughout: Date.UTC and getUTCDay never consult the local zone, so this grid is
  // identical on every machine that renders it.
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay is Sunday-first; the club's week starts Monday.
  const leading = (first.getUTCDay() + 6) % 7;

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, +1);
  // A month with no selectable day in it is not worth navigating to. Checked at the
  // month's near edge in each direction — its first day going forward, its last going
  // back — so a partially-selectable month still opens.
  const nextIsOff = maxDate !== undefined && `${next.y}-${pad(next.m)}-01` > maxDate;
  const prevIsOff =
    minDate !== undefined &&
    `${prev.y}-${pad(prev.m)}-${pad(new Date(Date.UTC(prev.y, prev.m, 0)).getUTCDate())}` < minDate;

  const cells: (string | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`),
  ];

  return (
    <div className={styles.calendar}>
      <div className={styles.calHead}>
        {prevIsOff ? (
          <span className={`${styles.calNav} ${styles.calNavOff}`} aria-disabled="true">
            ‹
          </span>
        ) : (
          <Link
            className={styles.calNav}
            href={hrefFor(clampToMonth(prev.y, prev.m, selected, maxDate, minDate))}
            aria-label="Önceki ay"
          >
            ‹
          </Link>
        )}
        <span className={styles.calMonth}>
          {MONTHS[month - 1]} {year}
        </span>
        {nextIsOff ? (
          // Disabled rather than hidden: a control that vanishes at the end of the month
          // reads as a rendering fault.
          <span className={`${styles.calNav} ${styles.calNavOff}`} aria-disabled="true">
            ›
          </span>
        ) : (
          <Link
            className={styles.calNav}
            href={hrefFor(clampToMonth(next.y, next.m, selected, maxDate, minDate))}
            aria-label="Sonraki ay"
          >
            ›
          </Link>
        )}
      </div>

      <div className={styles.calGrid} role="grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className={styles.calWeekday}>
            {w}
          </span>
        ))}
        {cells.map((iso, i) =>
          iso === null ? (
            <span key={`pad-${i}`} />
          ) : disabled(iso) ? (
            // Out of this screen's range. «Günlük rapor» passes maxDate=today, because a
            // "report" on tomorrow is a schedule with an empty attendance column and looks
            // exactly like a day when nobody turned up. The reservations calendar passes
            // no bound at all — yesterday's courts are worth looking at and tomorrow's are
            // the whole point.
            <span key={iso} className={`${styles.calDay} ${styles.calDayOff}`} aria-disabled="true">
              {Number(iso.slice(8))}
            </span>
          ) : (
            <Link
              key={iso}
              href={hrefFor(iso)}
              className={`${styles.calDay} ${iso === selected ? styles.calDayOn : ""} ${
                iso === today ? styles.calDayToday : ""
              }`}
              aria-current={iso === selected ? "date" : undefined}
            >
              {Number(iso.slice(8))}
            </Link>
          )
        )}
      </div>
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function shiftMonth(y: number, m: number, by: number): { y: number; m: number } {
  const i = (y * 12 + (m - 1)) + by;
  return { y: Math.floor(i / 12), m: (i % 12) + 1 };
}

/**
 * Which day to land on when stepping to another month.
 *
 * Keeps the day-of-month where it exists so paging back and forth is reversible, falls
 * back to the last day of a shorter month, and never lands past today — stepping into
 * the current month from the future would otherwise pick a date the backend refuses.
 */
/**
 * The day the month arrows land on: the same day-of-month where that exists, pulled back
 * to the month's last day where it does not (the 31st of a 30-day month), and then held
 * inside whatever bounds the screen set.
 *
 * Without the clamp, stepping to a month that is only partly selectable lands on a
 * disabled day and the grid opens on something that cannot be chosen.
 */
function clampToMonth(
  y: number,
  m: number,
  selected: string,
  maxDate?: string,
  minDate?: string,
): string {
  const wanted = Number(selected.slice(8));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const iso = `${y}-${pad(m)}-${pad(Math.min(wanted, lastDay))}`;
  if (maxDate !== undefined && iso > maxDate) return maxDate;
  if (minDate !== undefined && iso < minDate) return minDate;
  return iso;
}
