/**
 * Turkish display names for the backend's enum values.
 *
 * The wire carries `PROPOSAL_SENT`; the screen shows "Teklif gönderildi". Keeping the
 * translation here rather than on the server matches how the native apps do it
 * (`Localization+Labels.swift`, `Labels.kt`) and keeps the wire value as the stable
 * contract.
 *
 * Every one of these falls back to the raw value rather than to a blank. A new backend
 * enum member should look unfamiliar on screen, not invisible — a missing status is
 * how a row silently loses its meaning.
 */

import type { LeadSource, LeadStatus, InteractionType, InterestCategory, ConsentChannel, SegmentRule } from "./types";

/** Pipeline stages in board order. Do not sort — this is the sales process. */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "VISITED",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
];

export function leadStatusLabel(v: string): string {
  switch (v) {
    case "NEW": return "Aday";
    case "CONTACTED": return "İletişim kuruldu";
    case "VISITED": return "Ziyaret yapıldı";
    case "PROPOSAL_SENT": return "Teklif gönderildi";
    case "WON": return "Üye oldu";
    case "LOST": return "Olumsuz";
    default: return v;
  }
}

/**
 * The visual weight a stage carries.
 *
 * `good` and `crit` are the reserved status colours — WON and LOST are the only two
 * outcomes, and they are the only two stages that get one. Everything in between is
 * neutral, because a lead sitting at VISITED is neither good news nor bad.
 */
export function leadStatusTone(v: string): "neutral" | "accent" | "good" | "crit" {
  switch (v) {
    case "WON": return "good";
    case "LOST": return "crit";
    case "PROPOSAL_SENT": return "accent";
    default: return "neutral";
  }
}

export function leadSourceLabel(v: string): string {
  switch (v) {
    case "WEBSITE_FORM": return "Web sitesi";
    case "REFERRAL": return "Üye referansı";
    case "WALK_IN": return "Ziyaret";
    case "EVENT": return "Etkinlik";
    case "SOCIAL": return "Sosyal medya";
    case "PARTNER": return "Partner";
    case "OTHER": return "Diğer";
    default: return v;
  }
}

export function interactionTypeLabel(v: string): string {
  switch (v) {
    case "CALL": return "Telefon";
    case "EMAIL": return "E-posta";
    case "WHATSAPP": return "WhatsApp";
    case "SMS": return "SMS";
    case "MEETING": return "Görüşme";
    case "VISIT": return "Ziyaret";
    case "NOTE": return "Not";
    case "SYSTEM": return "Sistem";
    default: return v;
  }
}

/**
 * The channel labels for one timeline entry, joined.
 *
 * Both timelines — the lead detail and the member 360 — render interactions, and both
 * must say the same thing about a multi-channel one. `types` is absent when the backend
 * predates V36, so the fallback is the single `type` it has always sent, and an empty
 * array is treated the same way rather than rendering a blank label.
 */
export function interactionTypesLabel(e: { type: string; types?: string[] }): string {
  const list = e.types?.length ? e.types : [e.type];
  return list.map(interactionTypeLabel).join(", ");
}

export function interestLabel(v: string): string {
  switch (v) {
    case "PADEL": return "Padel";
    case "GYM": return "Gym";
    case "PILATES": return "Pilates";
    case "SPA": return "Spa";
    case "WELLNESS": return "Wellness";
    case "EVENTS": return "Etkinlik";
    case "DESIGN": return "Tasarım";
    case "ENTREPRENEURSHIP": return "Girişimcilik";
    case "SUSTAINABILITY": return "Sürdürülebilirlik";
    case "FNB": return "Restoran";
    case "RETAIL": return "Perakende";
    case "SOCIAL_SCENE": return "Sosyal ortam";
    default: return v;
  }
}

export function consentChannelLabel(v: string): string {
  switch (v) {
    case "EMAIL": return "E-posta";
    case "SMS": return "SMS";
    case "WHATSAPP": return "WhatsApp";
    case "PHONE": return "Telefon";
    case "ALL": return "Tüm kanallar";
    default: return v;
  }
}

export const LEAD_SOURCES: LeadSource[] = [
  "WEBSITE_FORM", "REFERRAL", "WALK_IN", "EVENT", "SOCIAL", "PARTNER", "OTHER",
];

/**
 * Every category the system knows, in category order.
 *
 * ⚠️ This is what the member 360's interests editor offers, and that editor is a
 * **whole-object PUT** — a category missing from this list is a category the next save
 * silently deletes. Conversion now copies a lead's interests onto the member, so
 * anything offered on the lead form has to appear here too.
 */
export const INTEREST_CATEGORIES: InterestCategory[] = [
  "PADEL", "GYM", "PILATES", "SPA", "WELLNESS", "EVENTS",
  "DESIGN", "ENTREPRENEURSHIP", "SUSTAINABILITY", "FNB", "RETAIL",
];

