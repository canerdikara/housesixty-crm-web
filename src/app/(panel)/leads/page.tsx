import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Avatar, Badge, ChipRow, EmptyState, FilterChip, Pagination, Tag, TableWrap, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { daysSinceLabel, dueLabel } from "@/lib/dates";
import {
  leadSourceLabel,
  leadStatusLabel,
  leadStatusTone,
  interestLabel,
  LEAD_STATUS_ORDER,
  LEAD_SOURCES,
} from "@/lib/labels";
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

/**
 * The one chip that sets the same parameter as a dropdown.
 *
 * «Teklif bekleyen» *is* a status filter, so it and the «Durum» select are two controls
 * over one value — unlike «Sorumlu», where the chip and the dropdown reach the backend
 * through different parameters (`mine` versus `ownerUserId`). Named here so the two places
 * that have to know about the overlap cannot drift apart.
 */
const PROPOSAL_CHIP_STATUS = "PROPOSAL_SENT";

/**
 * The dropdown's sentinel for "nobody owns this".
 *
 * Not a real id, and it must not collide with one — the backend takes `unassigned=true`
 * as a separate parameter from `ownerUserId`, so this value is translated rather than
 * forwarded.
 */
const OWNER_UNASSIGNED = "unassigned";

type PanelUser = { id: string; fullName: string; role: string };

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
  /** "" · "unassigned" · a panel user's id. See OWNER_UNASSIGNED. */
  const owner = one(sp.owner) ?? "";
  const page = Math.max(0, Number(one(sp.page) ?? 0) || 0);

  // The chip's own params first, so an explicit dropdown selection can override them.
  const query = new URLSearchParams({ ...chip.params });
  if (status) query.set("status", status);
  if (source) query.set("source", source);

  /*
   * «Sorumlu» and the "Bana atanan" chip are two ways of asking the same question, and
   * the backend resolves `mine` *instead of* `ownerUserId` — so sending both would make
   * the chip silently win and the dropdown appear broken. An explicit choice from the
   * dropdown is the more specific statement, so it takes precedence and `mine` is
   * dropped; the chip is de-highlighted below to match.
   */
  if (owner) {
    query.delete("mine");
    if (owner === OWNER_UNASSIGNED) query.set("unassigned", "true");
    else query.set("ownerUserId", owner);
  }

  if (q.trim()) query.set("q", q.trim());
  query.set("page", String(page));
  query.set("size", String(PAGE_SIZE));

  // Both in one round trip. The owner list is small and cached by nothing, but it is a
  // single indexed read and the page cannot render its filter without it.
  const [result, owners] = await Promise.all([
    apiRequest<Paged<LeadListItem>>(`/api/v1/crm/leads?${query}`),
    apiRequest<PanelUser[]>("/api/v1/crm/users"),
  ]);
  if (result.kind === "unauthorized") redirect("/login");

  // A failure here costs the dropdown its names, not the page its list.
  const ownerOptions = owners.kind === "ok" ? owners.data : [];

  /*
   * A chip cannot be highlighted while a dropdown is overriding it.
   *
   * Two separate collisions, and the status one is narrower than the owner one. Any owner
   * selection beats the "Bana atanan" chip, because the backend resolves `mine` instead of
   * `ownerUserId` and the two cannot both apply. The status select beats «Teklif bekleyen»
   * only when it asks for something *else*: selecting PROPOSAL_SENT explicitly is the same
   * filter the chip applies, and de-highlighting it there would un-light the chip the
   * moment somebody typed in the search box, with the list unchanged.
   */
  const activeChip =
    owner && chipKey === "mine"
      ? "all"
      : status && status !== PROPOSAL_CHIP_STATUS && chipKey === "proposal"
        ? "all"
        : chipKey;

  /** Rebuilds this screen's URL, preserving everything except what changed. */
  const hrefWith = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const base: Record<string, string> = {
      chip: chipKey === "all" ? "" : chipKey,
      q,
      source,
      status,
      owner,
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
            <form method="GET" action="/leads" role="search" className={ui.filterForm}>
              {chipKey !== "all" && <input type="hidden" name="chip" value={chipKey} />}
              <input
                className={ui.search}
                type="search"
                name="q"
                defaultValue={q}
                placeholder="İsim, telefon veya e-posta"
                aria-label="Adaylarda ara"
              />
              {/*
                «Durum» and «Kaynak» — both have been read from the URL, applied to the
                query and preserved across chips and paging since phase 1, and until now
                nothing on the screen could set either. They were hidden inputs here,
                carrying a value only a hand-typed URL could ever have put there.

                «Durum» shows the chip's own status when «Teklif bekleyen» is lit, so the
                control never contradicts the filter that is actually in force.
              */}
              <select
                className={ui.select}
                name="status"
                defaultValue={status || (chip.params.status ?? "")}
                aria-label="Duruma göre filtrele"
              >
                <option value="">Tüm durumlar</option>
                {/* Pipeline order, not alphabetical — this is the sales process. */}
                {LEAD_STATUS_ORDER.map((v) => (
                  <option key={v} value={v}>{leadStatusLabel(v)}</option>
                ))}
              </select>
              <select
                className={ui.select}
                name="source"
                defaultValue={source}
                aria-label="Kaynağa göre filtrele"
              >
                <option value="">Tüm kaynaklar</option>
                {LEAD_SOURCES.map((v) => (
                  <option key={v} value={v}>{leadSourceLabel(v)}</option>
                ))}
              </select>
              {/*
                A plain <select> in the same GET form as the search box, so picking an
                owner lands in the URL exactly like every other filter on this screen —
                bookmarkable, shareable, and needing no JavaScript. That is why there is
                a visible submit button rather than an onChange handler: submitting on
                change would make this the one control on the page that requires a
                client component.
              */}
              <select
                className={ui.select}
                name="owner"
                defaultValue={owner}
                aria-label="Sorumluya göre filtrele"
              >
                <option value="">Tüm sorumlular</option>
                {/* First, and deliberately: "nobody has picked this up" is the most
                    actionable state on the screen. */}
                <option value={OWNER_UNASSIGNED}>Atanmamış</option>
                {ownerOptions.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
              <button type="submit" className={`${ui.button} ${ui.buttonGhost}`}>
                Filtrele
              </button>
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
            /*
             * «Teklif bekleyen» drops any explicit status on its way in; every other chip
             * preserves the filters, as they always have. Without this the chip is dead
             * whenever the select holds a different status: `hrefWith` would carry that
             * status forward and it overrides the chip's own params, so clicking would
             * change the highlight and nothing else.
             */
            href={hrefWith({
              chip: c.key === "all" ? "" : c.key,
              page: undefined,
              ...(c.key === "proposal" ? { status: undefined } : {}),
            })}
            active={c.key === activeChip}
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
            {q || status || source || owner || chipKey !== "all"
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
                      {/*
                        The stale flag rides in the column that already answers "when did
                        anyone last speak to this person" rather than taking a ninth one.
                        The badge is what the daily sweep is *for*: the "7 gündür temassız"
                        chip could always find these leads, but only if somebody remembered
                        to click it — here it is on the row, unasked.
                      */}
                      <td className={ui.nowrap}>
                        <span className={ui.muted}>{daysSinceLabel(lead.lastContactAt)}</span>
                        {lead.staleFlaggedAt && (
                          <>
                            {" "}
                            {/*
                              `accent`, not `crit`. This screen reserves the two status
                              colours for the two outcomes — `leadStatusTone` gives `good`
                              to WON and `crit` to LOST and nothing else — so a red badge
                              here would read as a lost lead in the column beside the one
                              that says otherwise. It also scales: the first sweep flags
                              most of the table at once, and a page of red says "everything
                              is wrong" rather than "nobody has rung these people".
                            */}
                            <Badge tone="accent">soğuk</Badge>
                          </>
                        )}
                      </td>
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
