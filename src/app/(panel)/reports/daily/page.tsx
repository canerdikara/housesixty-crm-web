import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import type { DailyReport } from "@/lib/types";
import { AreaBreakdown, PeopleTable, TurnstileNotice } from "../ReportParts";
import { Calendar } from "./Calendar";
import styles from "../reports.module.css";

export const metadata = { title: "Günlük rapor · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * «Günlük rapor» — the same building, on a chosen day.
 *
 * A calendar on the left, the day's report on the right. The chosen day is a URL
 * parameter, so a particular day can be bookmarked or sent to somebody — the convention
 * every filter in this panel follows.
 *
 * ## What this screen can answer that no other one can
 *
 * Because bookings and turnstile passes are kept apart rather than blended, the day
 * splits four ways, and two of those are only visible here:
 *
 * - **Gelmedi** — booked and never scanned in. A no-show list, per person.
 * - **Rezervasyonsuz** — scanned in with nothing booked. Everybody who came for the gym,
 *   invisible to every other screen in the CRM.
 */
export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  // İzmir's today, not the server's and not the viewer's — the same rule lib/dates.ts
  // follows for display, applied to the default.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const requested = params.date;
  // Validated here as well as on the backend, which refuses a future day with a 400:
  // a malformed parameter should land on today's report rather than on an error page.
  const date =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today;

  const result = await apiRequest<DailyReport>(`/api/v1/crm/reports/daily?date=${date}`);
  if (result.kind === "unauthorized") redirect("/login");

  const subtitle = (
    <>
      <Link href="/">Genel Bakış</Link> › Günlük rapor · {formatDate(date)}
    </>
  );
  const actions = (
    <div className={styles.headerActions}>
      <Link className={`${ui.button} ${ui.buttonGhost}`} href="/reports/live">
        Anlık rapor
      </Link>
    </div>
  );

  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Günlük rapor" subtitle={subtitle} actions={actions} />
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
  const isToday = date === today;

  return (
    <PageBody>
      <PageHeader title="Günlük rapor" subtitle={subtitle} actions={actions} />

      <div className={styles.dailyLayout}>
        <Card>
          <h2 className={styles.cardTitle}>Gün seçin</h2>
          <p className={styles.cardSub}>Gelecek günler için rapor alınamaz</p>
          <Calendar selected={date} today={today} />
        </Card>

        <div className={styles.dailyMain}>
          <div className={styles.headline}>
            <Headline value={d.bookedTotal} label="Rezervasyonlu" note="o gün beklenen kişi" />
            <Headline
              value={d.turnstileEverUsed ? d.checkedInTotal : null}
              label="Turnikeden giren"
              note="o gün tesise giren"
            />
            <Headline
              value={d.turnstileEverUsed ? d.noShowTotal : null}
              label="Gelmedi"
              note="rezervasyonu vardı, girmedi"
            />
            <Headline
              value={d.turnstileEverUsed ? d.walkInTotal : null}
              label="Rezervasyonsuz"
              note="rezervasyonsuz geldi"
            />
          </div>

          <Card>
            <h2 className={styles.cardTitle}>Alanlara göre</h2>
            <p className={styles.cardSub}>
              {isToday ? "Bugün, şu ana kadar" : formatDate(date)}
            </p>
            <AreaBreakdown areas={d.areas} turnstileEverUsed={d.turnstileEverUsed} />
            <TurnstileNotice used={d.turnstileEverUsed} />
          </Card>

          {/* Drawn only when there is something in it. An all-zero histogram is a wall of
              identical empty tracks that says nothing and looks broken. */}
          {d.hours.some((h) => h.entries > 0) && (
            <Card>
              <h2 className={styles.cardTitle}>Saatlere göre giriş</h2>
              <p className={styles.cardSub}>Turnikeden geçiş saatleri · İzmir saati</p>
              <HourChart hours={d.hours} />
            </Card>
          )}

          <Card>
            <h2 className={styles.cardTitle}>Kişiler</h2>
            <p className={styles.cardSub}>
              {d.people.length === 0
                ? "O gün kayıt yok"
                : `${d.people.length} kişi · rezervasyonu olanlar ve turnikeden girenler birlikte`}
            </p>
            <PeopleTable
              people={d.people}
              turnstileEverUsed={d.turnstileEverUsed}
              showTimes
              emptyTitle="O gün için kayıt yok"
              emptyText="Bu tarihte rezervasyon, ders veya birebir randevu yok ve turnikeden geçen olmadı."
            />
          </Card>
        </div>
      </div>
    </PageBody>
  );
}

function Headline({ value, label, note }: { value: number | null; label: string; note: string }) {
  return (
    <div className={styles.headlineCard}>
      <p className={styles.headlineValue}>{value ?? "—"}</p>
      <p className={styles.headlineLabel}>{label}</p>
      <p className={styles.headlineNote}>{note}</p>
    </div>
  );
}

/**
 * Entries per hour, as CSS bars.
 *
 * All 24 hours including the empty ones — a histogram with gaps in it reads as missing
 * data rather than as a quiet morning. Heights are a share of the busiest hour, so the
 * shape is readable whether the club saw six people or six hundred.
 */
function HourChart({ hours }: { hours: { hour: number; entries: number }[] }) {
  const max = hours.reduce((m, h) => Math.max(m, h.entries), 0);
  return (
    <div className={styles.hours}>
      {hours.map((h) => (
        <div key={h.hour} className={styles.hourCol}>
          <span className={styles.hourTrack}>
            <span
              className={`${styles.hourFill} ${h.entries > 0 ? styles.hourFillHasValue : ""}`}
              style={{ height: max === 0 ? "0%" : `${(h.entries / max) * 100}%` }}
              title={`${String(h.hour).padStart(2, "0")}:00 — ${h.entries} giriş`}
            />
          </span>
          {/* Every third hour, or 24 labels collide into a grey smear at panel width. */}
          <span className={styles.hourLabel}>{h.hour % 3 === 0 ? h.hour : ""}</span>
        </div>
      ))}
    </div>
  );
}
