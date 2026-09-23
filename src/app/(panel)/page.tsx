import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState, FilterChip, ChipRow } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import {
  facilityTypeColor,
  facilityTypeLabel,
  leadSourceLabel,
  monthShortLabel,
} from "@/lib/labels";
import { readSession } from "@/lib/session";
import type { Dashboard } from "@/lib/types";
import styles from "./dashboard.module.css";

export const metadata = { title: "Genel Bakış · House Sixty CRM" };
export const dynamic = "force-dynamic";

/** The window the lead figures cover. Mirrors the backend's own cap of 1–365. */
const PERIODS = [7, 30, 90] as const;
const DEFAULT_PERIOD = 30;

/**
 * «Genel Bakış» — mockup screen 2.
 *
 * One call to `GET /crm/dashboard`, which assembles all six blocks: the four tiles,
 * facility usage, lead sources, active members over twelve months and the at-risk
 * table. Drawing them from one payload is deliberate — the blocks qualify each other,
 * and the at-risk table in particular is meaningless without the turnstile count beside
 * it, which is the first thing a fan-out of six requests would let drift apart.
 *
 * Every chart here is CSS and inline SVG. The panel has no client-side dependencies and
 * every screen is a server component; a library would be the first exception to both for
 * six bars and a twelve-point line. Hover tooltips are `<title>` elements, which the
 * browser renders natively and which screen readers announce — §7.4 asks for hover on
 * every chart and this is the version of it that costs nothing.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const requested = Number(params.days);
  const days = PERIODS.includes(requested as (typeof PERIODS)[number])
    ? requested
    : DEFAULT_PERIOD;

  const result = await apiRequest<Dashboard>(`/api/v1/crm/dashboard?days=${days}`);
  // Refused despite middleware having just ensured a fresh token: revoked, or the
  // account is gone. Anything else is reported in place — an unreachable backend must
  // not look like being signed out.
  if (result.kind === "unauthorized") redirect("/login");

  const periodChips = (
    <ChipRow>
      {PERIODS.map((p) => (
        <FilterChip key={p} href={p === DEFAULT_PERIOD ? "/" : `/?days=${p}`} active={p === days}>
          Son {p} gün
        </FilterChip>
      ))}
    </ChipRow>
  );

  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Genel Bakış" subtitle={`Hoş geldiniz, ${firstName(session.user.fullName)}`} />
        <Card>
          <EmptyState
            title={
              result.kind === "forbidden"
                ? "Bu ekranı görüntüleme yetkiniz yok"
                : "Gösterge paneli yüklenemedi"
            }
          >
            {result.message}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const d = result.data;
  const s = d.summary;

  return (
    <PageBody>
      <PageHeader
        title="Genel Bakış"
        subtitle={`Hoş geldiniz, ${firstName(session.user.fullName)} · son ${days} gün`}
        actions={periodChips}
      />

      {/* ── The four tiles ───────────────────────────────────────────────────── */}
      <div className={styles.tiles}>
        <Tile
          label="Aktif üye"
          value={s.activeMembers}
          note={
            // Two numbers that differ have to say why, or the smaller one reads as an
            // error. A member whose term lapsed is still on the Üyeler list.
            s.totalMembers === s.activeMembers
              ? plusNote(s.membersJoinedThisMonth, "bu ay")
              : `${s.totalMembers} kayıtlı üyeden`
          }
          tone={s.totalMembers === s.activeMembers && s.membersJoinedThisMonth > 0 ? "good" : "muted"}
        />

        <Tile
          label={`Yeni aday · ${days} gün`}
          value={s.newLeads}
          note={deltaNote(s.newLeads, s.newLeadsPreviousPeriod)}
          tone={s.newLeads > s.newLeadsPreviousPeriod ? "good" : "muted"}
        />

        <Tile
          label="Aday → üye dönüşümü"
          // Null is "no leads yet", not nought percent — it must not render as %0.
          value={s.conversionRate === null ? "—" : `%${s.conversionRate}`}
          note={
            s.conversionRate === null
              ? "henüz aday yok"
              : `${s.convertedLeads}/${s.totalLeads} aday · tüm zamanlar`
          }
          tone="muted"
        />

        <Tile
          label="Yenilemesi yaklaşan"
          // Null means "your role may not see this", which is not zero and must not be
          // drawn as a calm, reassuring nought.
          value={s.renewalsDue30Days === null ? "—" : s.renewalsDue30Days}
          note={s.renewalsDue30Days === null ? "bu alana erişiminiz yok" : "30 gün içinde"}
          tone={s.renewalsDue30Days ? "warn" : "muted"}
        />
      </div>

      {/* ── Facility usage · lead sources ────────────────────────────────────── */}
      <div className={styles.rowWide}>
        <Card>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Tesis kullanımı</h2>
              <p className={styles.cardSub}>Aylık rezervasyon sayısı · son 6 ay</p>
            </div>
            <div className={styles.legend}>
              {d.facilityTypes.map((t) => (
                <span key={t} className={styles.legendItem}>
                  <span
                    className={styles.swatch}
                    style={{ background: facilityTypeColor(t) }}
                    aria-hidden="true"
                  />
                  {facilityTypeLabel(t)}
                </span>
              ))}
            </div>
          </div>
          <FacilityChart data={d} />
          <p className={styles.footNote}>
            Rezervasyonlar oynanan güne göre sayılır; iptal ve gelmedi hariç. Turnike
            girişleri ayrı ölçülür — son {days} günde{" "}
            <strong>{d.turnstileEntriesInPeriod}</strong> giriş.
          </p>
        </Card>

        <Card>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Aday kaynakları</h2>
              <p className={styles.cardSub}>
                Son {days} gün · {d.leadSources.reduce((n, x) => n + x.total, 0)} aday
              </p>
            </div>
          </div>
          {d.leadSources.length === 0 ? (
            <EmptyState title="Bu dönemde yeni aday yok">
              Kaynak dağılımı ilk başvuruyla birlikte görünecek.
            </EmptyState>
          ) : (
            <SourceBars data={d} />
          )}
        </Card>
      </div>

      {/* ── Active members · at risk ─────────────────────────────────────────── */}
      <div className={styles.rowEven}>
        <Card>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Aktif üye sayısı</h2>
              <p className={styles.cardSub}>Son 12 ay · ay sonu itibarıyla</p>
            </div>
          </div>
          <MembersLine data={d} />
        </Card>

        <Card>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Risk altındaki üyeler</h2>
              <p className={styles.cardSub}>45 günden uzun süredir ziyaret yok</p>
            </div>
            {d.turnstileEntriesEver > 0 && d.atRiskTotal > 0 && (
              <span className={styles.riskCount}>{d.atRiskTotal} üye</span>
            )}
          </div>
          <AtRiskTable data={d} />
        </Card>
      </div>
    </PageBody>
  );
}

