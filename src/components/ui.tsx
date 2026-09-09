import Link from "next/link";
import styles from "./ui.module.css";

/**
 * Shared presentational primitives.
 *
 * All server components: no state, no handlers, nothing in the client bundle. Screens
 * 3, 6, 8, 11, 13, 15, 16, 17 and 18 are the same object with different columns, so
 * these exist to stop nine screens drifting apart a few pixels at a time.
 */

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "good" | "crit";
  children: React.ReactNode;
}) {
  const cls = {
    neutral: styles.badgeNeutral,
    accent: styles.badgeAccent,
    good: styles.badgeGood,
    crit: styles.badgeCrit,
  }[tone];
  return <span className={`${styles.badge} ${cls}`}>{children}</span>;
}

export function Tag({ muted, children }: { muted?: boolean; children: React.ReactNode }) {
  return <span className={`${styles.tag} ${muted ? styles.tagMuted : ""}`}>{children}</span>;
}

/**
 * Owner avatar. An empty dashed circle for an unassigned lead.
 *
 * The dash matters: a *filled* neutral circle reads as "someone", and an unowned lead
 * is the thing a sales manager is scanning the list for.
 */
export function Avatar({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span className={`${styles.avatar} ${styles.avatarEmpty}`} title="Sorumlu atanmadı" aria-label="Sorumlu atanmadı">
        —
      </span>
    );
  }
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length === 1
      ? parts[0]!.slice(0, 2).toLocaleUpperCase("tr-TR")
      : (parts[0]![0]! + parts[parts.length - 1]![0]!).toLocaleUpperCase("tr-TR");
  return (
    <span className={styles.avatar} title={name} aria-label={name}>
      {initials}
    </span>
  );
}

/** A saved-filter chip. `count` is omitted rather than shown as 0 when unknown. */
export function FilterChip({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active?: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${styles.chip} ${active ? styles.chipActive : ""}`}
      aria-current={active ? "true" : undefined}
    >
      {children}
      {count !== undefined && <span className={styles.chipCount}>{count}</span>}
    </Link>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className={styles.chipRow}>{children}</div>;
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className={styles.tableWrap}>{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      {children && <p className={styles.emptyText}>{children}</p>}
    </div>
  );
}

/**
 * Pagination.
 *
 * Renders a window around the current page rather than every page number — 63 leads is
 * three pages, but a year of them is not, and a footer that grows without bound is a
 * layout bug waiting to happen.
 *
 * Pages are links, not buttons: the current page lives in the URL, so a row can be
 * opened in a new tab and a filtered view can be sent to a colleague.
 */
export function Pagination({
  page,
  totalPages,
  totalElements,
  size,
  hrefFor,
  noun = "kayıt",
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  size: number;
  hrefFor: (page: number) => string;
  /**
   * What is being counted, in the genitive: "63 adayın 1–18 arası".
   *
   * Parameterised because this was hardcoded to "adayın" and the members screen reads
   * "428 adayın" for a list of members — the kind of wrong that survives because it is
   * grammatical and nobody reads the footer twice.
   */
  noun?: string;
}) {
  const from = totalElements === 0 ? 0 : page * size + 1;
  const to = Math.min((page + 1) * size, totalElements);

  const window = 2;
  const first = Math.max(0, Math.min(page - window, totalPages - window * 2 - 1));
  const last = Math.min(totalPages - 1, Math.max(page + window, window * 2));
  const pages: number[] = [];
  for (let p = Math.max(0, first); p <= last; p++) pages.push(p);

  return (
    <div className={styles.tableFooter}>
      <span>
        {totalElements === 0
          ? "Kayıt yok"
          : `${totalElements} ${noun} ${from}–${to} arası`}
      </span>

      {totalPages > 1 && (
        <nav className={styles.pager} aria-label="Sayfalama">
          <Link
            href={hrefFor(page - 1)}
            className={`${styles.pageLink} ${page === 0 ? styles.pageDisabled : ""}`}
            aria-label="Önceki sayfa"
            aria-disabled={page === 0}
          >
            ‹
          </Link>
          {pages.map((p) => (
            <Link
              key={p}
              href={hrefFor(p)}
              className={`${styles.pageLink} ${p === page ? styles.pageCurrent : ""}`}
              aria-current={p === page ? "page" : undefined}
            >
              {p + 1}
            </Link>
          ))}
          <Link
            href={hrefFor(page + 1)}
            className={`${styles.pageLink} ${page >= totalPages - 1 ? styles.pageDisabled : ""}`}
            aria-label="Sonraki sayfa"
            aria-disabled={page >= totalPages - 1}
          >
            ›
          </Link>
        </nav>
      )}
    </div>
  );
}

export { styles as ui };
