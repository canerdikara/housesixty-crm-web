import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import type { LiveReport } from "@/lib/types";
import { AreaBreakdown, PeopleTable, TurnstileNotice } from "../ReportParts";
import styles from "../reports.module.css";

export const metadata = { title: "Anlık rapor · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * «Anlık rapor» — the building right now.
 *
 * ## Two headline numbers, deliberately not one
 *
 * «Rezervasyonlu» is who is expected at this minute; «Turnikeden» is who actually came
 * through a door. They are never added or averaged, because the gap between them is the
 * point: it is the list of people who booked a court and have not arrived.
 *
 * ## It does not auto-refresh
 *
 * A screen the front desk leaves open all day that silently re-fetches is a screen
 * nobody can trust the timestamp on — and one that re-renders while somebody is reading
 * a name. The moment it was taken is printed at the top and there is a button to take
 * another. If the club later wants it on a wall, a fixed interval is one line, but it
 * should be a decision rather than a default.
 */
export default async function LiveReportPage() {
  const result = await apiRequest<LiveReport>("/api/v1/crm/reports/live");
  if (result.kind === "unauthorized") redirect("/login");

  const header = (subtitle: React.ReactNode, actions?: React.ReactNode) => (
    <PageHeader title="Anlık rapor" subtitle={subtitle} actions={actions} />
  );

  if (result.kind !== "ok") {
    return (
      <PageBody>
        {header(<Link href="/">Genel Bakış</Link>)}
        <Card>
          <EmptyState
            title={
              result.kind === "forbidden"
                ? "Bu ekranı görüntüleme yetkiniz yok"
                : "Rapor yüklenemedi"
            }
          >
            {result.message}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const d = result.data;

  return (
    <PageBody>
      {header(
        <>
          <Link href="/">Genel Bakış</Link> › Anlık rapor ·{" "}
          <span className={ui.nowrap}>{formatDateTime(d.asOf)} itibarıyla</span>
        </>,
        <div className={styles.headerActions}>
          {/* A plain link to this same URL. The page is force-dynamic, so following it
              re-runs the query — a refresh button that needs no client component. */}
          <Link className={ui.button} href="/reports/live">
            Yenile
          </Link>
          <Link className={`${ui.button} ${ui.buttonGhost}`} href="/reports/daily">
            Günlük rapor
          </Link>
        </div>
      )}

      <div className={styles.headline}>
        <Headline
          value={d.bookedTotal}
          label="Rezervasyonlu"
          note="şu an kortta, derste veya spada beklenen"
        />
        <Headline
          // Em dash rather than 0 while nothing has ever scanned — see TurnstileNotice.
          value={d.turnstileEverUsed ? d.checkedInTotal : null}
          label="Turnikeden giren"
          note="içeride, çıkış okutmamış"
        />
      </div>

      <Card>
        <h2 className={styles.cardTitle}>Alanlara göre</h2>
        <p className={styles.cardSub}>
          İki sayı ayrı tutulur ve toplanmaz — biri beklenen, diğeri gelen.
        </p>
        <AreaBreakdown areas={d.areas} turnstileEverUsed={d.turnstileEverUsed} />
        <TurnstileNotice used={d.turnstileEverUsed} />
      </Card>

      <Card>
        {/*
          «Beklenen ve gelenler», not «Tesisteki kişiler».
          
          The list deliberately includes people who booked and have not arrived — that is
          the front desk's most useful row, and the «Gelmedi» badge is what marks them.
          But a card headed "people at the facility" listing somebody who is not at the
          facility is simply a false statement, and the first person to notice would stop
          trusting the rest of the screen.
        */}
        <h2 className={styles.cardTitle}>Beklenen ve gelenler</h2>
        <p className={styles.cardSub}>
          {d.people.length === 0
            ? "Şu an kimse beklenmiyor"
            : `${d.people.length} kişi · «Gelmedi» olanlar rezervasyonu olup henüz girmemiş olanlardır`}
        </p>
        <PeopleTable
          people={d.people}
          turnstileEverUsed={d.turnstileEverUsed}
          emptyTitle="Şu anda tesiste kimse görünmüyor"
          emptyText="Bu saatte başlayan bir rezervasyon, ders veya birebir randevu yok ve turnikeden geçen olmadı."
        />
      </Card>
    </PageBody>
  );
}

function Headline({
  value,
  label,
  note,
}: {
  /** Null prints an em dash — "not measured", which is not the same as nought. */
  value: number | null;
  label: string;
  note: string;
}) {
  return (
    <div className={styles.headlineCard}>
      <p className={styles.headlineValue}>{value ?? "—"}</p>
      <p className={styles.headlineLabel}>{label}</p>
      <p className={styles.headlineNote}>{note}</p>
    </div>
  );
}
