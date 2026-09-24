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


// ── Dashboard — «Genel Bakış», mockup screen 2 ──────────────────────────────────

export type DashboardSummary = {
  /** Holding a live membership. */
  activeMembers: number;
  /** Every member account. Differs from `activeMembers` once a term lapses. */
  totalMembers: number;
  membersJoinedThisMonth: number;
  newLeads: number;
  newLeadsPreviousPeriod: number;
  /**
   * All time, not the selected window — see the backend DTO. Null on zero leads, which
   * is not a nought-percent conversion rate.
   */
  conversionRate: number | null;
  convertedLeads: number;
  totalLeads: number;
  /** Null for RECEPTION, which §6 gives no access to membership terms — not zero. */
  renewalsDue30Days: number | null;
};

export type FacilityUsageMonth = {
  /** `"2026-09"`. */
  month: string;
  /** `FacilityType` name to reservation count. Every type present, zeroes included. */
  counts: Record<string, number>;
  total: number;
};

export type AtRiskMember = {
  userId: string;
  fullName: string;
  phone: string | null;
  lastVisitAt: string | null;
  /** Null when they have never visited — the worse case, not a missing value. */
  daysSinceLastVisit: number | null;
  membershipEnd: string | null;
};

export type Dashboard = {
  generatedAt: string;
  periodDays: number;
  summary: DashboardSummary;
  /** Series order for `facilityUsage`, from the backend's own enum. */
  facilityTypes: string[];
  facilityUsage: FacilityUsageMonth[];
  turnstileEntriesInPeriod: number;
  /**
   * Passes ever recorded. Zero means the at-risk list flags everyone by definition and
   * says nothing — the screen explains that rather than drawing a list of red rows.
   */
  turnstileEntriesEver: number;
  leadSources: SourceConversion[];
  activeMembersByMonth: MonthCount[];
  atRisk: AtRiskMember[];
  atRiskTotal: number;
};


// ── Segments — V41, mockup screens 9 and 10 ─────────────────────────────────────

export type SegmentRule = { field: string; op: string; value: string };

export type SegmentListItem = {
  id: string;
  name: string;
  description: string | null;
  isDynamic: boolean;
  rules: SegmentRule[];
  /** Null until it has been run once — which is not the same as a count of zero. */
  lastRunAt: string | null;
  lastCount: number | null;
  createdByName: string | null;
  createdAt: string;
};

export type SegmentList = {
  segments: SegmentListItem[];
  /** Every active member, so a segment's size can be read as a share of the club. */
  totalMembers: number;
};

export type SegmentMemberItem = {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  membershipType: string | null;
  membershipEnd: string | null;
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
};

export type SegmentPreview = {
  matched: number;
  totalMembers: number;
  /** Null on an empty club, never 0. */
  share: number | null;
  /** Tier name to count; `""` is the no-membership column. */
  byMembershipType: Record<string, number>;
  sample: SegmentMemberItem[];
};

export type SegmentDetail = {
  segment: SegmentListItem;
  preview: SegmentPreview;
};

/**
 * One field the builder may offer.
 *
 * Served by the backend rather than listed here, so the builder and the whitelist in
 * `SegmentQueryBuilder` cannot drift: a field added there appears in the builder with no
 * change to this repo, and a field invented here is refused.
 */
export type SegmentField = {
  field: string;
  /** `NUMBER` — a number box. `CHOICE` / `SET` — a select over `values`. */
  kind: "NUMBER" | "CHOICE" | "SET";
  operators: string[];
  values: string[] | null;
};

// ── Campaigns — V42, mockup screens 11 and 12 ───────────────────────────────────

export type CampaignChannel = "EMAIL" | "WHATSAPP" | "SMS" | "PUSH";

export type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "SENDING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type DeliveryState =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "OPENED"
  | "CLICKED"
  | "BOUNCED"
  | "FAILED"
  | "SUPPRESSED";

export type CampaignListItem = {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  segmentId: string | null;
  segmentName: string | null;
  subject: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  /**
   * Rows actually written — 0 for a draft, and **not** a live segment count.
   *
   * The mockup shows a number beside a draft too; that would have to be a preview that
   * changes under the reader between visits, which is not what the column means beside a
   * sent campaign. Drafts render an em dash.
   */
  recipientCount: number;
  openedCount: number;
  clickedCount: number;
  createdByName: string | null;
  createdAt: string;
};

/** The four tiles above the list, over a fixed window. */
export type CampaignStats = {
  sentCampaigns: number;
  /** Deduplicated across campaigns — one member emailed three times is one. */
  membersReached: number;
  /** Null when nothing was delivered, never 0. */
  openRate: number | null;
  clickRate: number | null;
  windowDays: number;
};

export type CampaignList = {
  content: CampaignListItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  stats: CampaignStats;
};

/**
 * The funnel on the result screen. Nests by construction — everyone who clicked also
 * opened. `suppressed` sits outside it: those were never sent.
 */
export type CampaignFunnel = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  suppressed: number;
  deliveryRate: number | null;
  openRate: number | null;
  clickRate: number | null;
};

export type CampaignRecipient = {
  id: string;
  userId: string | null;
  leadId: string | null;
  fullName: string | null;
  /** The address at send time, not the member's current one. */
  address: string;
  state: DeliveryState;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  failureReason: string | null;
};

export type CampaignDetail = {
  campaign: CampaignListItem;
  body: string | null;
  funnel: CampaignFunnel;
  recipients: CampaignRecipient[];
  /** The live segment count, and only while the campaign can still be sent. */
  audiencePreview: number | null;
  /** Null when it can be sent; otherwise why not, in Turkish. */
  sendBlockedReason: string | null;
};

// ── Facility reports — «Anlık rapor» and «Günlük rapor» (V43) ───────────────────

/** `PADEL` · `SPA` · `GYM` · `OTHER`. */
export type ReportArea = "PADEL" | "SPA" | "GYM" | "OTHER";

/**
 * One person in the building, or expected in it.
 *
 * `booked` and `checkedIn` are **independent flags, not a status** — all four
 * combinations mean something the club acts on differently, and the two that matter most
 * are booked-and-not-arrived (a no-show) and arrived-with-nothing-booked (a walk-in).
 */
export type ReportPerson = {
  userId: string;
  fullName: string;
  role: string;
  area: ReportArea;
  booked: boolean;
  checkedIn: boolean;
  bookings: string[];
  /** İzmir wall-clock `HH:mm:ss`. Null when they have nothing booked. */
  slotStart: string | null;
  slotEnd: string | null;
  /** Real instants. Null until the turnstile records them. */
  enteredAt: string | null;
  leftAt: string | null;
};

export type ReportAreaCount = {
  area: ReportArea;
  booked: number;
  checkedIn: number;
  /** Distinct people, so somebody both booked and checked in counts once. */
  total: number;
};

export type ReportHour = { hour: number; entries: number };

export type LiveReport = {
  asOf: string;
  date: string;
  bookedTotal: number;
  checkedInTotal: number;
  areas: ReportAreaCount[];
  people: ReportPerson[];
  /** False until the turnstile has ever recorded a pass — on production, it has not. */
  turnstileEverUsed: boolean;
};

export type DailyReport = {
  date: string;
  bookedTotal: number;
  checkedInTotal: number;
  noShowTotal: number;
  walkInTotal: number;
  areas: ReportAreaCount[];
  hours: ReportHour[];
  people: ReportPerson[];
  turnstileEverUsed: boolean;
};
