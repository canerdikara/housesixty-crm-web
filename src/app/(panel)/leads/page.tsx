import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Avatar, Badge, ChipRow, EmptyState, FilterChip, Pagination, Tag, TableWrap, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { daysSinceLabel, dueLabel } from "@/lib/dates";
import { leadSourceLabel, leadStatusLabel, leadStatusTone, interestLabel } from "@/lib/labels";
import type { LeadListItem, Paged } from "@/lib/types";

export const metadata = { title: "Adaylar · House Sixty CRM" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/**
 * The saved-filter chips across the top of screen 3.
 *
 * Each is a plain link carrying its own query, not a client-side toggle. The filter is
 * therefore in the URL: a receptionist can bookmark "bugün aranacak", and a manager can
 * send "7 gündür temassız" to someone. It also means no state to keep in sync and no
 * JavaScript needed to change the list.
 */
const CHIPS = [
  { key: "all", label: "Tümü", params: {} as Record<string, string> },
  { key: "mine", label: "Bana atanan", params: { mine: "true" } },
  { key: "due", label: "Bugün aranacak", params: { dueToday: "true" } },
  { key: "stale", label: "7 gündür temassız", params: { staleDays: "7" } },
  { key: "proposal", label: "Teklif bekleyen", params: { status: "PROPOSAL_SENT" } },
];

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const chipKey = one(sp.chip) ?? "all";
  const chip = CHIPS.find((c) => c.key === chipKey) ?? CHIPS[0]!;
  const q = one(sp.q) ?? "";
  const source = one(sp.source) ?? "";
  const status = one(sp.status) ?? "";
  const page = Math.max(0, Number(one(sp.page) ?? 0) || 0);

  // The chip's own params first, so an explicit dropdown selection can override them.
  const query = new URLSearchParams({ ...chip.params });
  if (status) query.set("status", status);
  if (source) query.set("source", source);
  if (q.trim()) query.set("q", q.trim());
  query.set("page", String(page));
  query.set("size", String(PAGE_SIZE));

  const result = await apiRequest<Paged<LeadListItem>>(`/api/v1/crm/leads?${query}`);
  if (result.kind === "unauthorized") redirect("/login");

  /** Rebuilds this screen's URL, preserving everything except what changed. */
  const hrefWith = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const base: Record<string, string> = {
      chip: chipKey === "all" ? "" : chipKey,
      q,
      source,
      status,
      page: String(page),
    };
    for (const [k, v] of Object.entries({ ...base, ...patch })) {
      if (v) next.set(k, v);
    }
    // Any change other than paging returns to the first page. Staying on page 4 of a
    // list that now has one page shows an empty table and looks like no results.
    if (!("page" in patch)) next.delete("page");
    const s = next.toString();
    return s ? `/leads?${s}` : "/leads";
  };

  return (
    <PageBody>
      <PageHeader
        title="Adaylar"
        subtitle={
          result.kind === "ok"
            ? `${result.data.totalElements} aday · liste görünümü`
            : "Aday listesi"
        }
        actions={
          <>
            {/*
              A GET form, so searching lands in the URL like every other filter and
              needs no JavaScript. The hidden inputs carry the current filters through,
              which a bare form would otherwise drop.
            */}
            <form method="GET" action="/leads" role="search">
              {chipKey !== "all" && <input type="hidden" name="chip" value={chipKey} />}
              {status && <input type="hidden" name="status" value={status} />}
              {source && <input type="hidden" name="source" value={source} />}
              <input
                className={ui.search}
                type="search"
                name="q"
                defaultValue={q}
                placeholder="İsim, telefon veya e-posta"
                aria-label="Adaylarda ara"
              />
            </form>
            <Link className={`${ui.button} ${ui.buttonGhost}`} href="/leads/pipeline">
              Satış hunisi
            </Link>
            <Link className={ui.button} href="/leads/new">
              + Yeni aday
            </Link>
          </>
        }
      />

      <ChipRow>
        {CHIPS.map((c) => (
          <FilterChip
            key={c.key}
            href={hrefWith({ chip: c.key === "all" ? "" : c.key, page: undefined })}
            active={c.key === chipKey}
          >
            {c.label}
          </FilterChip>
        ))}
      </ChipRow>

      <Card>
        {result.kind === "forbidden" ? (
          <EmptyState title="Bu alanı görüntüleme yetkiniz yok">{result.message}</EmptyState>
        ) : result.kind === "error" ? (
          <EmptyState title="Liste yüklenemedi">{result.message}</EmptyState>
        ) : result.data.content.length === 0 ? (
          <EmptyState title="Aday bulunamadı">
            {q || status || source || chipKey !== "all"
              ? "Bu filtrelere uyan aday yok. Filtreleri temizleyip tekrar deneyin."
              : "Web sitesi formundan gelen adaylar burada listelenecek."}
          </EmptyState>
        ) : (
          <>
            <TableWrap>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Ad Soyad</th>
                    <th>Telefon</th>
                    <th>Kaynak</th>
                    <th>Durum</th>
                    <th>İlgi</th>
                    <th>Sorumlu</th>
                    <th>Son temas</th>
                    <th>Sonraki adım</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.content.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <Link className={ui.rowLink} href={`/leads/${lead.id}`}>
                          {lead.fullName}
                        </Link>
                      </td>
                      {/* tnum so the digits form a scannable column instead of a ragged one. */}
                      <td className={`${ui.muted} ${ui.nowrap} tnum`}>{lead.phone ?? "—"}</td>
                      <td><Tag muted>{leadSourceLabel(lead.source)}</Tag></td>
                      <td>
                        <Badge tone={leadStatusTone(lead.status)}>
                          {leadStatusLabel(lead.status)}
                        </Badge>
                      </td>
                      <td>{lead.interestedIn ? <Tag>{interestLabel(lead.interestedIn)}</Tag> : <span className={ui.faint}>—</span>}</td>
                      <td><Avatar name={lead.ownerName} /></td>
                      <td className={`${ui.muted} ${ui.nowrap}`}>{daysSinceLabel(lead.lastContactAt)}</td>
                      <td className={ui.nowrap}>
                        {lead.nextActionNote ? (
                          <span className={ui.rowAction}>{lead.nextActionNote}</span>
                        ) : lead.nextActionAt ? (
                          <span className={ui.rowAction}>{dueLabel(lead.nextActionAt)}</span>
                        ) : (
                          <span className={ui.faint}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>

            <Pagination
              page={result.data.page}
              totalPages={result.data.totalPages}
              totalElements={result.data.totalElements}
              size={result.data.size}
              noun="adayın"
              hrefFor={(p) => hrefWith({ page: String(Math.max(0, p)) })}
            />
          </>
        )}
      </Card>
    </PageBody>
  );
}
