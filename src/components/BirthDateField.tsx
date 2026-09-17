"use client";

import { useState } from "react";
import { formStyles as f } from "./Form";

/**
 * Date of birth as three dropdowns — gün · ay · yıl.
 *
 * **Not `<input type="date">`.** That control opens on the current month, so entering a
 * 1986 birthday means paging back forty years one month at a time (user, 2026-09-16,
 * after testing it). A native picker is right for "when did this happen" — the
 * interaction date, the membership term — and wrong for a date of birth, where the year
 * is the part you know first and the part furthest away.
 *
 * The year list runs from this year backwards, so the useful end is the near end.
 *
 * **A partial answer is kept, not discarded.** Year alone posts `birthYear` and nothing
 * else; the backend has stored a bare year since before V40 precisely because the
 * website form and the enquiry importer can only supply one. Someone who knows the year
 * and not the day therefore records what they know, instead of being forced to invent a
 * 1st of January or leave the field empty.
 */
export function BirthDateField({
  idPrefix,
  label = "Doğum tarihi",
  /** ISO `YYYY-MM-DD`, when the record already has a full date. */
  value,
  /** Set when only a year is known — a lead from the website form or the importer. */
  yearOnly,
}: {
  idPrefix: string;
  label?: string;
  value?: string | null;
  yearOnly?: number | null;
}) {
  const initial = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const [year, setYear] = useState(initial?.[1] ?? (yearOnly ? String(yearOnly) : ""));
  const [month, setMonth] = useState(initial?.[2] ?? "");
  const [day, setDay] = useState(initial?.[3] ?? "");

  // İzmir's year, not the browser's: the club is in one timezone, and on 1 January the
  // two disagree for three hours.
  const thisYear = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric" })
      .format(new Date())
  );
  const years = Array.from({ length: 101 }, (_, i) => thisYear - i);

  /*
   * The day list follows the chosen month and year, so 31 Şubat cannot be selected at
   * all — and a day already chosen that the new month does not have is cleared rather
   * than left showing an impossible date. February gets 29 only in a leap year, which
   * `new Date(y, m, 0)` works out from the calendar rather than from a rule written
   * here.
   */
  const daysInMonth =
    month && year ? new Date(Number(year), Number(month), 0).getDate() : 31;
  if (day && Number(day) > daysInMonth) setDay("");

  return (
    <div className={f.field}>
      <span className={f.label}>{label}</span>
      <div className={f.dateParts}>
        <select
          id={`${idPrefix}-day`} name="birthDay" className={f.select}
          value={day} onChange={(e) => setDay(e.target.value)} aria-label="Gün"
        >
          <option value="">Gün</option>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
            <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
          ))}
        </select>

        <select
          id={`${idPrefix}-month`} name="birthMonth" className={f.select}
          value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Ay"
        >
          <option value="">Ay</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
          ))}
        </select>

        <select
          id={`${idPrefix}-year`} name="birthYear" className={f.select}
          value={year} onChange={(e) => setYear(e.target.value)} aria-label="Yıl"
        >
          <option value="">Yıl</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <p className={f.hint}>
        Yalnızca yıl biliniyorsa gün ve ayı boş bırakabilirsiniz.
      </p>
    </div>
  );
}

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
