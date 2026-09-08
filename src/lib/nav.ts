import { ROLE } from "./roles";

/**
 * The sidebar.
 *
 * Order is fixed by CRM.md §7.1 and matches the mockups. It is grouped by how the work
 * actually flows — acquisition (Adaylar), the relationship (Üyeler, Yenilemeler),
 * outreach (Segmentler, Kampanyalar, Etkinlikler, Partnerler), then listening
 * (Geri Bildirim) and configuration (Ayarlar). Do not re-sort it alphabetically.
 *
 * ## Roles
 *
 * `roles` lists who sees the entry at all, taken from the permission matrix in §6.
 * A dash in that table means the area is hidden here entirely; "read" still shows the
 * entry, because being able to look at campaigns is a real level of access.
 *
 * **This is presentation, not enforcement.** The backend role-gates every
 * `/api/v1/crm/**` endpoint, and that is the control. Hiding a link only spares
 * someone a screen full of permission errors — a hand-edited cookie changes what is
 * drawn and nothing about what can be read.
 */

export type NavItem = {
  href: string;
  label: string;
  roles: readonly string[];
};

const ALL = [ROLE.ADMIN, ROLE.SALES, ROLE.MARKETING, ROLE.RECEPTION] as const;

export const NAV: readonly NavItem[] = [
  // Not in the §6 matrix. The dashboard aggregates across areas, so the backend
  // decides what each role's payload contains rather than the whole page being
  // withheld — everyone has *a* landing screen.
  { href: "/", label: "Genel Bakış", roles: ALL },

  { href: "/leads", label: "Adaylar", roles: ALL },
  { href: "/members", label: "Üyeler", roles: ALL },

  // Membership terms: reception has no access at all.
  { href: "/renewals", label: "Yenilemeler", roles: [ROLE.ADMIN, ROLE.SALES, ROLE.MARKETING] },

  { href: "/segments", label: "Segmentler", roles: [ROLE.ADMIN, ROLE.SALES, ROLE.MARKETING] },
  { href: "/campaigns", label: "Kampanyalar", roles: [ROLE.ADMIN, ROLE.SALES, ROLE.MARKETING] },
  { href: "/events", label: "Etkinlikler", roles: ALL },
  { href: "/partners", label: "Partnerler", roles: [ROLE.ADMIN, ROLE.SALES, ROLE.MARKETING] },

  // Reception is "create" in the matrix — they log a member's complaint at the desk.
  { href: "/feedback", label: "Geri Bildirim", roles: ALL },

  { href: "/settings", label: "Ayarlar", roles: [ROLE.ADMIN] },
];

/**
 * Warehouse — **separate scope**, off by default.
 *
 * Designed and mocked at the customer's request (screen 18) but priced and scheduled
 * outside the five phases, and §13 lists five questions that have to be answered
 * before it can be built at all. It is a nav entry rather than a phase, so it lives
 * behind a flag: `CRM_FEATURE_WAREHOUSE=true` slots it in after Yenilemeler, which is
 * where screen 18 draws it.
 *
 * Every other mockup shows a ten-item sidebar without it. Off is the faithful default.
 */
export const WAREHOUSE_ITEM: NavItem = {
  href: "/inventory",
  label: "Depo ve Stok",
  roles: [ROLE.ADMIN],
};

const WAREHOUSE_AFTER = "/renewals";

/** The entries this role should see, in order. */
export function navFor(role: string, warehouseEnabled: boolean): NavItem[] {
  const items = warehouseEnabled
    ? NAV.flatMap((item) =>
        item.href === WAREHOUSE_AFTER ? [item, WAREHOUSE_ITEM] : [item]
      )
    : [...NAV];

  return items.filter((item) => item.roles.includes(role));
}

/**
 * Which entry a URL belongs to.
 *
 * Longest match wins, so `/leads/pipeline` and `/leads/abc-123` both light up
 * "Adaylar". `/` is special-cased: every path starts with it, so a prefix test would
 * mark the dashboard active on every screen in the panel.
 */
export function activeHref(pathname: string, items: NavItem[]): string | null {
  if (pathname === "/") return "/";
  let best: string | null = null;
  for (const item of items) {
    if (item.href === "/") continue;
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (!best || item.href.length > best.length) best = item.href;
    }
  }
  return best;
}
