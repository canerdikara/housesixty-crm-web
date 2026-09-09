import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Badge, ChipRow, EmptyState, FilterChip, Pagination, Tag, TableWrap, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { daysSinceLabel, formatDate } from "@/lib/dates";
import type { MemberListItem, Paged } from "@/lib/types";

export const metadata = { title: "Üyeler · House Sixty CRM" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/**
 * The saved-filter chips from mockup screen 6.
 *
 * Links carrying their own query, like the lead screen — the filter lives in the URL,
 * so "riskli üyeler" is bookmarkable and sendable, and none of it needs JavaScript.
 *
 * "Misafir getiren" from the mockup is absent: the backend can count guests per member
 * on the 360, but filtering the whole list by it needs an index-friendly query that
 * does not exist yet. Better absent than present and slow.
 */
const CHIPS = [
  { key: "all", label: "Tümü", params: {} as Record<string, string> },
  { key: "renewing", label: "Yenilemesi yaklaşan", params: { renewingWithinDays: "30" } },
  { key: "risky", label: "Riskli", params: { atRisk: "true" } },
  { key: "new", label: "Yeni · 90 gün", params: { newWithinDays: "90" } },
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
  const page = Math.max(0, Number(one(sp.page) ?? 0) || 0);

  const query = new URLSearchParams({ ...chip.params });
  if (q.trim()) query.set("q", q.trim());
  if (membershipType) query.set("membershipType", membershipType);
  query.set("page", String(page));
  query.set("size", String(PAGE_SIZE));

  const result = await apiRequest<Paged<MemberListItem>>(`/api/v1/crm/members?${query}`);
  if (result.kind === "unauthorized") redirect("/login");

  const hrefWith = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const base: Record<string, string> = {
      chip: chipKey === "all" ? "" : chipKey,
      q,
      membershipType,
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
          <form method="GET" action="/members" role="search">
            {chipKey !== "all" && <input type="hidden" name="chip" value={chipKey} />}
            {membershipType && <input type="hidden" name="membershipType" value={membershipType} />}
            <input
              className={ui.search}
              type="search"
              name="q"
              defaultValue={q}
              placeholder="İsim, telefon veya e-posta"
              aria-label="Üyelerde ara"
            />
          </form>
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
          <EmptyState title="Üye bulunamadı">
            {q || chipKey !== "all"
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
