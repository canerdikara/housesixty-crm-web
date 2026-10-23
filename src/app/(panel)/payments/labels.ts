import type { PaymentAttentionKind, PaymentStatus, PosKind, PosStatus } from "@/lib/types";

/** «Ödemeler» wording (virtual_pos.md §9.1). One place, so the list and the detail agree. */

export function paymentStatusLabel(s: PaymentStatus): string {
  return {
    PENDING: "Ödeme bekleniyor",
    COMPLETED: "Tahsil edildi",
    FAILED: "Ödenmedi",
    REFUNDED: "İade edildi",
    REFUND_PENDING: "İade bekliyor",
  }[s] ?? s;
}

export function paymentStatusTone(s: PaymentStatus): "neutral" | "accent" | "good" | "crit" {
  return ({ PENDING: "neutral", COMPLETED: "good", FAILED: "neutral", REFUNDED: "neutral", REFUND_PENDING: "crit" } as const)[s] ?? "neutral";
}

export function posKindLabel(k: PosKind): string {
  return { SALE: "Satış", VOID: "İptal (aynı gün)", REFUND: "İade" }[k] ?? k;
}

export function posStatusLabel(s: PosStatus): string {
  return {
    STARTED: "Başladı",
    APPROVED: "Onaylandı",
    DECLINED: "Reddedildi",
    ABANDONED: "Yarım bırakıldı",
    UNKNOWN: "Sonuç bilinmiyor",
  }[s] ?? s;
}

export function posStatusTone(s: PosStatus): "neutral" | "accent" | "good" | "crit" {
  return ({ STARTED: "neutral", APPROVED: "good", DECLINED: "neutral", ABANDONED: "neutral", UNKNOWN: "accent" } as const)[s] ?? "neutral";
}

export function reasonLabel(r: string | null): string {
  if (!r) return "";
  return ({
    FREE_CANCEL: "Ücretsiz iptal",
    CLUB_CANCEL: "Tesis kaynaklı iptal",
    DUPLICATE: "Mükerrer ödeme",
    ORPHAN: "İptal edilmiş rezervasyona gelen ödeme",
    MANUAL: "Elle iade",
  } as Record<string, string>)[r] ?? r;
}

export function attentionLabel(k: PaymentAttentionKind): string {
  return {
    REFUND_PENDING: "İade bankadan onay bekliyor",
    OWED_REFUND: "Mükerrer / yetim ödeme iadesi bekliyor",
    UNKNOWN_ATTEMPT: "Bankadan 10 dakikadır sonuç alınamadı",
    CONTRACT_MAIL_GAVE_UP: "Sözleşme e-postası gönderilemedi",
  }[k] ?? k;
}

/**
 * The short code legend — the only bank wording this screen shows (§9.1). Codes are the
 * bank's `procreturncode`; anything not listed is shown as the bare code.
 */
export const CODE_LEGEND: [string, string][] = [
  ["00", "Onaylandı"],
  ["05", "Banka onaylamadı"],
  ["12", "Geçersiz işlem"],
  ["14", "Geçersiz kart numarası"],
  ["51", "Yetersiz bakiye / limit"],
  ["54", "Kartın süresi dolmuş"],
  ["57", "Kart sahibine bu işlem kapalı"],
  ["99", "3D doğrulanmadı ya da müşteri bankanın sayfasında vazgeçti"],
];

export function codeLabel(c: string | null): string {
  if (!c) return "—";
  const hit = CODE_LEGEND.find(([k]) => k === c);
  return hit ? `${c} · ${hit[1]}` : c;
}

/** Lira with kuruş, Turkish style. Server amounts are strings; render only, never sum. */
export function tl(v: string | null | undefined): string {
  const n = Number(v ?? 0);
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number.isFinite(n) ? n : 0);
}
