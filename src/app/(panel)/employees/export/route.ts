import { NextResponse } from "next/server";
import { apiRequest } from "@/lib/api";
import type { EmployeeMonth } from "@/lib/types";

/**
 * `GET /employees/export?month=2026-10` — the month as a CSV, for payroll.
 *
 * Built here from the same payload the grid draws, so the file and the screen cannot
 * disagree. Shaped for **Turkish Excel**, which is what will open it: `;` as the separator
 * (Excel in a Turkish locale reads `,` as the decimal mark), a UTF-8 BOM so «Çalışkan» does
 * not arrive as mojibake, and İzmir wall-clock times.
 *
 * Days with an entry and no exit are written with an empty exit and «çıkış yok» in the
 * note, and contribute nothing to the hours — the same rule as the screen.
 */
export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  const result = await apiRequest<EmployeeMonth>(
    `/api/v1/crm/employees/attendance${month ? `?month=${encodeURIComponent(month)}` : ""}`
  );
  if (result.kind === "unauthorized") return NextResponse.redirect(new URL("/login", request.url));
  if (result.kind !== "ok") return new NextResponse(result.message, { status: result.kind === "forbidden" ? 403 : 400 });

  const time = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(iso))
      : "";
  const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
  // A cell that starts with = + - @ is a formula to Excel. Names are staff-typed, but a CSV
  // is opened by somebody else on another machine; quote everything and neutralise those.
  const cell = (v: string) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

  const m = result.data;
  const lines = [["Çalışan", "Tarih", "İlk giriş", "Son çıkış", "Çalışılan süre (sa:dk)", "Okutma", "Not"]];
  for (const e of m.employees) {
    for (const d of e.days) {
      const note = d.openEntry ? (d.date === m.today ? "içeride" : "çıkış yok") : "";
      lines.push([e.fullName, d.date, time(d.firstEntry), time(d.lastExit), hm(d.workedMinutes), String(d.scanCount), note]);
    }
    lines.push([e.fullName, "TOPLAM", "", "", hm(e.totalMinutes), "", `${e.daysPresent} gün`]);
  }
  const csv = "﻿" + lines.map((l) => l.map(cell).join(";")).join("\r\n") + "\r\n";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calisan-takibi-${m.month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
