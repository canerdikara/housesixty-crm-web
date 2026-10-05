import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState, TableWrap, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDayMonth, izmirToday } from "@/lib/dates";
import { EVENT_TYPES, eventStatusLabel, eventTypeLabel } from "@/lib/labels";
import { canManageEvents } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { EventList, EventListItem } from "@/lib/types";
import styles from "./events.module.css";

export const metadata = { title: "Etkinlikler · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * «Etkinlikler» — mockup screen 13.
 *
 * Upcoming events as cards with a capacity bar, past ones as a table with the attendance
 * rate. **Tournaments are listed too, read-only** — the club's decision (2026-10-05) —
 * from their own tables, so nothing is entered twice. A tournament row links to nothing:
 * it is run in the admin app, and a panel screen that looked editable would be a lie.
 *
 * Year and type come from the URL, like every filter in the panel.
 */
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const thisYear = Number(izmirToday().slice(0, 4));
  const year = Number.parseInt(one("year"), 10) || thisYear;
  const type = one("type");

  const q = new URLSearchParams({ year: String(year) });
  if (type) q.set("type", type);

  const [result, session] = await Promise.all([
    apiRequest<EventList>(`/api/v1/crm/events?${q}`),
    readSession(),
  ]);
  if (result.kind === "unauthorized") redirect("/login");

  const canManage = canManageEvents(session?.user.role);

  const filters = (
    <>
      <form method="GET" action="/events" className={ui.filterForm}>
        <select className={ui.select} name="year" defaultValue={String(year)} aria-label="Yıl">
          {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select className={ui.select} name="type" defaultValue={type} aria-label="Tür">
          <option value="">Tüm türler</option>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{eventTypeLabel(t)}</option>)}
          <option value="TOURNAMENT">Turnuva</option>
        </select>
        <button type="submit" className={`${ui.button} ${ui.buttonGhost}`}>Filtrele</button>
      </form>
      {canManage && <Link className={ui.button} href="/events/new">+ Yeni etkinlik</Link>}
    </>
  );

  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Etkinlikler" actions={filters} />
        <Card>
          <EmptyState title={result.kind === "forbidden" ? "Bu ekranı görüntüleme yetkiniz yok" : "Etkinlikler yüklenemedi"}>
            {result.message}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const { upcoming, past } = result.data;

  return (
    <PageBody>
      <PageHeader
        title="Etkinlikler"
        subtitle={`${year} · ${upcoming.length} yaklaşan · ${past.length} geçmiş`}
        actions={filters}
      />

      <Card>
        <h2 className={styles.cardTitle}>Yaklaşan etkinlikler</h2>
        <p className={styles.cardSub}>Kontenjan ve kayıt durumu</p>
        {upcoming.length === 0 ? (
          <EmptyState title="Yaklaşan etkinlik yok">
            {canManage ? <Link href="/events/new">İlk etkinliği oluşturun</Link> : null}
          </EmptyState>
        ) : (
          <div className={styles.upcoming}>
            {upcoming.map((e) => <UpcomingCard key={`${e.kind}-${e.id}`} e={e} />)}
          </div>
        )}
      </Card>

      <Card>
        <h2 className={styles.cardTitle}>Geçmiş etkinlikler</h2>
        <p className={styles.cardSub}>Davet edilenler üzerinden katılım oranı</p>
        {past.length === 0 ? (
          <EmptyState title={`${year} içinde geçmiş etkinlik yok`} />
        ) : (
          <TableWrap>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Etkinlik</th>
                  <th>Tarih</th>
                  <th>Tür</th>
                  <th className={styles.num}>Davet</th>
                  <th className={styles.num}>Yanıt</th>
                  <th className={styles.num}>Katılım</th>
                  <th className={styles.num}>Katılım oranı</th>
                </tr>
              </thead>
              <tbody>
                {past.map((e) => <PastRow key={`${e.kind}-${e.id}`} e={e} />)}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </PageBody>
  );
}

/** "Cumartesi 10:00 · Lounge" — weekday from the date, time when there is one. */
function metaLine(e: EventListItem): string {
  const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: "Europe/Istanbul" })
    .format(new Date(`${e.eventDate}T12:00:00Z`));
  return [
    e.startTime ? `${weekday} ${e.startTime.slice(0, 5)}` : weekday,
    e.location,
    e.kind === "TOURNAMENT" ? "Turnuva" : null,
  ].filter(Boolean).join(" · ");
}

