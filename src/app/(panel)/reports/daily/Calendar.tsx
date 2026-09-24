import Link from "next/link";
import styles from "../reports.module.css";

/**
 * A month grid for picking the day to report on.
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
}: {
  /** `YYYY-MM-DD`, the day being reported on. The grid shows its month. */
  selected: string;
  /** `YYYY-MM-DD` in İzmir. Days after this are not selectable. */
  today: string;
}) {
  const [year, month] = selected.split("-").map(Number) as [number, number, number];

  // UTC throughout: Date.UTC and getUTCDay never consult the local zone, so this grid is
  // identical on every machine that renders it.
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay is Sunday-first; the club's week starts Monday.
  const leading = (first.getUTCDay() + 6) % 7;

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, +1);
  // A month entirely in the future has no day worth opening.
  const nextIsFuture = `${next.y}-${pad(next.m)}-01` > today;

  const cells: (string | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`),
  ];

  return (
    <div className={styles.calendar}>
      <div className={styles.calHead}>
        <Link
          className={styles.calNav}
          href={`/reports/daily?date=${clampToMonth(prev.y, prev.m, selected, today)}`}
          aria-label="Önceki ay"
        >
          ‹
        </Link>
        <span className={styles.calMonth}>
          {MONTHS[month - 1]} {year}
        </span>
        {nextIsFuture ? (
          // Disabled rather than hidden: a control that vanishes at the end of the month
          // reads as a rendering fault.
          <span className={`${styles.calNav} ${styles.calNavOff}`} aria-disabled="true">
            ›
          </span>
        ) : (
          <Link
            className={styles.calNav}
            href={`/reports/daily?date=${clampToMonth(next.y, next.m, selected, today)}`}
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
          ) : iso > today ? (
            // The backend refuses a future day, and it should: a "report" on tomorrow is
            // a schedule with an empty attendance column, which looks exactly like a day
            // when nobody turned up.
            <span key={iso} className={`${styles.calDay} ${styles.calDayOff}`} aria-disabled="true">
              {Number(iso.slice(8))}
            </span>
          ) : (
            <Link
              key={iso}
              href={`/reports/daily?date=${iso}`}
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
function clampToMonth(y: number, m: number, selected: string, today: string): string {
  const wanted = Number(selected.slice(8));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const iso = `${y}-${pad(m)}-${pad(Math.min(wanted, lastDay))}`;
  return iso > today ? today : iso;
}
