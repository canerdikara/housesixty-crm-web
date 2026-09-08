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
  | "DESIGN" | "ENTREPRENEURSHIP" | "SUSTAINABILITY" | "FNB" | "RETAIL";

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
  type: InteractionType;
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
  birthYear: number | null;
  occupation: string | null;
  company: string | null;
  city: string | null;
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
