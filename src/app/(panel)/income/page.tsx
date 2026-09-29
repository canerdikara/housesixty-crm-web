import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Calendar } from "@/components/Calendar";
import { EmptyState, FilterChip, ChipRow, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDate, izmirToday } from "@/lib/dates";
import type { Income } from "@/lib/types";
import { MonthChart, SourceSplit, TotalsCard } from "./IncomeParts";
import styles from "./income.module.css";

export const metadata = { title: "Gelirler · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * «Gelirler» — what the club earned. New scope: no mockup, not in `CRM.md`.
 *
 * ## ⚠️ Two numbers, never one
 *
 * «Tahakkuk eden» is what was **billed** — courts played and memberships sold. «Tahsil
 * edilen» is what reached the **bank**. They are never added or averaged, the same rule the
 * facility reports follow for booked-versus-turnstile, because the gap is the useful part.
 *
 * Collected is **₺0 on production and stays ₺0** until a sanal POS is configured. Rather
 * than render an unexplained zero, the page says so — the pattern the dashboard uses for
 * `turnstileEntriesEver`.
 *
 * ## The two bases, stated on the page rather than assumed
 *
 * Courts count on the day they were **played**; memberships on the day they were **sold**,
 * with the whole amount in that month. Both are choices, and a reader comparing this screen
 * against a bank statement needs to know which was made.
 */
export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; pick?: string }>;
}) {
  const params = await searchParams;
  const today = izmirToday();
  const iso = (v: string | undefined) => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? "") ? v! : undefined);

  // Defaults to this month so far — the question somebody opening an income page is
  // usually asking.
  const from = iso(params.from) ?? today.slice(0, 8) + "01";
  const to = iso(params.to) ?? today;

  /*
   * Which end of the range the month grid is setting.
   *
   * One calendar rather than two: two month grids side by side at 340px is unreadable, and
   * the desk is picking one end at a time anyway. The chosen end lives in the URL like
   * every other filter, so a particular range stays bookmarkable and sendable.
   */
  const pick = params.pick === "to" ? "to" : "from";

  const result = await apiRequest<Income>(
    `/api/v1/crm/income?from=${from}&to=${to}`
  );
  if (result.kind === "unauthorized") redirect("/login");

  const rangeHref = (next: { from?: string; to?: string; pick?: string }) => {
    const q = new URLSearchParams({
      from: next.from ?? from,
      to: next.to ?? to,
      pick: next.pick ?? pick,
    });
    return `/income?${q}`;
  };

  /** The shortcuts a club actually asks for, rather than a free-form range every time. */
  const PRESETS = [
    { label: "Bu ay", from: today.slice(0, 8) + "01", to: today },
    { label: "Son 30 gün", from: shiftDays(today, -29), to: today },
    { label: "Bu yıl", from: today.slice(0, 4) + "-01-01", to: today },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Gelirler"
        subtitle={
          result.kind === "ok"
            ? `${formatDate(result.data.from)} – ${formatDate(result.data.to)}`
            : "Gelir raporu"
        }
      />

      {result.kind === "forbidden" ? (
        <Card>
          <EmptyState title="Bu ekranı görüntüleme yetkiniz yok">
            {/* ADMIN-only, and narrower than anything else in the panel — worth saying
                plainly rather than leaving somebody to wonder if it is broken. */}
            Gelir raporu yalnızca yöneticilere açıktır. {result.message}
          </EmptyState>
        </Card>
      ) : result.kind === "error" ? (
        <Card>
          <EmptyState title="Rapor yüklenemedi">{result.message}</EmptyState>
        </Card>
      ) : (
        <>
          {/*
            The landing summary: today first, then the selected range. Today is deliberately
            independent of the range — it is what somebody opening the page wants, and a
            range that excludes today must not blank it.
          */}
          <div className={styles.headline}>
            <TotalsCard
              title="Bugün"
              subtitle={formatDate(today)}
              totals={result.data.today}
              /* Explained once, on the period card below — the same paragraph twice is
                 noise the eye learns to skip. */
              nothingEverCollected={false}
            />
            <TotalsCard
              title="Seçilen dönem"
              subtitle={`${formatDate(result.data.from)} – ${formatDate(result.data.to)}`}
              totals={result.data.period}
              nothingEverCollected={result.data.nothingEverCollected}
              unpriced={result.data.unpricedMembershipSales}
            />
          </div>

          <div className={styles.layout}>
            <div className={styles.main}>
              <Card>
                <h2 className={styles.cardTitle}>Aylara göre</h2>
                <p className={styles.cardSub}>
                  Kortlar oynandığı güne, üyelikler satıldığı güne yazılır
                </p>
                <MonthChart months={result.data.months} />
              </Card>

              <Card>
                <h2 className={styles.cardTitle}>Kaynağa göre</h2>
                <p className={styles.cardSub}>Seçilen dönem</p>
                <SourceSplit totals={result.data.period} />
              </Card>
            </div>

            <Card>
              <ChipRow>
                {PRESETS.map((p) => (
                  <FilterChip
                    key={p.label}
                    href={rangeHref({ from: p.from, to: p.to })}
                    active={from === p.from && to === p.to}
                  >
                    {p.label}
                  </FilterChip>
                ))}
              </ChipRow>

              {/* Which end the grid below is setting. Two grids would not fit; one grid
                  with a visible target is honest about what a click will do. */}
              <div className={styles.pickRow}>
                <Link
                  href={rangeHref({ pick: "from" })}
                  className={`${styles.pickBtn} ${pick === "from" ? styles.pickOn : ""}`}
                >
                  Başlangıç
                  <strong>{formatDate(from)}</strong>
                </Link>
                <Link
                  href={rangeHref({ pick: "to" })}
                  className={`${styles.pickBtn} ${pick === "to" ? styles.pickOn : ""}`}
                >
                  Bitiş
                  <strong>{formatDate(to)}</strong>
                </Link>
              </div>

              <Calendar
                selected={pick === "from" ? from : to}
                today={today}
                hrefFor={(d) => rangeHref(pick === "from" ? { from: d } : { to: d })}
                /* No future income exists, so no future day is selectable. An inverted
                   range is swapped by the backend rather than refused. */
                maxDate={today}
              />
            </Card>
          </div>
        </>
      )}
    </PageBody>
  );
}

/** Plain `YYYY-MM-DD` arithmetic on UTC midnights — never the viewer's zone. */
function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}
