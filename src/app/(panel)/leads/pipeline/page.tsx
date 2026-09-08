import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Avatar, EmptyState, Tag, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { daysSinceLabel } from "@/lib/dates";
import { interestLabel, leadSourceLabel, leadStatusLabel } from "@/lib/labels";
import type { Pipeline } from "@/lib/types";
import styles from "./pipeline.module.css";

export const metadata = { title: "Satış hunisi · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * The ordinal ramp from the design tokens — one hue, light to dark.
 *
 * A funnel is an *ordered* sequence, so it gets the ordinal ramp rather than the
 * categorical series colours. Using s1–s4 here would imply the stages are unrelated
 * categories, and would also run out after four.
 */
const RAMP = ["var(--o1)", "var(--o2)", "var(--o3)", "var(--o4)", "var(--o5)"];

/** The five funnel stages. LOST is a column on the board but not a funnel step. */
const FUNNEL = ["NEW", "CONTACTED", "VISITED", "PROPOSAL_SENT", "WON"] as const;

export default async function PipelinePage() {
  const result = await apiRequest<Pipeline>("/api/v1/crm/leads/pipeline?cardsPerStage=8");
  if (result.kind === "unauthorized") redirect("/login");

  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Adaylar" subtitle="Satış hunisi" />
        <Card>
          <EmptyState
            title={result.kind === "forbidden" ? "Bu alanı görüntüleme yetkiniz yok" : "Huni yüklenemedi"}
          >
            {result.message}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const byStatus = new Map(result.data.stages.map((s) => [s.status, s]));
  const funnelStages = FUNNEL.map((s) => byStatus.get(s));
  const top = funnelStages[0]?.total ?? 0;

  return (
    <PageBody>
      <PageHeader
        title="Adaylar"
        subtitle="Satış hunisi"
        actions={
          <>
            <Link className={`${ui.button} ${ui.buttonGhost}`} href="/leads">
              Liste görünümü
            </Link>
            {result.data.conversionRate !== null && (
              <span className={ui.chip}>
                Aday → üye <strong className={ui.chipCount}>%{result.data.conversionRate}</strong>
              </span>
            )}
          </>
        }
      />

      <div style={{ marginBottom: 18 }}>
        <Card>
          <h2 style={{ fontSize: 16, marginBottom: 4 }}>Dönüşüm hunisi</h2>
          <p className={ui.muted} style={{ margin: "0 0 20px", fontSize: 13 }}>
            Aşamadan aşamaya geçiş
          </p>

          <div className={styles.funnel}>
            {funnelStages.map((stage, i) => {
              const total = stage?.total ?? 0;
              const prev = funnelStages[i - 1]?.total ?? 0;
              // Share of the top of the funnel, so the bars are comparable to each
              // other rather than each being 100% of itself.
              const width = top === 0 ? 0 : Math.round((total / top) * 100);
              // Step-to-step conversion, which is the number a salesperson acts on —
              // "we lose most people between the visit and the proposal".
              const step = i === 0 || prev === 0 ? null : Math.round((total / prev) * 100);
              return (
                <div key={FUNNEL[i]} className={styles.funnelStage}>
                  <div className={styles.funnelTrack}>
                    <div
                      className={styles.funnelFill}
                      style={{ width: `${width}%`, background: RAMP[i] }}
                    />
                  </div>
                  <div className={styles.funnelCount}>{total}</div>
                  <div className={styles.funnelLabel}>
                    {leadStatusLabel(FUNNEL[i])}
                    {step !== null && <span className={styles.funnelStep}>%{step} geçiş</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className={styles.board}>
        {result.data.stages.map((stage, i) => {
          const remaining = stage.total - stage.cards.length;
          return (
            <section key={stage.status} className={styles.column} aria-label={leadStatusLabel(stage.status)}>
              <header className={styles.columnHead}>
                <span
                  className={styles.columnDot}
                  aria-hidden="true"
                  style={{
                    // LOST sits outside the ordinal ramp — it is not a later stage of
                    // the same journey, it is the journey ending.
                    background: stage.status === "LOST" ? "var(--crit)" : RAMP[Math.min(i, RAMP.length - 1)],
                  }}
                />
                <h2 className={styles.columnTitle}>{leadStatusLabel(stage.status)}</h2>
                <span className={styles.columnCount}>{stage.total}</span>
              </header>

              <div className={styles.columnBody}>
                {stage.cards.length === 0 ? (
                  <p className={styles.columnEmpty}>Bu aşamada aday yok</p>
                ) : (
                  stage.cards.map((lead) => (
                    <Link key={lead.id} href={`/leads/${lead.id}`} className={styles.card}>
                      <div className={styles.cardName}>{lead.fullName}</div>
                      <div className={styles.cardTags}>
                        <Tag muted>{leadSourceLabel(lead.source)}</Tag>
                        {lead.interestedIn && <Tag>{interestLabel(lead.interestedIn)}</Tag>}
                      </div>
                      <div className={styles.cardFoot}>
                        <Avatar name={lead.ownerName} />
                        <span className={styles.cardAge}>{daysSinceLabel(lead.lastContactAt)}</span>
                      </div>
                    </Link>
                  ))
                )}

                {remaining > 0 && (
                  <Link className={styles.more} href={`/leads?status=${stage.status}`}>
                    + {remaining} aday daha
                  </Link>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </PageBody>
  );
}
