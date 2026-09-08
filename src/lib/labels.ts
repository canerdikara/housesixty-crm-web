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

import type { LeadSource, LeadStatus, InteractionType, InterestCategory, ConsentChannel } from "./types";

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

export const INTEREST_CATEGORIES: InterestCategory[] = [
  "PADEL", "GYM", "PILATES", "SPA", "WELLNESS", "EVENTS",
  "DESIGN", "ENTREPRENEURSHIP", "SUSTAINABILITY", "FNB", "RETAIL",
];

export const INTERACTION_TYPES: InteractionType[] = [
  "CALL", "WHATSAPP", "EMAIL", "SMS", "MEETING", "VISIT", "NOTE",
];

export const CONSENT_CHANNELS: ConsentChannel[] = ["EMAIL", "SMS", "WHATSAPP", "PHONE", "ALL"];