function DateMark({ date, muted }: { date: string; muted?: boolean }) {
  const [, , d] = date.split("-");
  const month = new Intl.DateTimeFormat("tr-TR", { month: "short", timeZone: "Europe/Istanbul" })
    .format(new Date(`${date}T12:00:00Z`));
  return (
    <div className={`${styles.dateMark} ${muted ? styles.dateMarkMuted : ""}`} aria-hidden="true">
      <span className={styles.dateMarkDay}>{Number(d)}</span>
      <span className={styles.dateMarkMonth}>{month}</span>
    </div>
  );
}

/**
 * One upcoming card. The bar is accepted (or registered) over capacity, coloured the
 * mockup's way: green with room, amber past 80 %, red when full.
 *
 * With no capacity there is nothing to fill, so no bar — the count alone. An empty event
 * draws an empty track, never a full one (crm/HANDOVER.md 2026-09-29).
 */
function UpcomingCard({ e }: { e: EventListItem }) {
  const count = e.kind === "TOURNAMENT" ? (e.registered ?? 0) : (e.accepted ?? 0);
  const noun = e.kind === "TOURNAMENT" ? "kayıt" : "katılacak";
  const ratio = e.capacity ? Math.min(1, count / e.capacity) : null;
  const tone = ratio === null ? "" : ratio >= 1 ? styles.barCrit : ratio >= 0.8 ? styles.barWarn : styles.barGood;
  const cancelled = e.status === "CANCELLED";

  const inner = (
    <>
      <DateMark date={e.eventDate} muted={cancelled} />
      <div className={styles.upMain}>
        <p className={styles.upTitle}>{e.title}</p>
        <p className={styles.upMeta}>
          {metaLine(e)}
          {cancelled || e.status === "DRAFT" ? ` · ${eventStatusLabel(e.status)}` : ""}
        </p>
        <div className={styles.bar}>
          {ratio !== null && (
            <span className={styles.barTrack}>
              <span className={`${styles.barFill} ${tone}`} style={{ width: `${ratio * 100}%` }} />
            </span>
          )}
          <span className={styles.barLabel}>
            {e.capacity ? `${count}/${e.capacity} ${noun}` : `${count} ${noun}`}
          </span>
        </div>
      </div>
    </>
  );

  // Tournaments are run in the admin app; there is no panel screen to open.
  return e.kind === "EVENT"
    ? <Link href={`/events/${e.id}`} className={styles.upCard}>{inner}</Link>
    : <div className={styles.upCard} title="Turnuvalar yönetici uygulamasından yönetilir">{inner}</div>;
}

/**
 * A past row. The rate is attended ÷ invited, as the mockup's subtitle says — and an em
 * dash when nobody was invited, never "%0", which would claim a failure that did not
 * happen. A tournament has no invitations, so its rate is a dash and its «Katılım» is the
 * registrations.
 */
function PastRow({ e }: { e: EventListItem }) {
  const isEvent = e.kind === "EVENT";
  const rate = isEvent && e.invited ? Math.round(((e.attended ?? 0) / e.invited) * 100) : null;
  const dash = <span className={ui.faint}>—</span>;
  return (
    <tr>
      <td>
        {isEvent
          ? <Link href={`/events/${e.id}`} className={ui.rowLink}>{e.title}</Link>
          : e.title}
        {e.status === "CANCELLED" && <span className={ui.faint}> · İptal</span>}
      </td>
      <td className={ui.nowrap}>{formatDayMonth(e.eventDate)}</td>
      <td><span className={styles.typePill}>{eventTypeLabel(e.type)}</span></td>
      <td className={styles.num}>{isEvent ? e.invited : dash}</td>
      <td className={styles.num}>{isEvent ? e.responded : dash}</td>
      <td className={styles.num}>{isEvent ? e.attended : e.registered}</td>
      <td className={styles.num}>{rate === null ? dash : `%${rate}`}</td>
    </tr>
  );
}
