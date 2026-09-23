import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import { segmentRuleSentence } from "@/lib/labels";
import type { SegmentList } from "@/lib/types";
import styles from "./segments.module.css";

export const metadata = { title: "Segmentler · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * «Segmentler» — mockup screen 9.
 *
 * A card per segment, then one bar chart of their sizes. The chart is the point of the
 * screen: segments overlap by design — a member can be in "Kurucu üyeler" and
 * "Uzaklaşan üyeler" at once — so the bars are read against each other and against the
 * club total, never added up. The subtitle says so.
 */
export default async function SegmentsPage() {
  const result = await apiRequest<SegmentList>("/api/v1/crm/segments");
  if (result.kind === "unauthorized") redirect("/login");

  const actions = (
    <Link className={ui.button} href="/segments/new">
      + Yeni segment
    </Link>
  );

  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Segmentler" subtitle="Kayıtlı segmentler ve segment oluşturucu" />
        <Card>
          <EmptyState
            title={
              result.kind === "forbidden"
                ? "Bu ekranı görüntüleme yetkiniz yok"
                : "Segmentler yüklenemedi"
            }
          >
            {result.message}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const { segments, totalMembers } = result.data;
  // Only segments that have been counted can be drawn. A null count is "never run",
  // which is not a zero-length bar — it is no bar at all.
  const sized = segments.filter((s) => s.lastCount !== null);
  const max = sized.reduce((m, s) => Math.max(m, s.lastCount ?? 0), 0);

  return (
    <PageBody>
      <PageHeader
        title="Segmentler"
        subtitle={
          segments.length === 0
            ? "Henüz segment tanımlanmadı"
            : `${segments.length} tanımlı segment · gecelik yenileniyor`
        }
        actions={actions}
      />

      {segments.length === 0 ? (
        <Card>
          <EmptyState title="Henüz segment yok">
            Bir segment, üyelere sorulan kayıtlı bir sorudur — «45 gündür gelmeyenler»,
            «üyeliği bir ay içinde bitenler». Kriterleri seçin, kaç üyenin eşleştiğini
            anında görün.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className={styles.cards}>
            {segments.map((s) => (
              <Link key={s.id} href={`/segments/${s.id}`} className={styles.segmentCard}>
                <div className={styles.segmentHead}>
                  <h2 className={styles.segmentName}>{s.name}</h2>
                  <span
                    className={`${styles.typeBadge} ${s.isDynamic ? styles.typeBadgeDynamic : ""}`}
                  >
                    {s.isDynamic ? "Dinamik" : "Statik"}
                  </span>
                </div>

                <p className={styles.segmentRules}>
                  {s.rules.length === 0
                    ? s.isDynamic
                      ? "Tüm aktif üyeler"
                      : "Elle seçildi"
                    : s.rules.map(segmentRuleSentence).join(" · ")}
                </p>

                <div className={styles.segmentFoot}>
                  <div>
                    <span className={styles.segmentCount}>
                      {/* Null is "not counted yet", and must not read as nobody. */}
                      {s.lastCount ?? "—"}
                    </span>
                    <span className={styles.segmentCountUnit}>üye</span>
                  </div>
                  <span className={styles.segmentRun}>
                    {s.lastRunAt
                      ? `Son çalıştırma: ${formatDateTime(s.lastRunAt)}`
                      : "Henüz çalıştırılmadı"}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {sized.length > 0 && (
            <Card>
              <h2 className={styles.cardTitle}>Segment büyüklükleri</h2>
              <p className={styles.cardSub}>
                {totalMembers} aktif üye üzerinden · segmentler çakışabilir
              </p>
              <div className={styles.sizes}>
                {sized.map((s) => (
                  <div key={s.id} className={styles.sizeRow}>
                    <Link href={`/segments/${s.id}`} className={styles.sizeName}>
                      {s.name}
                    </Link>
                    <span className={styles.sizeTrack}>
                      <span
                        className={styles.sizeFill}
                        style={{ width: max === 0 ? "0%" : `${((s.lastCount ?? 0) / max) * 100}%` }}
                        title={`${s.name}: ${s.lastCount} üye`}
                      />
                    </span>
                    <span className={styles.sizeValue}>{s.lastCount}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </PageBody>
  );
}
