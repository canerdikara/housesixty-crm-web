import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Badge, EmptyState, TableWrap, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { score } from "@/lib/labels";
import type { TrainerSessionScores } from "@/lib/types";
import styles from "../../feedback.module.css";

export const metadata = { title: "Antrenör puanları · House Sixty CRM" };
export const dynamic = "force-dynamic";

const PERIODS = [30, 90, 365] as const;

/**
 * One trainer's ratings broken down per group lesson and 1-on-1 — the drill-down from
 * «Antrenör puanları» on «Geri Bildirim».
 *
 * ADMIN only, like the card it opens from: ratings of named staff are personnel
 * information. The backend refuses everyone else with 403.
 *
 * The headline is computed by the same query as the overview row, so the two always
 * agree. Every rating belongs to exactly one lesson or appointment (a CHECK on
 * `trainer_feedback`), so the rows' counts add up to the headline's.
 */
export default async function TrainerRatingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const raw = Array.isArray(sp.days) ? sp.days[0] : sp.days;
  const days = PERIODS.find((p) => String(p) === raw) ?? 90;

  const result = await apiRequest<TrainerSessionScores>(`/api/v1/crm/feedback/trainers/${id}?days=${days}`);
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind === "error" && result.status === 404) notFound();

  const back = <Link href={`/feedback?days=${days}`}>Geri Bildirim</Link>;

  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Antrenör puanları" subtitle={back} />
        <Card>
          <EmptyState title={result.kind === "forbidden" ? "Antrenör puanlarını yalnızca yöneticiler görür" : "Puanlar yüklenemedi"}>
            {result.message}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const t = result.data;

  const filters = (
    <form method="GET" action={`/feedback/trainers/${id}`} className={ui.filterForm}>
      <select className={ui.select} name="days" defaultValue={String(days)} aria-label="Dönem">
        {PERIODS.map((p) => <option key={p} value={p}>Son {p} gün</option>)}
      </select>
      <button type="submit" className={`${ui.button} ${ui.buttonGhost}`}>Filtrele</button>
    </form>
  );

  return (
    <PageBody>
      <PageHeader title={t.name} subtitle={back} actions={filters} />

      <Card>
        <h2 className={styles.cardTitle}>Ders bazında puanlar</h2>
        <p className={styles.cardSub}>
          Son {days} gün · ortalama <strong>{score(t.average)}</strong> · {t.count} puan · yalnızca yöneticiler görür
        </p>
        {t.sessions.length === 0 ? (
          <EmptyState title={`Son ${days} günde bu antrenöre puan verilmedi`} />
        ) : (
          <TableWrap>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Ders</th>
                  <th>Tür</th>
                  <th className={styles.num}>Ortalama</th>
                  <th className={styles.num}>Puan sayısı</th>
                </tr>
              </thead>
              <tbody>
                {t.sessions.map((s) => (
                  <tr key={`${s.kind}-${s.sessionId}`}>
                    <td className={styles.nowrap}>{formatDate(s.date)} · {s.startTime.slice(0, 5)}</td>
                    <td>{s.title}</td>
                    <td><Badge tone={s.kind === "LESSON" ? "neutral" : "accent"}>{s.kind === "LESSON" ? "Grup dersi" : "Özel ders"}</Badge></td>
                    <td className={styles.num}>{score(s.average)}</td>
                    <td className={styles.num}>{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </PageBody>
  );
}
