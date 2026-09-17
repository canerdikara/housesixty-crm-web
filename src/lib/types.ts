/**
 * Wire types, mirroring the backend DTOs.
 *
 * The enum unions here are a convenience for authoring, not a validation boundary —
 * nothing parses against them at runtime. That is deliberate: the backend can add an
 * enum member (three roles were added in phase 0) and a client that treats an unknown
 * value as a decode failure turns that into a blank screen. Every label function falls
 * back to the raw string instead.
 */

export type LeadStatus = "NEW" | "CONTACTED" | "VISITED" | "PROPOSAL_SENT" | "WON" | "LOST";

export type LeadSource =
  | "WEBSITE_FORM" | "REFERRAL" | "WALK_IN" | "EVENT" | "SOCIAL" | "PARTNER" | "OTHER";

export type InteractionType =
  | "CALL" | "EMAIL" | "WHATSAPP" | "SMS" | "MEETING" | "VISIT" | "NOTE" | "SYSTEM";

export type InterestCategory =
  | "PADEL" | "GYM" | "PILATES" | "SPA" | "WELLNESS" | "EVENTS"
  | "DESIGN" | "ENTREPRENEURSHIP" | "SUSTAINABILITY" | "FNB" | "RETAIL"
  /** "Sosyal ortam" — the club as a place to be among people. Not social *media*. */
  | "SOCIAL_SCENE";

export type ConsentChannel = "EMAIL" | "SMS" | "WHATSAPP" | "PHONE" | "ALL";

export type Paged<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type LeadListItem = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
  interestedIn: InterestCategory | null;
  ownerUserId: string | null;
  ownerName: string | null;
  lastContactAt: string | null;
  nextActionAt: string | null;
  nextActionNote: string | null;
  createdAt: string;
};

export type Interaction = {
  id: string;
  /** The primary channel. Always present. */
  type: InteractionType;
  /**
   * Every channel this interaction used, primary first — one entry for almost every
   * row. Optional because a backend older than V36 does not send it; render it through
   * `interactionTypesLabel`, which falls back to `type`.
   */
  types?: InteractionType[];
  note: string;
  occurredAt: string;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type ConsentRecord = {
  id: string;
  textVersion: string;
  channel: ConsentChannel;
  state: "GRANTED" | "WITHDRAWN";
  recordedAt: string;
};

export type LeadDetail = LeadListItem & {
  /** Derived from `birthDate` when there is one; otherwise whatever the source knew. */
  birthYear: number | null;
  /** Full date of birth, ISO. Null for a lead whose source only asked for a year. */
  birthDate: string | null;
  occupation: string | null;
  company: string | null;
  city: string | null;
  address: string | null;
  /** Everything the lead is interested in, primary first. `interestedIn` is that primary. */
  interests: InterestCategory[];
  /** Only ever set when `source` is REFERRAL — the backend refuses it under any other. */
  referredByName: string | null;
  /** Only ever set when `source` is EVENT. */
  eventName: string | null;
  lostReason: string | null;
  convertedUserId: string | null;
  convertedAt: string | null;
  notes: string | null;
  updatedAt: string;
  interactions: Interaction[];
  consents: ConsentRecord[];
};

export type PipelineStage = {
  status: LeadStatus;
  total: number;
  cards: LeadListItem[];
};

export type Pipeline = {
  stages: PipelineStage[];
  conversionRate: number | null;
};

export type SourceConversion = {
  source: LeadSource;
  total: number;
  won: number;
  rate: number | null;
};


// ── Phase 2: members ───────────────────────────────────────────────────────────

export type MemberListItem = {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  membershipType: string | null;
  membershipStart: string | null;
  membershipEnd: string | null;
  lastVisitAt: string | null;
  visitCount30d: number;
  /** Derived server-side: no turnstile pass in 45 days, or none ever. */
  atRisk: boolean;
};

export type MemberProfile = {
  birthDate: string | null;
  gender: string | null;
  occupation: string | null;
  company: string | null;
  city: string | null;
  instagramHandle: string | null;
  linkedinUrl: string | null;
  padelLevel: string | null;
  preferredChannel: ConsentChannel | null;
  notes: string | null;
};

export type MembershipTerm = {
  id: string;
  membershipType: string;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  renewalStatus: "NOT_CONTACTED" | "CONTACTED" | "PROPOSAL_SENT" | "RENEWED" | "DECLINED";
  renewalNote: string | null;
  lastRenewalContactAt: string | null;
};

export type MonthCount = { month: string; count: number };

export type MemberUsage = {
  lastVisitAt: string | null;
  visitCountTotal: number;
  visitCount30d: number;
  visitCount90d: number;
  visitsByMonth: MonthCount[];
  reservationCount: number;
  tournamentCount: number;
  lessonCount: number;
  guestCount: number;
};

export type MembershipPaymentMethod =
  | "NAKIT" | "KREDI_KARTI_TEK_CEKIM" | "KREDI_KARTI_3_TAKSIT" | "KREDI_KARTI_6_TAKSIT";

/** A membership tier, for the conversion form's «Üyelik Tipi». */
export type MembershipTier = {
  id: string;
  name: string;
};

/**
 * What an admin collected at the desk when the lead became a member (V39).
 *
 * ⚠️ **ADMIN-only.** The backend sends `null` for every other role, and null means
 * "may not see" rather than "there is none" — the same shape as `hasHealthIssues`.
 */
export type MemberOnboarding = {
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactGender: string | null;
  paymentMethod: MembershipPaymentMethod | null;
  /** TC Kimlik or passport number. */
  nationalId: string | null;
  /** Up to two. */
  vehiclePlates: string[];
  /** Whether a contract exists — the link is fetched separately and expires. */
  hasContract: boolean;
  contractFileName: string | null;
  contractUploadedAt: string | null;
};

export type MemberDetail = {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  joinedAt: string;
  /** Null when the viewer is not an ADMIN — "may not see" is distinct from "none". */
  hasHealthIssues: boolean | null;
  membershipType: string | null;
  membershipStart: string | null;
  membershipEnd: string | null;
  atRisk: boolean;
  profile: MemberProfile | null;
  /** Null for every role except ADMIN — "may not see", not "none recorded". */
  onboarding: MemberOnboarding | null;
  interests: { category: InterestCategory; level: number }[];
  preferences: { key: string; value: string }[];
  terms: MembershipTerm[];
  usage: MemberUsage;
  interactions: Interaction[];
  consents: ConsentRecord[];
};

export type RenewalStatus = MembershipTerm["renewalStatus"];

/** One row of the renewals worklist — the term plus who to ring about it. */
export type RenewalListItem = {
  termId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  membershipType: string;
  startDate: string;
  endDate: string;
  /** Server-computed against İzmir's today, so it does not follow the reader's clock. */
  daysUntilEnd: number;
  renewalStatus: RenewalStatus;
  renewalNote: string | null;
  lastRenewalContactAt: string | null;
};

export type RenewalMonth = { month: string; ended: number; renewed: number };

export type RenewalStats = {
  expiringWithin30Days: number;
  expiringWithin90Days: number;
  notContacted: number;
  /** Null when nothing has ended yet — which is not the same as zero percent. */
  renewalRate: number | null;
  byMonth: RenewalMonth[];
  byStatus: Record<string, number>;
};
