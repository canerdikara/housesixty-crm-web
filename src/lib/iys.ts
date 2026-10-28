import type { IysExportRow } from "./types";

/**
 * The İYS bulk-upload file, exactly as the portal's own sample («Ornek_Bireysel.csv», sent
 * by the club 2026-10-28) — the first version followed İYS's data model and the portal
 * refused it:
 *
 *     IZIN TURU,ALICI,ONAY(1)-RET(0),IZIN KAYNAGI,IZIN TARIHI,IZNIN ALINDIGI BAYI IYS NO
 *     EPOSTA,isim1@ornek.com,1,HS_WEB,31-12-2020 23:59:59,
 *     MESAJ,5901234567,1,HS_SOSYAL_MEDYA,31-12-2020 23:59:59,
 *
 * - comma-separated, no quotes, no BOM, LF line ends, ASCII headers;
 * - a phone is 10 digits with no +90 and no leading 0;
 * - 1 = ONAY, 0 = RET; date `dd-MM-yyyy HH:mm:ss`;
 * - the last column (a dealer's İYS number) stays empty — the club has no dealers;
 * - this is the «Bireysel» file: there is no recipient-type column.
 *
 * Rows İYS would refuse are kept out and counted, so one bad row cannot sink the upload:
 * no İYS source code, or a phone that is not a Turkish number.
 */
export const IYS_HEADER = [
  "IZIN TURU",
  "ALICI",
  "ONAY(1)-RET(0)",
  "IZIN KAYNAGI",
  "IZIN TARIHI",
  "IZNIN ALINDIGI BAYI IYS NO",
];

export type IysUpload = {
  /** Data rows, header excluded. */
  rows: string[][];
  noSource: number;
  foreignPhone: number;
};

export function iysUpload(rows: IysExportRow[]): IysUpload {
  const out: string[][] = [];
  let noSource = 0;
  let foreignPhone = 0;
  for (const r of rows) {
    if (!r.source) { noSource++; continue; }
    let recipient = r.recipient;
    if (r.type !== "EPOSTA") {
      // The backend sends E.164: +90 and ten digits for a Turkish number.
      const m = /^\+90(\d{10})$/.exec(recipient);
      if (!m) { foreignPhone++; continue; }
      recipient = m[1];
    }
    out.push([r.type, recipient, r.status === "ONAY" ? "1" : "0", r.source, iysDate(r.consentDate), ""]);
  }
  return { rows: out, noSource, foreignPhone };
}

/** `2026-08-13 15:08:04` (İzmir) → `13-08-2026 15:08:04`. */
function iysDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(v);
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}` : v;
}

/** The file body: plain CSV like the sample — a cell is quoted only if it must be. */
export function iysCsv(rows: string[][]): string {
  const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [IYS_HEADER, ...rows].map((l) => l.map(cell).join(",")).join("\n") + "\n";
}
