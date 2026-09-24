import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Badge, EmptyState, Pagination, TableWrap, Tag, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import { campaignChannelLabel, campaignStatusLabel, deliveryStateLabel } from "@/lib/labels";
import { canWriteCampaigns } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type {
  CampaignDetail,
  CampaignRecipient,
  DeliveryState,
  Paged,
} from "@/lib/types";
import { CampaignActions } from "../CampaignActions";
import styles from "../campaigns.module.css";

export const dynamic = "force-dynamic";

/**
 * Rows per page in the recipients card.
 *
 * Thirteen is the mockup's own number, and it is also roughly what keeps this card the
 * same height as the message beside it — the two are a pair on screen and one of them
 * running a thousand pixels past the other is what the first screenshot showed.
 */
const RECIPIENTS_PER_PAGE = 13;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiRequest<CampaignDetail>(`/api/v1/crm/campaigns/${id}`);
  return {
    title: result.kind === "ok"
      ? `${result.data.campaign.name} · House Sixty CRM`
      : "Kampanya · House Sixty CRM",
  };
}

/**
 * «Kampanya Sonucu» — mockup screen 12.
 *
 * The funnel, the message as it went out, and the per-recipient result. A campaign that
 * has *not* gone out yet renders the same screen with the funnel empty and the actions
 * panel in its place, rather than being a second screen — the thing somebody is looking
 * at is the same campaign either way, and two layouts for it would drift.
 *
 * ## The one thing on this screen that is a security decision
 *
 * The body is rendered as **text, not HTML** — see the note on the envelope below.
 */