// ── Tiles ────────────────────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number | string;
  note: string;
  tone: "good" | "warn" | "crit" | "muted";
}) {
  const noteClass = {
    good: styles.tileNoteGood,
    warn: styles.tileNoteWarn,
    crit: styles.tileNoteCrit,
    muted: "",
  }[tone];
  return (
    <div className={styles.tile}>
      <p className={styles.tileLabel}>{label}</p>
      <p className={styles.tileValue}>{value}</p>
      <p className={`${styles.tileNote} ${noteClass}`}>{note}</p>
    </div>
  );
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

function plusNote(n: number, suffix: string): string {
  return n > 0 ? `+${n} ${suffix}` : `${suffix} yeni üye yok`;
}

/**
 * "+9 geçen döneme göre".
 *
 * An empty previous window is called out as such rather than shown as a percentage or
 * a "+100%": everything is an increase on nothing, and saying so is not information.
 */
function deltaNote(now: number, previous: number): string {
  const diff = now - previous;
  if (previous === 0) return now === 0 ? "önceki dönemde de yok" : "önceki dönemde aday yok";
  if (diff === 0) return "geçen dönemle aynı";
  return `${diff > 0 ? "+" : "−"}${Math.abs(diff)} geçen döneme göre`;
}

// ── Facility usage ───────────────────────────────────────────────────────────────

/**
 * Stacked bars, one per month.
 *
 * The y-axis is scaled to a rounded ceiling above the tallest month rather than to the
 * tallest month itself, so the top bar does not touch the frame and the gridline
 * labels are numbers a person would say out loud.
 */
function FacilityChart({ data }: { data: Dashboard }) {
  const max = data.facilityUsage.reduce((m, x) => Math.max(m, x.total), 0);
  const ceiling = niceCeiling(max);
  // Four bands, so the axis reads 0 / ¼ / ½ / ¾ / top.
  const ticks = [4, 3, 2, 1, 0].map((i) => Math.round((ceiling / 4) * i));

  return (
    <div className={styles.chart}>
      <div className={styles.yAxis} aria-hidden="true">
        {ticks.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>

      <div className={styles.plot}>
        <div className={styles.bars}>
          {ticks.map((_, i) => (
            <span
              key={i}
              className={styles.gridline}
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              aria-hidden="true"
            />
          ))}

          {data.facilityUsage.map((m) => {
            // Drawn bottom-up in series order, so the last type in the list is the one
            // that gets the rounded top — and the order never depends on the values.
            const series = [...data.facilityTypes]
              .map((t) => ({ type: t, count: m.counts[t] ?? 0 }))
              .filter((x) => x.count > 0);
            return (
              <div key={m.month} className={styles.barCol}>
                {m.total === 0 ? (
                  <span className={styles.zeroMark} title={`${monthShortLabel(m.month)}: 0`} />
                ) : (
                  <div className={styles.stack} style={{ height: `${(m.total / ceiling) * 100}%` }}>
                    {series.map((x, i) => (
                      <span
                        key={x.type}
                        className={`${styles.seg} ${i === 0 ? styles.segTop : ""}`}
                        style={{
                          height: `${(x.count / m.total) * 100}%`,
                          background: facilityTypeColor(x.type),
                        }}
                        title={`${monthShortLabel(m.month)} · ${facilityTypeLabel(x.type)}: ${x.count}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className={styles.months}>
          {data.facilityUsage.map((m) => (
            <span key={m.month} className={styles.monthLabel}>
              {monthShortLabel(m.month)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A ceiling whose quarters are whole, round numbers: 15 → 16, 137 → 160, 0 → 4.
 *
 * The axis is drawn in four bands, so a ceiling picked only for being above the tallest
 * bar gives labels like 15 / 11 / 8 / 4 — arithmetically correct and unreadable. The
 * step is chosen from 1 / 2 / 2.5 / 5 / 10 at the right magnitude and multiplied by
 * four, which is how the labels end up being numbers a person would say out loud.
 */
function niceCeiling(max: number): number {
  // Four bands need four whole labels, and below this the rounding has nothing to work
  // with — 1 would give an axis reading 1 / 1 / 1 / 0 / 0.
  if (max <= 4) return 4;
  const quarter = max / 4;
  const unit = Math.pow(10, Math.floor(Math.log10(quarter)));
  return Math.ceil(quarter / unit) * unit * 4;
}

// ── Lead sources ─────────────────────────────────────────────────────────────────

function SourceBars({ data }: { data: Dashboard }) {
  const max = data.leadSources.reduce((m, x) => Math.max(m, x.total), 0);
  return (
    <div className={styles.sources}>
      {data.leadSources.map((s) => (
        <div key={s.source} className={styles.sourceRow}>
          <span className={styles.sourceName}>{leadSourceLabel(s.source)}</span>
          <span className={styles.sourceTrack}>
            <span
              className={styles.sourceFill}
              style={{ width: max === 0 ? "0%" : `${(s.total / max) * 100}%` }}
              title={`${leadSourceLabel(s.source)}: ${s.total} aday`}
            />
          </span>
          <span className={styles.sourceValue}>{s.total}</span>
        </div>
      ))}
    </div>
  );
}

// ── Active members over time ─────────────────────────────────────────────────────

/**
 * Twelve months as a single line.
 *
 * **No area fill**, because the y-axis does not start at zero (§7.4): a filled shape
 * under a truncated axis reads as volume, and the volume would be a lie. One series, so
 * no legend — the card title names it.
 */
function MembersLine({ data }: { data: Dashboard }) {
  const points = data.activeMembersByMonth;
  const values = points.map((p) => p.count);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  // A flat line would otherwise divide by zero and collapse onto one edge.
  const span = max - min || Math.max(1, max);
  const top = max + span * 0.15;
  const bottom = Math.max(0, min - span * 0.15);

  const W = 320;
  const H = 150;
  const x = (i: number) => (i / Math.max(1, points.length - 1)) * W;
  const y = (v: number) => H - ((v - bottom) / (top - bottom)) * H;

  const last = points[points.length - 1];

  return (
    <div className={styles.lineWrap}>
      <svg
        className={styles.line}
        viewBox={`0 -8 ${W} ${H + 24}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Aktif üye sayısı son 12 ay: ${values.join(", ")}`}
      >
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={H * f}
            y2={H * f}
            stroke="var(--grid)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.count)}`).join(" ")}
          fill="none"
          stroke="var(--s2)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/*
          A hit target per month, invisible and wide, so the tooltip works anywhere in
          the column rather than only on a 3px dot.
        */}
        {points.map((p, i) => (
          <rect
            key={p.month}
            x={x(i) - W / points.length / 2}
            y={-8}
            width={W / points.length}
            height={H + 16}
            fill="transparent"
          >
            <title>{`${monthShortLabel(p.month)}: ${p.count} üye`}</title>
          </rect>
        ))}

        {last && (
          <circle cx={x(points.length - 1)} cy={y(last.count)} r={3.5} fill="var(--s2)"
            vectorEffect="non-scaling-stroke" />
        )}
      </svg>

      <div className={styles.months}>
        {points.map((p, i) => (
          <span key={p.month} className={styles.monthLabel}>
            {/*
              Every other month, counted back from the end rather than forward from the
              start — twelve labels collide at this width, and the one that has to
              survive is the newest, which is where the line ends.
            */}
            {(points.length - 1 - i) % 2 === 0 ? monthShortLabel(p.month) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── At risk ──────────────────────────────────────────────────────────────────────

/**
 * The at-risk table, or an explanation of why it would be a false alarm.
 *
 * With no turnstile pass ever recorded, the 45-day rule flags **every member in the
 * club** — correct by its own definition and worth nothing as a signal. Drawing eleven
 * red rows in that state would be the dashboard inventing a crisis out of an empty
 * table, so the screen says which of the two it is showing.
 */
function AtRiskTable({ data }: { data: Dashboard }) {
  if (data.turnstileEntriesEver === 0) {
    return (
      <div className={styles.caveat}>
        <span className={styles.caveatMark} aria-hidden="true">
          ▲
        </span>
        <span>
          <strong>Henüz turnike geçişi kaydedilmedi.</strong> Risk kuralı “45 gündür
          ziyaret yok” olduğu için şu anda {data.atRiskTotal} üyenin tamamı bu listeye
          giriyor. Kulüp açılıp turnike kullanılmaya başlandığında bu liste anlam
          kazanacak.
        </span>
      </div>
    );
  }

  if (data.atRisk.length === 0) {
    return <EmptyState title="Risk altında üye yok">Herkes son 45 gün içinde geldi.</EmptyState>;
  }

  return (
    <>
      <table className={styles.riskTable}>
        <thead>
          <tr>
            <th>Üye</th>
            <th>Son ziyaret</th>
            <th>Üyelik bitiş</th>
            <th aria-label="Aksiyon" />
          </tr>
        </thead>
        <tbody>
          {data.atRisk.map((m) => (
            <tr key={m.userId}>
              <td className={styles.riskName}>
                <Link href={`/members/${m.userId}`}>{m.fullName}</Link>
              </td>
              <td>
                {/* Null is "never came", which is worse than a large number, not absent. */}
                {m.daysSinceLastVisit === null ? "hiç gelmedi" : `${m.daysSinceLastVisit} gün`}
              </td>
              <td>{formatDate(m.membershipEnd)}</td>
              <td>
                {m.phone ? (
                  <a className={styles.riskAction} href={`tel:${m.phone}`}>
                    Ara
                  </a>
                ) : (
                  <Link className={styles.riskAction} href={`/members/${m.userId}`}>
                    Aç
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.atRiskTotal > data.atRisk.length && (
        <p className={styles.footNote}>
          {/* Global `a` already carries the accent colour and hover underline. */}
          <Link href="/members?atRisk=true">
            {data.atRiskTotal} üyenin tamamını gör
          </Link>
        </p>
      )}
    </>
  );
}
