import type { Income, IncomeMonth, IncomeTotals } from "@/lib/types";
import styles from "./income.module.css";

/**
 * Money, in Turkish lira, without decimals.
 *
 * ⚠️ Amounts arrive as **strings**, not numbers. `BigDecimal` over JSON is a string
 * precisely so it does not pass through a float on the way — parsing to `Number` here is
 * safe only because this is the last step before rendering and nothing is summed
 * afterwards. Do not add these values in the client; the server already did.
 */
function money(v: string): string {
  const n = Number(v);
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

/**
 * One window's takings.
 *
 * ⚠️ «Tahakkuk eden» and «Tahsil edilen» are shown as two figures and never combined.
 * Booked is what was billed; collected is what reached the bank. Adding them would
 * double-count, and averaging them would describe nothing.
 */
export function TotalsCard({
  title,
  subtitle,
  totals,
  nothingEverCollected,
  unpriced,
}: {
  title: string;
  subtitle: string;
  totals: IncomeTotals;
  /**
   * Whether to explain the ₺0 collected figure.
   *
   * Passed per card rather than read from the payload, so the explanation appears **once**.
   * The same paragraph on both cards is noise the eye learns to skip, which is the opposite
   * of what a warning is for.
   */
  nothingEverCollected: boolean;
  /** Membership sales in this window carrying no amount. Omitted for the "today" card. */
  unpriced?: number;
}) {
  return (
    <div className={styles.headlineCard}>
      <p className={styles.headlineTitle}>{title}</p>
      <p className={styles.headlineSub}>{subtitle}</p>

      <p className={styles.headlineValue}>{money(totals.booked)}</p>
      <p className={styles.headlineLabel}>Tahakkuk eden</p>

      <div className={styles.collected}>
        <span className={styles.collectedValue}>{money(totals.collected)}</span>
        <span className={styles.collectedLabel}>Tahsil edilen</span>
      </div>

      {/*
        An unexplained ₺0 reads as a broken page. It is not: no sanal POS is configured, so
        no payment can ever reach COMPLETED. Same pattern as the dashboard's turnstile note.
      */}
      {nothingEverCollected && (
        <p className={styles.note}>
          ⚠️ Sanal POS tanımlı olmadığı için hiçbir ödeme tahsil edilmiş görünmüyor. Bu
          rakam, banka entegrasyonu yapılana kadar ₺0 kalacaktır.
        </p>
      )}

      {/*
        The blank-versus-zero distinction. Both tiers are priced ₺0, so an unpriced sale is
        the normal state — without this line the membership figure reads as a confident zero
        when it means "nobody has said".
      */}
      {unpriced !== undefined && unpriced > 0 && (
        <p className={styles.note}>
          {unpriced} üyelik satışında tutar girilmemiş — bu satışlar gelire{" "}
          <strong>0 olarak değil, hiç</strong> yazılmaz. Tutarı üyenin 360 ekranındaki
          «Dönem» kaydından girebilirsiniz.
        </p>
      )}

      <dl className={styles.sources}>
        <div>
          <dt>Padel</dt>
          <dd>{money(totals.padel)}</dd>
        </div>
        <div>
          <dt>Spa</dt>
          <dd>{money(totals.spa)}</dd>
        </div>
        <div>
          <dt>Üyelik</dt>
          <dd>{money(totals.membership)}</dd>
        </div>
      </dl>

      <p className={styles.counts}>
        {totals.reservationCount} rezervasyon · {totals.membershipCount} üyelik satışı
      </p>
    </div>
  );
}

/**
 * The monthly trend — stacked bars, CSS only, like every other chart in this panel.
 *
 * Scaled to the tallest month rather than to a round number: the question is which months
 * were better, not what the absolute ceiling is, and a fixed axis wastes most of the height
 * on an empty club.
 */
export function MonthChart({ months }: { months: IncomeMonth[] }) {
  const peak = Math.max(...months.map((m) => Number(m.booked)), 0);

  if (peak === 0) {
    return (
      <p className={styles.empty}>
        Bu dönemde gelir kaydı yok. Kort gelirleri oynanan rezervasyonlardan, üyelik
        gelirleri ise girilen satış tutarlarından hesaplanır.
      </p>
    );
  }

  return (
    <div className={styles.chart}>
      {months.map((m) => {
        const total = Number(m.booked);
        // Percentages of the PEAK for the column height, then of the column for each
        // segment — two different denominators, which is the easy thing to get wrong here.
        const h = (n: string) => (peak === 0 ? 0 : (Number(n) / peak) * 100);
        return (
          <div key={m.month} className={styles.col}>
            <div className={styles.barWrap} title={`${m.month}: ${money(m.booked)}`}>
              {/*
                ⚠️ An empty month gets no track at all, only a baseline rule.

                Drawn as a filled grey column it is indistinguishable from a month that
                earned something — the eye reads the track as the value. A month with no
                income has to LOOK like nothing, or the chart lies about six of its twelve
                columns on a club that has just opened.

                display:block matters too: a <span> ignores height, which is how four funnel
                bars once rendered as overlapping pills invisible to every API assertion.
              */}
              <div className={total > 0 ? styles.barStack : styles.barEmpty}>
                <div className={styles.segPadel} style={{ height: `${h(m.padel)}%` }} />
                <div className={styles.segSpa} style={{ height: `${h(m.spa)}%` }} />
                <div className={styles.segMember} style={{ height: `${h(m.membership)}%` }} />
              </div>
            </div>
            <span className={styles.colLabel}>{m.month.slice(5)}</span>
            <span className={styles.colValue}>{total > 0 ? money(m.booked) : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Where the money came from, as proportional bars. */
export function SourceSplit({ totals }: { totals: IncomeTotals }) {
  const rows = [
    { key: "padel", label: "Padel", value: Number(totals.padel), cls: styles.segPadel },
    { key: "spa", label: "Spa", value: Number(totals.spa), cls: styles.segSpa },
    { key: "membership", label: "Üyelik", value: Number(totals.membership), cls: styles.segMember },
  ];
  const total = rows.reduce((a, r) => a + r.value, 0);

  if (total === 0) {
    return <p className={styles.empty}>Seçilen dönemde gelir kaydı yok.</p>;
  }

  return (
    <ul className={styles.split}>
      {rows.map((r) => (
        <li key={r.key}>
          <div className={styles.splitHead}>
            <span>{r.label}</span>
            <span className="tnum">
              {money(String(r.value))}
              {/* The share, because "₺44,000" means little without "62% of the total". */}
              <span className={styles.splitPct}>
                {Math.round((r.value / total) * 100)}%
              </span>
            </span>
          </div>
          <div className={styles.splitTrack}>
            <div className={r.cls} style={{ width: `${(r.value / total) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export type { Income };
