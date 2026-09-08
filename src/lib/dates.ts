/**
 * Date and time formatting, pinned to İzmir.
 *
 * **The viewer's browser timezone never decides what anything means here.** Every
 * formatter below passes `timeZone: "Europe/Istanbul"` explicitly. A staff member
 * opening the panel from a laptop still set to UTC — or from abroad — must see the
 * same "3 gün önce" as the person sitting at the front desk, because that number is
 * about the club's day, not theirs.
 *
 * This is the browser-side half of the rule the backend follows with `HsTime`, and it
 * is the same trap the iOS apps hit: `Calendar.current` followed the device, so on a
 * UTC device every comparison ran three hours out. Unlike a layout bug, this one
 * produces plausible numbers that are quietly wrong.
 *
 * All timestamps from the CRM API are `Instant` — genuine UTC, ISO-8601 — so they are
 * unambiguous on the wire and only the *display* needs pinning. The wall-clock
 * `LocalDate`/`LocalTime` fields elsewhere in this platform are a different problem and
 * do not appear in the lead payloads.
 */

const ZONE = "Europe/Istanbul";
const LOCALE = "tr-TR";

const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONE, day: "numeric", month: "short", year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONE, day: "numeric", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});

const dayMonthFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONE, day: "numeric", month: "short",
});

/** "12 Eyl 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

/** "12 Eyl 2026 14:10". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
}

/** "12 Eyl" — for dense table columns where the year is noise. */
export function formatDayMonth(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dayMonthFmt.format(d);
}

/**
 * Whole days between an instant and now, counted in **İzmir calendar days**.
 *
 * Not `(now - then) / 86400000`. That gives elapsed 24-hour periods, so something at
 * 23:00 last night reads as "0 gün" until 23:00 tonight, when the answer a person
 * wants is "1 gün" — yesterday. The list's whole purpose is spotting leads nobody has
 * touched for a week, and an off-by-one at every boundary makes that list untrustworthy.
 *
 * Both instants are reduced to their İzmir calendar date first, then subtracted.
 */
function izmirDayNumber(d: Date): number {
  // en-CA gives YYYY-MM-DD, which parses back as a UTC midnight — a stable integer day
  // index once both sides are computed the same way.
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  return Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86_400_000);
}

export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return izmirDayNumber(now) - izmirDayNumber(d);
}

/**
 * "bugün" / "dün" / "3 gün" — the "son temas" column on screen 3.
 *
 * Returns an em dash for a lead nobody has contacted, rather than "0 gün", which would
 * read as "contacted today" and is the opposite of the truth.
 */
export function daysSinceLabel(iso: string | null | undefined, now: Date = new Date()): string {
  const n = daysSince(iso, now);
  if (n === null) return "—";
  if (n <= 0) return "bugün";
  if (n === 1) return "dün";
  return `${n} gün`;
}

/** "yarın" / "bugün" / "2 gün gecikti" — the next-action column. */
export function dueLabel(iso: string | null | undefined, now: Date = new Date()): string {
  const n = daysSince(iso, now);
  if (n === null) return "—";
  if (n > 0) return `${n} gün gecikti`;
  if (n === 0) return "bugün";
  if (n === -1) return "yarın";
  return `${Math.abs(n)} gün sonra`;
}
