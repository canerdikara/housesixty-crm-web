import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Badge, EmptyState, TableWrap, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDayMonth } from "@/lib/dates";
import {
  TICKET_TYPES,
  score,
  surveyStatusLabel,
  ticketStatusLabel,
  ticketStatusTone,
  ticketTypeLabel,
} from "@/lib/labels";
import { canManageFeedback, canRecordFeedback } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { FeedbackOverview, Ticket } from "@/lib/types";
import { ScoreList } from "./ScoreList";
import styles from "./feedback.module.css";

export const metadata = { title: "Geri Bildirim · House Sixty CRM" };
export const dynamic = "force-dynamic";

const PERIODS = [30, 90, 365] as const;

/**
 * «Geri Bildirim» — mockup screen 16.
 *
 * Four tiles, the satisfaction survey's per-question scores, the trainer ratings (ADMIN
 * only — the backend sends null to everyone else), and «Talepler ve şikayetler».
 *
 * Period, ticket type and which survey to show come from the URL, like every filter in
 * the panel. The ticket table shows everything still open whatever its age, plus what was
 * opened or finished in the period — an old complaint must not fall off a 30-day view.
 *
 * Members answer surveys through a personal link, or staff type in a paper form (club's
 * decision, 2026-10-06). Tickets are staff-only; members do not open them.
 */