export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const raw = Array.isArray(sp.rpage) ? sp.rpage[0] : sp.rpage;
  const rpage = Math.max(0, Number.parseInt(raw ?? "0", 10) || 0);

  /*
   * Recipients are fetched separately from the campaign, not read off the detail
   * payload's first page.
   *
   * The detail response carries a preview so the screen has something the moment it
   * opens, but a sent campaign has as many rows as the club has members, and a card that
   * simply printed all of them ran a thousand pixels past the card beside it. Paging
   * here is also what finally uses `GET /crm/campaigns/{id}/recipients`, which the
   * backend has and nothing was calling.
   */
  const [result, recipientsResult, session] = await Promise.all([
    apiRequest<CampaignDetail>(`/api/v1/crm/campaigns/${id}`),
    apiRequest<Paged<CampaignRecipient>>(
      `/api/v1/crm/campaigns/${id}/recipients?page=${rpage}&size=${RECIPIENTS_PER_PAGE}`
    ),
    readSession(),
  ]);
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind === "error" && result.status === 404) notFound();

  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader
          title="Kampanya"
          subtitle={<Link href="/campaigns">Kampanyalar</Link>}
        />
        <Card>
          <EmptyState
            title={
              result.kind === "forbidden"
                ? "Bu kampanyayı görüntüleme yetkiniz yok"
                : "Kampanya yüklenemedi"
            }
          >
            {result.message}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const detail = result.data;
  const { campaign, funnel, body } = detail;
  // Falls back to the detail payload's preview if the paged call failed on its own —
  // one card failing to load must not take the funnel and the copy down with it.
  const recipientPage = recipientsResult.kind === "ok" ? recipientsResult.data : null;
  const recipients = recipientPage?.content ?? detail.recipients;
  const canWrite = canWriteCampaigns(session?.user.role);
  const sent = campaign.sentAt !== null;

  return (
    <PageBody>
      <PageHeader
        title={sent ? "Kampanya Sonucu" : "Kampanya"}
        subtitle={
          <>
            <Link href="/campaigns">Kampanyalar</Link> › {campaign.name}
          </>
        }
      />

      <Card>
        <div className={styles.head}>
          {/* The mockup's square mark. The channel's initial, which is the one thing
              about a campaign that is true at a glance from across a desk. */}
          <div className={styles.mark} aria-hidden="true">
            {campaignChannelLabel(campaign.channel).charAt(0)}
          </div>

          <div className={styles.headMain}>
            <h2 className={styles.headName}>{campaign.name}</h2>
            <p className={styles.headMeta}>
              {campaignChannelLabel(campaign.channel)}
              {campaign.segmentName ? ` · Segment: ${campaign.segmentName}` : " · Segment seçilmedi"}
              {campaign.sentAt
                ? ` · ${formatDateTime(campaign.sentAt)}`
                : campaign.scheduledAt
                  ? ` · ${formatDateTime(campaign.scheduledAt)} için zamanlandı`
                  : ""}
            </p>
            <div className={styles.headTags}>
              <Badge tone={campaign.status === "FAILED" ? "crit" : sent ? "good" : "neutral"}>
                {campaignStatusLabel(campaign.status)}
              </Badge>
              {sent ? (
                <Tag>{funnel.sent} alıcı</Tag>
              ) : detail.audiencePreview !== null ? (
                <Tag muted>{detail.audiencePreview} üyelik segment</Tag>
              ) : null}
              {funnel.suppressed > 0 && <Tag muted>{funnel.suppressed} izinsiz</Tag>}
            </div>
          </div>

          {sent && (
            <div className={styles.headRates}>
              <Rate value={funnel.openRate} label="açılma" />
              <Rate value={funnel.clickRate} label="tıklama" />
            </div>
          )}
        </div>
      </Card>

      {sent ? (
        <Card>
          <h2 className={styles.cardTitle}>Dönüşüm</h2>
          <p className={styles.cardSub}>Gönderimden tıklamaya</p>

          {/*
            Four stages, not the mockup's five. The fifth is "Rezervasyon yaptı", which
            needs campaign attribution — counting the bookings a recipient happens to make
            after a send would credit the campaign for every reservation a club full of
            members was going to make anyway. Four measured numbers beat five where one is
            a guess.
          */}
          <div className={styles.funnel}>
            <Stage n={funnel.sent} of={funnel.sent} label="Gönderildi" tone="--o2" />
            <Stage n={funnel.delivered} of={funnel.sent} label="Teslim edildi" tone="--o3" pct={funnel.deliveryRate} />
            <Stage n={funnel.opened} of={funnel.sent} label="Açıldı" tone="--o4" pct={funnel.openRate} />
            <Stage n={funnel.clicked} of={funnel.sent} label="Tıklandı" tone="--o5" pct={funnel.clickRate} />
          </div>

          {(funnel.suppressed > 0 || funnel.bounced > 0 || funnel.failed > 0) && (
            <p className={styles.suppressNote}>
              {funnel.suppressed > 0 && (
                <>
                  <strong>{funnel.suppressed} üyeye gönderilmedi</strong> — e-posta izinleri
                  yok. Bu kişiler yukarıdaki sayılara dâhil değildir.{" "}
                </>
              )}
              {funnel.bounced > 0 && <>{funnel.bounced} e-posta geri döndü. </>}
              {funnel.failed > 0 && <>{funnel.failed} gönderim başarısız oldu. </>}
            </p>
          )}
        </Card>
      ) : (
        canWrite && (
          <Card>
            <h2 className={styles.cardTitle}>Gönderim</h2>
            <p className={styles.cardSub}>
              Bu kampanya henüz gönderilmedi. Gönderim geri alınamaz.
            </p>
            <CampaignActions detail={detail} />
          </Card>
        )
      )}

      <div className={styles.split}>
        <Card>
          <h2 className={styles.cardTitle}>
            {sent ? "Gönderilen içerik" : "İçerik"}
          </h2>
          <p className={styles.cardSub}>Kişiselleştirme alanı: ad</p>

          <div className={styles.envelope}>
            <div className={styles.envelopeHead}>
              <span className={styles.envelopeKey}>Konu</span>
              <span className={styles.envelopeValue}>
                {campaign.subject ?? <span className={ui.faint}>—</span>}
              </span>
            </div>
            {/*
              ⚠️ Rendered as TEXT, never as HTML.

              The body is HTML and goes out as HTML, but `dangerouslySetInnerHTML` here
              would run it inside an authenticated panel session — and the reader of this
              screen is, by §6, an ADMIN or MARKETING user whose session can read the
              KVKK consent log. The copy is written by staff, but it is stored and
              re-served, and one pasted snippet from a template somebody found online is
              all it takes. Showing the source is also more useful: this is the screen
              where you check that `{ad}` is spelled right.
            */}
            <pre className={styles.envelopeBody}>
              {body ?? "— içerik yok —"}
            </pre>
          </div>

          <p className={styles.mergeNote}>
            Üyeye giderken <code>{"{ad}"}</code> adıyla değiştirilir ve en alta
            abonelikten çıkma bağlantısı eklenir.
          </p>
        </Card>

        <Card>
          <h2 className={styles.cardTitle}>Alıcılar</h2>
          <p className={styles.cardSub}>
            {recipients.length === 0 ? "Henüz alıcı yok" : "Alıcı bazında sonuç"}
          </p>

          {recipients.length === 0 ? (
            <EmptyState title="Gönderim yapılmadı">
              Alıcı listesi gönderim anında segmentten hesaplanır ve o anda buraya yazılır.
            </EmptyState>
          ) : (
            <TableWrap>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Üye</th>
                    <th>Durum</th>
                    <th>Açılma</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <RecipientRow key={r.id} r={r} />
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}

          {recipientPage && recipientPage.totalElements > 0 && (
            <Pagination
              page={recipientPage.page}
              totalPages={recipientPage.totalPages}
              totalElements={recipientPage.totalElements}
              size={recipientPage.size}
              hrefFor={(p) => `/campaigns/${campaign.id}${p > 0 ? `?rpage=${p}` : ""}`}
              noun="alıcının"
            />
          )}
        </Card>
      </div>
    </PageBody>
  );
}

