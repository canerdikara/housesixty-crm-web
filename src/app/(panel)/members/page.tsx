import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Badge, ChipRow, EmptyState, FilterChip, Pagination, Tag, TableWrap, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { daysSinceLabel, formatDate } from "@/lib/dates";
import type { MemberListItem, MembershipTier, Paged } from "@/lib/types";

export const metadata = { title: "Üyeler · House Sixty CRM" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/**
 * The saved-filter chips from mockup screen 6.
 *
 * Links carrying their own query, like the lead screen — the filter lives in the URL,
 * so "riskli üyeler" is bookmarkable and sendable, and none of it needs JavaScript.
 *
 * All five of the mockup's chips are here now. **"Misafir getiren" is 180 days**, matching
 * `guest_count_6m` in the segment builder so the chip and any segment written on the same
 * idea return the same people — six months is what "misafir getiren" means on this screen,
 * and a member who brought somebody two years ago is not the club's introducer.
 */
const CHIPS = [
  { key: "all", label: "Tümü", params: {} as Record<string, string> },
  { key: "renewing", label: "Yenilemesi yaklaşan", params: { renewingWithinDays: "30" } },
  { key: "risky", label: "Riskli", params: { atRisk: "true" } },
  { key: "new", label: "Yeni · 90 gün", params: { newWithinDays: "90" } },
  { key: "guests", label: "Misafir getiren", params: { broughtGuestWithinDays: "180" } },
];

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const chipKey = one(sp.chip) ?? "all";
  const chip = CHIPS.find((c) => c.key === chipKey) ?? CHIPS[0]!;
  const q = one(sp.q) ?? "";
  const membershipType = one(sp.membershipType) ?? "";
  // «Durum» — "" is every member, "risky" and "active" are the two halves.
  const durum = one(sp.durum) ?? "";
  const page = Math.max(0, Number(one(sp.page) ?? 0) || 0);

  // The chip's own params first, so an explicit dropdown selection can override them —
  // the same precedence the leads screen uses.
  const query = new URLSearchParams({ ...chip.params });
  if (q.trim()) query.set("q", q.trim());
  if (membershipType) query.set("membershipType", membershipType);
  if (durum === "risky") query.set("atRisk", "true");
  else if (durum === "active") query.set("atRisk", "false");
  query.set("page", String(page));
  query.set("size", String(PAGE_SIZE));

  /*
   * ⚠️ `/crm/membership-tiers`, not `/admin/membership-tiers`.
   *
   * The admin one is gated to ADMIN alone, and this screen is open to all four panel
   * roles — pointing the filter at it would give SALES and RECEPTION a 403 and a dropdown
   * with no options, which reads as "the club has no tiers" rather than "you may not see
   * them".
   *
   * Fetched alongside the list rather than before it: a failure here costs the dropdown
   * its options, not the page its members.
   */
  const [result, tiers] = await Promise.all([
    apiRequest<Paged<MemberListItem>>(`/api/v1/crm/members?${query}`),
    apiRequest<MembershipTier[]>("/api/v1/crm/membership-tiers"),
  ]);
  if (result.kind === "unauthorized") redirect("/login");
  const tierOptions = tiers.kind === "ok" ? tiers.data : [];

  /*
   * ⚠️ «Riskli» the chip and «Durum» the select are two controls over one value.
   *
   * The leads screen hit exactly this with «Teklif bekleyen» (§1u), and the resolution is
   * the same: the select wins, and the chip un-lights only when the select asks for
   * something *else*. Choosing «Riskli» in the dropdown is the same filter the chip
   * applies, so de-highlighting it there would un-light the chip the moment somebody
   * typed in the search box, with the list unchanged.
   */
  const activeChip = durum && durum !== "risky" && chipKey === "risky" ? "all" : chipKey;

  const hrefWith = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const base: Record<string, string> = {
      chip: chipKey === "all" ? "" : chipKey,
      q,
      membershipType,
      durum,
      page: String(page),
    };
    for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) next.set(k, v);
    // Anything but paging goes back to page one — otherwise a narrowed filter lands on
    // page 4 of a one-page list and reads as "no results".
    if (!("page" in patch)) next.delete("page");
    const s = next.toString();
    return s ? `/members?${s}` : "/members";
  };

  return (
    <PageBody>
      <PageHeader
        title="Üyeler"
        subtitle={
          result.kind === "ok" ? `${result.data.totalElements} aktif üye` : "Üye listesi"
        }
        actions={
          <form method="GET" action="/members" role="search" className={ui.filterForm}>
            {chipKey !== "all" && <input type="hidden" name="chip" value={chipKey} />}
            <input
              className={ui.search}
              type="search"
              name="q"
              defaultValue={q}
              placeholder="İsim, telefon veya e-posta"
              aria-label="Üyelerde ara"
            />
            {/*
              «Üyelik» — the tier. The parameter has been read, applied and carried through
              chips and paging since phase 2, and until now nothing on the screen could set
              it: it was a hidden input here, holding a value only a hand-typed URL could
              have put there. Same story as «Durum»/«Kaynak» on the leads list.

              Filtered by **name**, not id, because that is what `GET /crm/members` takes —
              `membershipType` matches `m.tier.name`.
            */}
            <select
              className={ui.select}
              name="membershipType"
              defaultValue={membershipType}
              aria-label="Üyeliğe göre filtrele"
            >
              <option value="">Tüm üyelikler</option>
              {tierOptions.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
            {/*
              «Durum». Shows the chip's own value when «Riskli» is lit, so the control
              never contradicts the filter actually in force.

              ⚠️ «Aktif» returns **nobody on production today**, and that is correct rather
              than broken: "Riskli" means no turnstile pass in 45 days, no pass has ever
              been recorded, so every member is risky by the rule's own definition. It
              starts meaning something the day the gate is wired.
            */}
            <select
              className={ui.select}
              name="durum"
              defaultValue={durum || (chipKey === "risky" ? "risky" : "")}
              aria-label="Duruma göre filtrele"
            >
              <option value="">Tüm durumlar</option>
              <option value="active">Aktif</option>
              <option value="risky">Riskli</option>
            </select>
            <button type="submit" className={`${ui.button} ${ui.buttonGhost}`}>
              Filtrele
            </button>
          </form>
        }
      />

      <ChipRow>
        {CHIPS.map((c) => (
          <FilterChip
            key={c.key}
            href={hrefWith({ chip: c.key === "all" ? "" : c.key, page: undefined })}
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
          <EmptyState title="Üye bulunamadı">
            {q || chipKey !== "all" || membershipType || durum
              ? "Bu filtrelere uyan üye yok."
              : "Aktif üye kaydı bulunamadı."}
          </EmptyState>
        ) : (
          <>
            <TableWrap>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Üye</th>
                    <th>Üyelik</th>
                    <th>Başlangıç</th>
                    <th>Bitiş</th>
                    <th>Son ziyaret</th>
                    <th>Ziyaret · 30g</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.content.map((m) => (
                    <tr key={m.userId}>
                      <td>
                        <Link className={ui.rowLink} href={`/members/${m.userId}`}>
                          {m.fullName}
                        </Link>
                      </td>
                      <td>
                        {m.membershipType ? (
                          <Tag>{m.membershipType}</Tag>
                        ) : (
                          <span className={ui.faint}>—</span>
                        )}
                      </td>
                      <td className={`${ui.muted} ${ui.nowrap}`}>{formatDate(m.membershipStart)}</td>
                      <td className={`${ui.muted} ${ui.nowrap}`}>{formatDate(m.membershipEnd)}</td>
                      <td className={`${ui.muted} ${ui.nowrap}`}>{daysSinceLabel(m.lastVisitAt)}</td>
                      <td className={`${ui.muted} tnum`}>{m.visitCount30d}</td>
                      <td>
                        {/*
                          The word carries the meaning; the colour only reinforces it.
                          "Riskli" is computed on the server so this screen, the
                          dashboard and the segment cannot disagree about the threshold.
                        */}
                        <Badge tone={m.atRisk ? "crit" : "good"}>
                          {m.atRisk ? "Riskli" : "Aktif"}
                        </Badge>
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
              noun="üyenin"
              hrefFor={(p) => hrefWith({ page: String(Math.max(0, p)) })}
            />
          </>
        )}
      </Card>
    </PageBody>
  );
}
