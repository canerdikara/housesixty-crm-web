import { NextResponse } from "next/server";
import { apiRequest } from "@/lib/api";
import type { IysExport } from "@/lib/types";

/**
 * `GET /settings/iys-export?kind=iys|review&from=2026-10-01&to=2026-10-06`
 *
 * Two files from one payload (`GET /crm/consents/iys-export`, ADMIN only):
 *
 * - **iys** — the upload: İYS's six fields and nothing else, one row per address and
 *   type with its latest status. ⚠️ The headers follow İYS's data model; when the club
 *   sends the portal's own template, match the header names and order to it here.
 * - **review** — the same rows plus who they belong to and every flag the backend raised
 *   (address filled in afterwards, source inferred, PANEL source assumed). For the person
 *   uploading to read first; it must not be uploaded itself.
 *
 * Shaped for Turkish Excel like the employees export: `;`, UTF-8 BOM, every cell quoted
 * and formula-neutralised.
 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const kind = sp.get("kind") === "review" ? "review" : "iys";
  const q = new URLSearchParams();
  for (const k of ["from", "to"]) {
    const v = sp.get(k);
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) q.set(k, v);
  }
  const result = await apiRequest<IysExport>(`/api/v1/crm/consents/iys-export${q.size ? `?${q}` : ""}`);
  if (result.kind === "unauthorized") return NextResponse.redirect(new URL("/login", request.url));
  if (result.kind !== "ok") return new NextResponse(result.message, { status: result.kind === "forbidden" ? 403 : 400 });

  const cell = (v: string) => `"${(/^[=+\-@]/.test(v) && !/^\+\d+$/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  const rows = result.data.rows;

  const lines: string[][] = kind === "iys"
    ? [
        ["ALICI", "TİP", "DURUM", "İZİN TARİHİ", "KAYNAK", "ALICI TÜRÜ"],
        ...rows.map((r) => [r.recipient, r.type, r.status, r.consentDate, r.source, r.recipientType]),
      ]
    : [
        ["ALICI", "TİP", "DURUM", "İZİN TARİHİ", "KAYNAK", "ALICI TÜRÜ", "KİŞİ", "KAYIT", "BİZDEKİ KAYNAK", "METİN SÜRÜMÜ", "KONTROL"],
        ...rows.map((r) => [
          r.recipient, r.type, r.status, r.consentDate, r.source, r.recipientType,
          r.name, r.subjectType === "MEMBER" ? "Üye" : "Aday", r.ourSource ?? "", r.textVersion,
          [
            r.addressBackfilled && "Adres sonradan dolduruldu (kişinin bugünkü adresi)",
            r.sourceInferred && "Kaynak kayıttan çıkarıldı",
            r.sourceAssumed && "Panel kaydı: fiziksel ortam varsayıldı — telefonla alındıysa düzeltin",
            !r.source && "Kaynak belirlenemedi — yüklemeden önce doldurun",
          ].filter(Boolean).join(" · "),
        ]),
      ];

  // A phone number in E.164 starts with "+", which Excel reads as a formula sign. It is
  // quoted, so Excel keeps it as text; the neutraliser above leaves "+905…" untouched.
  const csv = "﻿" + lines.map((l) => l.map(cell).join(";")).join("\r\n") + "\r\n";
  const span = [q.get("from"), q.get("to")].filter(Boolean).join("_") || "tumu";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind === "iys" ? "iys-izinler" : "iys-kontrol"}-${span}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