function RecipientRow({ r }: { r: CampaignRecipient }) {
  return (
    <tr>
      <td>
        {r.userId ? (
          <Link href={`/members/${r.userId}`} className={ui.rowLink}>
            {r.fullName ?? r.address}
          </Link>
        ) : (
          (r.fullName ?? r.address)
        )}
        <div className={styles.address}>{r.address}</div>
        {r.failureReason && <div className={styles.reason}>{r.failureReason}</div>}
      </td>
      <td>
        <Badge tone={stateTone(r.state)}>{deliveryStateLabel(r.state)}</Badge>
      </td>
      <td className={ui.nowrap}>
        {r.clickedAt
          ? formatDateTime(r.clickedAt)
          : r.openedAt
            ? formatDateTime(r.openedAt)
            : <span className={ui.faint}>—</span>}
      </td>
    </tr>
  );
}

/**
 * ⚠️ `SUPPRESSED` is deliberately **neutral, not crit**.
 *
 * Nothing went wrong: the club honoured a withdrawn consent, which is the system working.
 * Colouring it red beside a genuine bounce would teach whoever reads this screen weekly
 * that respecting an opt-out is a fault to be cleared.
 */
function stateTone(state: DeliveryState): "neutral" | "accent" | "good" | "crit" {
  switch (state) {
    case "OPENED":
    case "CLICKED":
      return "good";
    case "BOUNCED":
    case "FAILED":
      return "crit";
    case "DELIVERED":
    case "SENT":
      return "accent";
    default:
      return "neutral";
  }
}

function Rate({ value, label }: { value: number | null; label: string }) {
  return (
    <div className={styles.rate}>
      {/* Em dash, never "%0" — a rate with no denominator is not nought per cent. */}
      <p className={styles.rateValue}>{value === null ? "—" : `%${value}`}</p>
      <p className={styles.rateLabel}>{label}</p>
    </div>
  );
}

function Stage({
  n,
  of,
  label,
  tone,
  pct,
}: {
  n: number;
  of: number;
  label: string;
  tone: string;
  pct?: number | null;
}) {
  return (
    <div>
      <span className={styles.stageTrack}>
        <span
          className={styles.stageFill}
          style={{
            width: of === 0 ? "0%" : `${Math.round((n / of) * 100)}%`,
            background: `var(${tone})`,
          }}
        />
      </span>
      <p className={styles.stageValue}>{n}</p>
      <p className={styles.stageLabel}>
        {label}
        {pct !== undefined && pct !== null && <span className={styles.stagePct}>%{pct}</span>}
      </p>
    </div>
  );
}