export const INTERACTION_TYPES: InteractionType[] = [
  "CALL", "WHATSAPP", "EMAIL", "SMS", "MEETING", "VISIT", "NOTE",
];

/**
 * The shorter list the «Yeni Aday» form offers — what the club actually sells.
 *
 * A deliberate subset of [INTEREST_CATEGORIES] rather than a second vocabulary: the
 * values are the same enum, so a lead's interests carry onto the member unchanged. The
 * member 360 still offers all of them, because a member's interests are recorded over
 * time by someone who knows them.
 */
export const LEAD_INTEREST_CATEGORIES: InterestCategory[] = [
  "PADEL", "GYM", "SPA", "FNB", "SOCIAL_SCENE",
];

/** How the membership was paid for, as recorded at the desk (V39). */
export function paymentMethodLabel(v: string): string {
  switch (v) {
    case "NAKIT": return "Nakit";
    case "KREDI_KARTI_TEK_CEKIM": return "Kredi Kartı — Tek Çekim";
    case "KREDI_KARTI_3_TAKSIT": return "Kredi Kartı — 3 Taksit";
    case "KREDI_KARTI_6_TAKSIT": return "Kredi Kartı — 6 Taksit";
    default: return v;
  }
}

/**
 * The emergency contact's gender, as a closed list (user, 2026-09-16).
 *
 * Stored as free text — the column is VARCHAR and `member_profiles.gender` remains open
 * — so adding a third value here is a one-line change with no migration behind it.
 */
export const EMERGENCY_GENDERS = ["Erkek", "Kadın"] as const;

export const PAYMENT_METHODS = [
  "NAKIT",
  "KREDI_KARTI_TEK_CEKIM",
  "KREDI_KARTI_3_TAKSIT",
  "KREDI_KARTI_6_TAKSIT",
] as const;

export const CONSENT_CHANNELS: ConsentChannel[] = ["EMAIL", "SMS", "WHATSAPP", "PHONE", "ALL"];


/** Renewal state of a membership term — separate from the term's own status. */
export function renewalStatusLabel(v: string): string {
  switch (v) {
    case "NOT_CONTACTED": return "Görüşülmedi";
    case "CONTACTED": return "Görüşüldü";
    case "PROPOSAL_SENT": return "Teklif gönderildi";
    case "RENEWED": return "Yenilendi";
    case "DECLINED": return "Yenilemedi";
    default: return v;
  }
}

export function termStatusLabel(v: string): string {
  switch (v) {
    case "ACTIVE": return "Aktif";
    case "COMPLETED": return "Tamamlandı";
    case "CANCELLED": return "İptal";
    default: return v;
  }
}

/**
 * "2026-08" → "Ağu".
 *
 * Formatted from a UTC-anchored date so the month name cannot drift: the key is
 * already an İzmir month computed on the server, and re-interpreting it in the
 * browser's zone is exactly how it would move.
 */
export function monthShortLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Intl.DateTimeFormat("tr-TR", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 1)));
}


/**
 * Facility types, as the platform actually defines them.
 *
 * Only two exist. Mockup screen 2 stacks Padel / Gym / Pilates / Spa, but the gym is
 * entered through the turnstile and has no bookable slots, and pilates is not a
 * facility at all — so neither can appear on a chart built from reservations. The
 * fallback returns the raw value, so a facility type added later shows up looking
 * unfamiliar rather than blank.
 */
export function facilityTypeLabel(v: string): string {
  switch (v) {
    case "PADEL_COURT": return "Padel";
    case "SPA": return "Spa";
    default: return v;
  }
}

/**
 * The series colour for a facility type.
 *
 * Tied to the entity, never to its position in the list (§7.4): spa stays magenta
 * whether or not padel is on the chart. The token names already reserve `--s2` for the
 * gym and `--s3` for pilates, so a facility type arriving for either lands on the
 * colour the design already gave it.
 */
export function facilityTypeColor(v: string): string {
  switch (v) {
    case "PADEL_COURT": return "var(--s1)";
    case "SPA": return "var(--s4)";
    default: return "var(--s3)";
  }
}


// ── Segments ─────────────────────────────────────────────────────────────────────

/**
 * What a segment field is called on screen.
 *
 * The backend serves the field *names*; the Turkish is here, like every other enum in
 * this file. An unmapped field falls back to its raw name rather than to a blank — a
 * field added to the whitelist should look unfamiliar in the builder, not invisible.
 */
