import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { ChipRow, FilterChip, TableWrap, EmptyState, Pagination, Badge } from "@/components/ui";
import ui from "@/components/ui.module.css";
import { apiRequest } from "@/lib/api";
import { readSession } from "@/lib/session";
import { canWriteMembers } from "@/lib/roles";
import { renewalStatusLabel } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { Paged, RenewalListItem, RenewalStats } from "@/lib/types";
import { RenewalActions } from "./RenewalActions";

export const metadata = { title: "Yenilemeler · House Sixty CRM" };

const PAGE_SIZE = 20;

/**
 * Windows across the top.
 *
 * "Süresi geçmiş" is a different endpoint, not a negative `withinDays`: those members
 * have already lapsed, and mixing them into the list of people still worth ringing this
 * week is how the savable ones get buried.
 */
const CHIPS = [
  { key: "30", label: "30 gün", overdue: false, days: 30 },
  { key: "90", label: "90 gün", overdue: false, days: 90 },
  { key: "365", label: "1 yıl", overdue: false, days: 365 },
  { key: "overdue", label: "Süresi geçmiş", overdue: true, days: 90 },
] as const;

const STATUS_FILTERS = [
  ["", "Tüm durumlar"],
  ["NOT_CONTACTED", "Görüşülmedi"],
  ["CONTACTED", "Görüşüldü"],
  ["PROPOSAL_SENT", "Teklif gönderildi"],
  ["RENEWED", "Yenilendi"],
  ["DECLINED", "Yenilemedi"],
] as const;

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** How urgent the row is, as a badge tone. Negative days means already lapsed. */
function urgency(days: number): { tone: "crit" | "accent" | "neutral"; text: string } {
  if (days < 0) return { tone: "crit", text: `${Math.abs(days)} gün geçti` };
  if (days === 0) return { tone: "crit", text: "Bugün" };
  if (days <= 14) return { tone: "crit", text: `${days} gün` };
  if (days <= 30) return { tone: "accent", text: `${days} gün` };
  return { tone: "neutral", text: `${days} gün` };
}

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const chipKey = one(sp.chip) ?? "30";
  const chip = CHIPS.find((c) => c.key === chipKey) ?? CHIPS[0];
  const status = one(sp.status) ?? "";
  const page = Math.max(0, Number(one(sp.page) ?? 0) || 0);

  const query = new URLSearchParams();
  query.set(chip.overdue ? "sinceDays" : "withinDays", String(chip.days));
  if (status) query.set("renewalStatus", status);
  query.set("page", String(page));
  query.set("size", String(PAGE_SIZE));

  const path = chip.overdue ? "/api/v1/crm/renewals/overdue" : "/api/v1/crm/renewals";

  // Both in one pass. The summary is four numbers above a list that is already being
  // fetched; a second round trip triggered from the client would make the tiles arrive
  // after the thing they summarise.
  const [listResult, statsResult, session] = await Promise.all([
    apiRequest<Paged<RenewalListItem>>(`${path}?${query}`),
    apiRequest<RenewalStats>("/api/v1/crm/renewals/stats"),
    readSession(),
  ]);

  if (listResult.kind === "unauthorized" || statsResult.kind === "unauthorized") {
    redirect("/login");
  }

  const canWrite = canWriteMembers(session?.user.role);
  const stats = statsResult.kind === "ok" ? statsResult.data : null;

  const hrefWith = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const base: Record<string, string> = {
      chip: chipKey === "30" ? "" : chipKey,
      status,
      page: String(page),
    };
    for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) next.set(k, v);
    // Anything but paging returns to page one, or a narrowed filter lands on page 3 of a
    // one-page list and reads as "no results".
    if (!("page" in patch)) next.delete("page");
    const s = next.toString();
    return s ? `/renewals?${s}` : "/renewals";
  };

  return (
    <PageBody>
      <PageHeader
        title="Yenilemeler"
        subtitle={
          listResult.kind === "ok"
            ? `${listResult.data.totalElements} dönem`
            : "Üyelik bitişi yaklaşan üyeler"
        }
        actions={
          <form method="GET" action="/renewals">
            {chipKey !== "30" && <input type="hidden" name="chip" value={chipKey} />}
            <select name="status" className={ui.select} defaultValue={status}>
              {STATUS_FILTERS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <noscript>
              <button type="submit" className={ui.button}>Filtrele</button>
            </noscript>
          </form>
        }
      />

      {stats && (
        <Card>
          <div className={ui.chipRow}>
            <Stat label="30 gün içinde" value={String(stats.expiringWithin30Days)} />
            <Stat label="90 gün içinde" value={String(stats.expiringWithin90Days)} />
            <Stat label="Görüşülmedi" value={String(stats.notContacted)} />
            <Stat
              label="Yenileme oranı"
              // Null and zero are different facts: nothing has ended yet versus nobody
              // renewed. Rendering the first as "%0" invents a crisis.
              value={stats.renewalRate === null ? "—" : `%${stats.renewalRate}`}
            />
          </div>
          {stats.renewalRate === null && (
            <p className={ui.muted}>
              Henüz süresi dolan dönem yok — oran, ilk dönemler bittiğinde hesaplanır.
            </p>
          )}
        </Card>
      )}

      <ChipRow>
        {CHIPS.map((c) => (
          <FilterChip
            key={c.key}
            href={hrefWith({ chip: c.key === "30" ? "" : c.key })}
            active={c.key === chipKey}
          >
            {c.label}
          </FilterChip>
        ))}
      </ChipRow>

      {listResult.kind !== "ok" ? (
        <EmptyState title="Liste alınamadı">
          {listResult.kind === "forbidden"
            ? "Bu alanı görme yetkiniz yok."
            : listResult.message}
        </EmptyState>
      ) : listResult.data.content.length === 0 ? (
        <EmptyState title="Bu aralıkta yenileme yok">
          {chip.overdue
            ? "Süresi geçmiş dönem bulunmuyor."
            : "Seçilen aralıkta bitişi yaklaşan üyelik yok."}
        </EmptyState>
      ) : (
        <>
          <TableWrap>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Üye</th>
                  <th>Üyelik</th>
                  <th>Bitiş</th>
                  <th>Kalan</th>
                  <th>Durum</th>
                  <th>Son temas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {listResult.data.content.map((r: RenewalListItem) => {
                  const u = urgency(r.daysUntilEnd);
                  return (
                    <tr key={r.termId}>
                      <td>
                        <a className={ui.rowLink} href={`/members/${r.userId}`}>
                          {r.fullName}
                        </a>
                        <div className={ui.faint}>
                          {/* The phone is the point of this screen — somebody reads it
                              with a handset. A tel: link so a desk phone or a mobile can
                              dial it without transcription. */}
                          {r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : r.email}
                        </div>
                      </td>
                      <td>{r.membershipType}</td>
                      <td className={ui.nowrap}>{formatDate(r.endDate)}</td>
                      <td className={ui.nowrap}>
                        <Badge tone={u.tone}>{u.text}</Badge>
                      </td>
                      <td>
                        {renewalStatusLabel(r.renewalStatus)}
                        {r.renewalNote && <div className={ui.faint}>{r.renewalNote}</div>}
                      </td>
                      <td className={ui.nowrap}>
                        {r.lastRenewalContactAt ? (
                          formatDateTime(r.lastRenewalContactAt)
                        ) : (
                          <span className={ui.muted}>—</span>
                        )}
                      </td>
                      <td>
                        <RenewalActions row={r} canWrite={canWrite} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>

          <Pagination
            page={listResult.data.page}
            totalPages={listResult.data.totalPages}
            totalElements={listResult.data.totalElements}
            size={listResult.data.size}
            hrefFor={(p: number) => hrefWith({ page: String(p) })}
            noun="dönem"
          />
        </>
      )}
    </PageBody>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={ui.chip}>
      <span className={ui.muted}>{label}</span> <strong>{value}</strong>
    </div>
  );
}
