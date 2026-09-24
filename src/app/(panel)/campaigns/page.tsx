import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Badge, ChipRow, EmptyState, FilterChip, Pagination, TableWrap, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDayMonth } from "@/lib/dates";
import { campaignChannelLabel, campaignStatusLabel } from "@/lib/labels";
import { canWriteCampaigns } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { CampaignList, CampaignListItem, CampaignStatus } from "@/lib/types";
import styles from "./campaigns.module.css";

export const metadata = { title: "Kampanyalar · House Sixty CRM" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const STATUSES: CampaignStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "SENDING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

/**
 * «Kampanyalar» — mockup screen 11.
 *
 * Four tiles over a thirty-day window, then the table. The mockup's fourth tile is
 * "Kampanyadan aksiyon — rezervasyon / yanıt"; it is the click rate here instead,
 * because counting the bookings a recipient happens to make after a send would credit
 * the campaign for every reservation a club full of members was going to make anyway.
 * Same judgement as `event_attendance_count` in segments: leave the spec's name free to
 * mean what it says once there is something real behind it.
 *
 * Status and channel come from the URL, like every other filter in the panel, so a
 * filtered view can be sent to a colleague and survives a page change.
 */
export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";

  const status = one("status");
  const channel = one("channel");
  const page = Math.max(0, Number.parseInt(one("page") || "0", 10) || 0);

  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (channel) query.set("channel", channel);
  query.set("page", String(page));
  query.set("size", String(PAGE_SIZE));

  const [result, session] = await Promise.all([
    apiRequest<CampaignList>(`/api/v1/crm/campaigns?${query}`),
    readSession(),
  ]);
  if (result.kind === "unauthorized") redirect("/login");

  const canWrite = canWriteCampaigns(session?.user.role);
  const actions = canWrite ? (
    <Link className={ui.button} href="/campaigns/new">
      + Yeni kampanya
    </Link>
  ) : null;

  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Kampanyalar" subtitle="E-posta kampanyaları ve sonuçları" />
        <Card>
          <EmptyState
            title={
              result.kind === "forbidden"
                ? "Bu ekranı görüntüleme yetkiniz yok"
                : "Kampanyalar yüklenemedi"
            }
          >
            {result.message}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const { content, stats, totalElements, totalPages } = result.data;

  const hrefWith = (over: Record<string, string>) => {
    const q = new URLSearchParams();
    const merged = { status, channel, page: String(page), ...over };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "0") q.set(k, v);
    return `/campaigns${q.toString() ? `?${q}` : ""}`;
  };

  return (
    <PageBody>
      <PageHeader
        title="Kampanyalar"
        subtitle={`Son ${stats.windowDays} gün · ${totalElements} kampanya`}
        actions={actions}
      />

      <div className={styles.tiles}>
        <Tile
          label="Gönderilen kampanya"
          value={String(stats.sentCampaigns)}
          note={`son ${stats.windowDays} gün`}
        />
        <Tile
          label="Ulaşılan üye"
          value={String(stats.membersReached)}
          note="tekilleştirilmiş"
        />
        {/*
          An em dash, never "%0". Nothing delivered in the window means the rate has no
          denominator, and a nought here would read as "nobody opened it" — which is a
          different and much worse fact than "there was nothing to open".
        */}
        <Tile
          label="Ortalama açılma"
          value={stats.openRate === null ? "—" : `%${stats.openRate}`}
          note="teslim edilenler üzerinden"
        />
        <Tile
          label="Ortalama tıklama"
          value={stats.clickRate === null ? "—" : `%${stats.clickRate}`}
          note="teslim edilenler üzerinden"
        />
      </div>

      <Card>
        {/*
          Status only. The mockup also draws «Tüm kanallar», but only EMAIL exists — the
          backend refuses to create a campaign on any other channel until WhatsApp and
          SMS have their integrations — so a filter with one option is furniture. The
          `channel` parameter is still read above, so the chip appears the day a second
          channel does.
        */}
        <ChipRow>
          <FilterChip href={hrefWith({ status: "", page: "0" })} active={status === ""}>
            Tüm durumlar
          </FilterChip>
          {STATUSES.map((s) => (
            <FilterChip
              key={s}
              href={hrefWith({ status: s, page: "0" })}
              active={status === s}
            >
              {campaignStatusLabel(s)}
            </FilterChip>
          ))}
        </ChipRow>

        {content.length === 0 ? (
          <EmptyState title={status ? "Bu filtreye uyan kampanya yok" : "Henüz kampanya yok"}>
            {status ? (
              <Link href="/campaigns">Filtreyi kaldırın</Link>
            ) : (
              "Bir kampanya, bir segmente gönderilen tek bir e-postadır. Önce segmenti seçin, metni yazın, kendinize test gönderin — sonra gönderin."
            )}
          </EmptyState>
        ) : (
          <>
            <TableWrap>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Kampanya</th>
                    <th>Kanal</th>
                    <th>Segment</th>
                    <th>Gönderim</th>
                    <th className={styles.num}>Alıcı</th>
                    <th className={styles.num}>Açılma</th>
                    <th className={styles.num}>Tıklama</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {content.map((c) => (
                    <Row key={c.id} c={c} />
                  ))}
                </tbody>
              </table>
            </TableWrap>

            <Pagination
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              size={PAGE_SIZE}
              hrefFor={(p) => hrefWith({ page: String(p) })}
              noun="kampanyanın"
            />
          </>
        )}
      </Card>
    </PageBody>
  );
}

function Row({ c }: { c: CampaignListItem }) {
  // A draft has never been sent, so every number on its row is 0 — and a column of
  // noughts reads as "sent to nobody" rather than "not sent yet". Em dashes instead.
  const notYet = c.sentAt === null;
  const num = (n: number) => (notYet ? "—" : String(n));

  return (
    <tr>
      <td>
        <Link href={`/campaigns/${c.id}`} className={ui.rowLink}>
          {c.name}
        </Link>
        {c.subject && <div className={styles.subject}>{c.subject}</div>}
      </td>
      <td>
        <span className={styles.channel}>{campaignChannelLabel(c.channel)}</span>
      </td>
      <td className={styles.segment}>{c.segmentName ?? <span className={ui.faint}>—</span>}</td>
      <td>
        {c.sentAt
          ? formatDayMonth(c.sentAt)
          : c.scheduledAt
            ? formatDayMonth(c.scheduledAt)
            : <span className={ui.faint}>—</span>}
      </td>
      <td className={styles.num}>{num(c.recipientCount)}</td>
      <td className={styles.num}>{num(c.openedCount)}</td>
      <td className={styles.num}>{num(c.clickedCount)}</td>
      <td>
        <Badge tone={toneOf(c.status)}>{campaignStatusLabel(c.status)}</Badge>
      </td>
    </tr>
  );
}

/**
 * Colour by what the reader should do about it.
 *
 * `SENDING` is accented rather than neutral because it is the one state that will change
 * on its own while somebody is looking at the screen.
 */
function toneOf(status: CampaignStatus): "neutral" | "accent" | "good" | "crit" {
  switch (status) {
    case "COMPLETED":
      return "good";
    case "FAILED":
      return "crit";
    case "SCHEDULED":
    case "SENDING":
      return "accent";
    default:
      return "neutral";
  }
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={styles.tile}>
      <p className={styles.tileLabel}>{label}</p>
      <p className={styles.tileValue}>{value}</p>
      <p className={styles.tileNote}>{note}</p>
    </div>
  );
}