export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const days = PERIODS.find((p) => String(p) === one("days")) ?? 90;
  const type = one("type");
  const surveyId = one("surveyId");

  const q = new URLSearchParams({ days: String(days) });
  if (type) q.set("type", type);
  if (surveyId) q.set("surveyId", surveyId);

  const [result, session] = await Promise.all([
    apiRequest<FeedbackOverview>(`/api/v1/crm/feedback?${q}`),
    readSession(),
  ]);
  if (result.kind === "unauthorized") redirect("/login");

  const role = session?.user.role;
  const canManage = canManageFeedback(role);
  const canRecord = canRecordFeedback(role);
  const surveys = result.kind === "ok" ? result.data.surveys : [];

  const filters = (
    <>
      <form method="GET" action="/feedback" className={ui.filterForm}>
        <select className={ui.select} name="days" defaultValue={String(days)} aria-label="Dönem">
          {PERIODS.map((p) => <option key={p} value={p}>Son {p} gün</option>)}
        </select>
        <select className={ui.select} name="type" defaultValue={type} aria-label="Talep türü">
          <option value="">Tüm türler</option>
          {TICKET_TYPES.map((t) => <option key={t} value={t}>{ticketTypeLabel(t)}</option>)}
        </select>
        {surveys.length > 1 && (
          <select className={ui.select} name="surveyId" defaultValue={surveyId} aria-label="Anket">
            <option value="">Son anket</option>
            {surveys.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
        <button type="submit" className={`${ui.button} ${ui.buttonGhost}`}>Filtrele</button>
      </form>
      {canRecord && <Link className={`${ui.button} ${ui.buttonGhost}`} href="/feedback/tickets/new">+ Talep ekle</Link>}
      {canManage && <Link className={ui.button} href="/feedback/surveys/new">+ Anket oluştur</Link>}
    </>
  );

  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Geri Bildirim" subtitle="Anketler ve üye talepleri" actions={filters} />
        <Card>
          <EmptyState title={result.kind === "forbidden" ? "Bu ekranı görüntüleme yetkiniz yok" : "Geri bildirimler yüklenemedi"}>
            {result.message}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const d = result.data;
  const sv = d.survey;
  const rate = sv && sv.asked > 0 ? Math.round((sv.answered / sv.asked) * 100) : null;
  const ratings = sv?.stats.filter((s) => s.type === "RATING") ?? [];

  return (
    <PageBody>
      <PageHeader title="Geri Bildirim" subtitle="Anketler ve üye talepleri" actions={filters} />

      <div className={styles.tiles}>
        <Tile
          label="Genel memnuniyet"
          value={score(d.overallAverage)}
          note={d.overallCount ? `5 üzerinden · ${d.overallCount} yanıt` : `Son ${days} günde yanıt yok`}
          tone={d.overallAverage === null ? "muted" : d.overallAverage >= 4 ? "good" : "warn"}
        />
        <Tile
          label="Yanıt oranı"
          value={rate === null ? "—" : `%${rate}`}
          note={sv && sv.asked > 0 ? `${sv.asked} üyenin ${sv.answered}'${apostropheSuffix(sv.answered)}` : "Ankete eklenmiş üye yok"}
          tone={rate === null ? "muted" : "good"}
        />
        <Tile
          label="Açık talep"
          value={d.openTickets}
          note={d.openAverageAgeDays === null ? "Bekleyen talep yok" : `ortalama ${score(d.openAverageAgeDays)} gün`}
          tone={d.openTickets ? "warn" : "muted"}
        />
        <Tile
          label={`Çözülen · ${days} gün`}
          value={d.resolvedInPeriod}
          note={d.resolvedAverageDays === null ? "—" : `ortalama ${score(d.resolvedAverageDays)} gün`}
          tone={d.resolvedInPeriod ? "good" : "muted"}
        />
      </div>

      <div className={`${styles.row} ${d.trainers === null ? styles.rowSingle : ""}`}>
        <Card>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Memnuniyet anketi</h2>
              <p className={styles.cardSub}>
                {sv
                  ? `${sv.title} · ${surveyStatusLabel(sv.status)} · ${sv.answered} yanıt · 5 üzerinden`
                  : "Henüz anket yok"}
              </p>
            </div>
            {sv && <Link className={styles.cardLink} href={`/feedback/surveys/${sv.id}`}>Anketi aç ›</Link>}
          </div>
          {!sv ? (
            <EmptyState title="Henüz anket oluşturulmadı">
              {canManage ? <Link href="/feedback/surveys/new">İlk anketi oluşturun</Link> : null}
            </EmptyState>
          ) : ratings.length === 0 ? (
            <EmptyState title="Bu ankette puan sorusu yok" />
          ) : (
            <ScoreList stats={ratings} />
          )}
        </Card>

        {d.trainers !== null && (
          <Card>
            <h2 className={styles.cardTitle}>Antrenör puanları</h2>
            <p className={styles.cardSub}>Son {days} gün · ders sonrası üye değerlendirmesi · yalnızca yöneticiler görür</p>
            {d.trainers.length === 0 ? (
              <EmptyState title={`Son ${days} günde antrenör puanı yok`} />
            ) : (
              <ul className={styles.scores}>
                {d.trainers.map((t) => (
                  <li key={t.trainerId}>
                    <span className={`${styles.scoreName} ${styles.scoreNameRight}`}>{t.name}</span>
                    <span className={`${styles.track} ${styles.trackTall}`}>
                      <span className={styles.fill} style={{ width: `${(t.average / 5) * 100}%` }} />
                    </span>
                    <span className={styles.scoreValue}>
                      {score(t.average)}
                      <span className={styles.scoreCount}>{t.count} puan</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      <div className={styles.side}>
      <Card>
        <h2 className={styles.cardTitle}>Talepler ve şikayetler</h2>
        <p className={styles.cardSub}>
          Açık olanların tümü, son {days} günde açılan ya da kapananlar
          {type ? ` · yalnızca «${ticketTypeLabel(type)}»` : ""}
        </p>
        {d.tickets.length === 0 ? (
          <EmptyState title="Kayıtlı talep yok">
            {canRecord ? <Link href="/feedback/tickets/new">Bir talep ya da şikayet kaydedin</Link> : null}
          </EmptyState>
        ) : (
          <TableWrap>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Konu</th>
                  <th>Tür</th>
                  <th>Üye</th>
                  <th>Durum</th>
                  <th className={styles.num}>Yaş</th>
                  <th>Sorumlu</th>
                </tr>
              </thead>
              <tbody>
                {d.tickets.map((t) => <TicketRow key={t.id} t={t} />)}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <h2 className={styles.cardTitle}>Anketler</h2>
        <p className={styles.cardSub}>
          Üyeler kendi bağlantılarından yanıtlar; kağıt ya da telefonla gelen yanıtları anket ekranından girebilirsiniz
        </p>
        {surveys.length === 0 ? (
          <EmptyState title="Henüz anket yok" />
        ) : (
          <TableWrap>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Anket</th>
                  <th>Durum</th>
                  <th>Oluşturuldu</th>
                  <th className={styles.num}>Eklenen</th>
                  <th className={styles.num}>Yanıt</th>
                  <th className={styles.num}>Oran</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/feedback/surveys/${s.id}`} className={ui.rowLink}>{s.title}</Link></td>
                    <td><Badge tone={s.status === "OPEN" ? "good" : "neutral"}>{surveyStatusLabel(s.status)}</Badge></td>
                    <td className={ui.nowrap}>{formatDayMonth(s.createdAt)}</td>
                    <td className={styles.num}>{s.asked}</td>
                    <td className={styles.num}>{s.answered}</td>
                    <td className={styles.num}>
                      {s.asked ? `%${Math.round((s.answered / s.asked) * 100)}` : <span className={ui.faint}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      </div>
    </PageBody>
  );
}

/**
 * The suffix after an apostrophe on a number: "186'sı", "40'ı", "3'ü". Turkish vowel
 * harmony follows how the number is *read*, so it is decided by the last spoken word.
 */
function apostropheSuffix(n: number): string {
  if (n === 0) return "ı";
  const last = n % 10;
  const tens = Math.floor(n / 10) % 10;
  if (last !== 0) return ["", "i", "si", "ü", "ü", "i", "sı", "si", "i", "u"][last]!;
  if (n % 1000 === 0) return "i";
  if (n % 100 === 0) return "ü";
  return ["", "u", "si", "u", "ı", "si", "ı", "i", "i", "ı"][tens]!;
}

function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number | string;
  note: string;
  tone: "good" | "warn" | "muted";
}) {
  const noteClass = { good: styles.tileNoteGood, warn: styles.tileNoteWarn, muted: "" }[tone];
  return (
    <div className={styles.tile}>
      <p className={styles.tileLabel}>{label}</p>
      <p className={styles.tileValue}>{value}</p>
      <p className={`${styles.tileNote} ${noteClass}`}>{note}</p>
    </div>
  );
}

function TicketRow({ t }: { t: Ticket }) {
  return (
    <tr>
      <td>
        <Link href={`/feedback/tickets/${t.id}`} className={ui.rowLink}>{t.subject}</Link>
      </td>
      <td><span className={styles.typePill}>{ticketTypeLabel(t.type)}</span></td>
      <td><Link href={`/members/${t.userId}`} className={ui.rowLink}>{t.memberName}</Link></td>
      <td><Badge tone={ticketStatusTone(t.status)}>{ticketStatusLabel(t.status)}</Badge></td>
      <td className={`${styles.num} ${ui.nowrap}`}>{t.ageDays === 0 ? "bugün" : `${t.ageDays} gün`}</td>
      <td>{t.assigneeName ?? <span className={ui.faint}>—</span>}</td>
    </tr>
  );
}
