/**
 * Panel roles and what they may see.
 *
 * The permission matrix in CRM.md §6 is enforced **on the backend**, at the endpoint.
 * Everything here is presentation only: which sidebar entries to draw, which buttons
 * to grey out. A client-side check is a courtesy to the user, never a control — the
 * panel must stay correct if someone edits their own cookie, and it does, because the
 * API refuses them.
 */

export const ROLE = {
  ADMIN: "ADMIN",
  SALES: "SALES",
  MARKETING: "MARKETING",
  RECEPTION: "RECEPTION",
} as const;

export type PanelRole = (typeof ROLE)[keyof typeof ROLE];

/** Roles that may sign in to the panel at all. */
export const PANEL_ROLES: readonly string[] = [
  ROLE.ADMIN,
  ROLE.SALES,
  ROLE.MARKETING,
  ROLE.RECEPTION,
];

/**
 * Whether this role may open the panel.
 *
 * MEMBER, GUEST and TRAINER are rejected at login with a message rather than being
 * let in to a panel where every request 403s. TRAINER especially: a trainer is staff
 * and has real credentials on this backend, so without this check they would sign in
 * successfully and then find nothing works.
 */
export function canAccessPanel(role: string | undefined | null): boolean {
  return !!role && PANEL_ROLES.includes(role);
}

/**
 * Turkish display name for any backend role.
 *
 * The three non-panel roles are here deliberately, even though they can never own a
 * panel session. The login screen names the role when it turns someone away — "Bu
 * hesabın CRM paneline erişimi yok (Üye)" — and that is exactly the case where the
 * role being shown is one the panel does not otherwise handle. Without them the
 * message reads "(MEMBER)": an English enum constant in the middle of a Turkish
 * sentence, shown to the one person who most needs to understand it.
 *
 * The wording matches `roleLabel` in the native apps, which resolve the same
 * `role_member` / `role_admin` / `role_trainer` / `role_guest` keys. Keep them in step.
 *
 * A genuinely unknown role still renders as-is rather than blank — a new backend role
 * should look unfamiliar, not invisible.
 */
export function roleLabel(role: string): string {
  switch (role) {
    case ROLE.ADMIN:
      return "Yönetici";
    case ROLE.SALES:
      return "Satış";
    case ROLE.MARKETING:
      return "Pazarlama";
    case ROLE.RECEPTION:
      return "Resepsiyon";
    case "MEMBER":
      return "Üye";
    case "TRAINER":
      return "Antrenör";
    case "GUEST":
      return "Misafir";
    default:
      return role;
  }
}

/** Initials for the sidebar avatar. "Can Erdi Kara" → "CK". */
export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toLocaleUpperCase("tr-TR");
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toLocaleUpperCase("tr-TR");
}