export function segmentFieldLabel(v: string): string {
  switch (v) {
    case "last_visit_days": return "Son ziyaret (gün)";
    case "visit_count_30d": return "Ziyaret sayısı · 30 gün";
    case "visit_count_90d": return "Ziyaret sayısı · 90 gün";
    case "visit_time_bucket": return "Ziyaret saati";
    case "facility_used": return "Tesis kullanımı";
    case "guest_count_6m": return "Misafir sayısı · 6 ay";
    case "membership_type": return "Üyelik tipi";
    case "membership_status": return "Üyelik durumu";
    case "membership_end_days": return "Üyelik bitişine (gün)";
    case "join_date_days": return "Üyelik yaşı (gün)";
    case "interest": return "İlgi alanı";
    case "tournament_count": return "Turnuva katılımı";
    case "lesson_count": return "Ders katılımı";
    default: return v;
  }
}

export function segmentOperatorLabel(v: string): string {
  switch (v) {
    case "eq": return "eşittir";
    case "ne": return "eşit değildir";
    case "lt": return "küçüktür";
    case "lte": return "en fazla";
    case "gt": return "büyüktür";
    case "gte": return "en az";
    case "includes": return "içerir";
    case "excludes": return "içermez";
    default: return v;
  }
}

/**
 * The value side of a rule, in Turkish.
 *
 * One function rather than one per field, because the builder renders a `<select>`
 * without knowing which vocabulary a field's values come from — facility types,
 * interests, membership statuses and visit buckets all arrive as plain strings. A
 * membership tier is already Turkish and falls through unchanged, which is why the
 * default returns the raw value.
 */
export function segmentValueLabel(v: string): string {
  switch (v) {
    case "MORNING": return "Sabah (12:00 öncesi)";
    case "AFTERNOON": return "Öğleden sonra (12:00–17:00)";
    case "EVENING": return "Akşam (17:00 sonrası)";
    case "ACTIVE": return "Aktif";
    case "EXPIRED": return "Süresi doldu";
    case "CANCELLED": return "İptal";
    case "PADEL_COURT": return "Padel";
    case "SPA": return "Spa";
    default: return interestLabel(v);
  }
}

/**
 * A rule as one sentence — the summary line on a segment card.
 *
 * Negations read as "değil" at the end rather than as a separate prefix, because the
 * card has one line per segment and not one row per rule.
 */
export function segmentRuleSentence(rule: SegmentRule): string {
  const value = rule.value.trim();
  const shown = /^-?\d+$/.test(value) ? value : segmentValueLabel(value);
  return `${segmentFieldLabel(rule.field)} ${segmentOperatorLabel(rule.op)} ${shown}`;
}

// ── Campaigns — V42 ─────────────────────────────────────────────────────────────

export function campaignChannelLabel(v: string): string {
  switch (v) {
    case "EMAIL": return "E-posta";
    case "WHATSAPP": return "WhatsApp";
    case "SMS": return "SMS";
    case "PUSH": return "Push";
    default: return v;
  }
}

export function campaignStatusLabel(v: string): string {
  switch (v) {
    case "DRAFT": return "Taslak";
    case "SCHEDULED": return "Zamanlandı";
    case "SENDING": return "Gönderiliyor";
    case "COMPLETED": return "Tamamlandı";
    case "FAILED": return "Başarısız";
    case "CANCELLED": return "İptal edildi";
    default: return v;
  }
}

/**
 * What became of one copy.
 *
 * ⚠️ «Gönderilmedi» for SUPPRESSED, not «Engellendi» or «Atlandı». The row means the
 * club deliberately did not write to this person because consent had been withdrawn,
 * and the word on the screen has to say that plainly — a staff member reading it needs
 * to understand it was a decision, not a delivery problem.
 */
export function deliveryStateLabel(v: string): string {
  switch (v) {
    case "QUEUED": return "Sırada";
    case "SENT": return "Gönderildi";
    case "DELIVERED": return "Teslim";
    case "OPENED": return "Açıldı";
    case "CLICKED": return "Tıklandı";
    case "BOUNCED": return "Geri döndü";
    case "FAILED": return "Başarısız";
    case "SUPPRESSED": return "Gönderilmedi (izin yok)";
    default: return v;
  }
}

// ── Facility reports — V43 ──────────────────────────────────────────────────────

/**
 * ⚠️ `OTHER` is «Diğer», never «Salon».
 *
 * A member who walks through the main gate to use the gym is indistinguishable from one
 * coming to sit in the cafe, so the bucket is honestly named after what is known — that
 * they are in the building — rather than after the most likely guess. `GYM` fills only
 * when a reader is fitted at that door.
 */
export function reportAreaLabel(v: string): string {
  switch (v) {
    case "PADEL": return "Padel";
    case "SPA": return "Spa";
    case "GYM": return "Salon";
    case "OTHER": return "Diğer";
    default: return v;
  }
}

/** "18:00:00" → "18:00". The backend sends İzmir wall-clock with seconds. */
export function shortTime(v: string | null | undefined): string {
  if (!v) return "—";
  return v.slice(0, 5);
}
