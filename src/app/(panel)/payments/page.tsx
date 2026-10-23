import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Badge, ChipRow, EmptyState, FilterChip, TableWrap, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDate, formatDateTime, izmirToday } from "@/lib/dates";
import { readSession } from "@/lib/session";
import type { PaymentList, PaymentStatus } from "@/lib/types";
import { CODE_LEGEND, attentionLabel, codeLabel, paymentStatusLabel, paymentStatusTone, tl } from "./labels";
import styles from "./payments.module.css";

export const metadata = { title: "Ödemeler · House Sixty CRM" };
export const dynamic = "force-dynamic";

const STATUSES: PaymentStatus[] = ["COMPLETED", "REFUND_PENDING", "REFUNDED", "PENDING", "FAILED"];

/**
 * «Ödemeler» — card payments (virtual_pos.md §9.1). ADMIN only, like «Gelirler».
 *
 * Lists only payments that reached the bank at least once, which in practice means guests'.
 * Members never pay by card; their «Öde» still writes a PENDING row that stays out of here.
 *
 * ⚠️ No card data anywhere — the club holds none — and no bank message text beyond the short
 * code legend at the side.
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const today = izmirToday();
  const iso = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  const from = iso(one("from")) || shiftDays(today, -29);
  const to = iso(one("to")) || today;
  const status = STATUSES.includes(one("status") as PaymentStatus) ? one("status") : "";
  const attention = one("attention") === "true";
  const q = one("q").trim();

  const session = await readSession();
  if (session?.user.role !== "ADMIN") {
    return (
      <PageBody>
        <PageHeader title="Ödemeler" />
        <Card><EmptyState title="Bu ekranı yalnızca yöneticiler görebilir" /></Card>
      </PageBody>
    );
  }

  const params = new URLSearchParams({ from, to });
  if (status) params.set("status", status);
  if (attention) params.set("attention", "true");
  if (q) params.set("q", q);
  const result = await apiRequest<PaymentList>(`/api/v1/crm/payments?${params}`);
  if (result.kind === "unauthorized") redirect("/login");

  const href = (next: Record<string, string>) => {
    const p = new URLSearchParams({ from, to, ...(status && { status }), ...(q && { q }), ...(attention && { attention: "true" }), ...next });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/payments?${p}`;
  };

  return (
    <PageBody>
      <PageHeader title="Ödemeler" subtitle={`${formatDate(from)} – ${formatDate(to)} · misafirlerin kartla ödemeleri`} />

      {result.kind !== "ok" ? (
        <Card><EmptyState title="Ödemeler yüklenemedi">{result.message}</EmptyState></Card>
      ) : (
        <>
          {!result.data.providerConfigured && (
            <p className={styles.notice}>
              ⚠️ Sanal POS henüz tanımlı değil: kartla ödeme alınmıyor, bu liste boş kalacak.
            </p>
          )}

          {result.data.attention.length > 0 && (
            <Card>
              <h2 className={styles.cardTitle}>Dikkat gerektirenler</h2>
              <p className={styles.cardSub}>Sistem tekrar deniyor; yine de bakılması gerekenler</p>
              <ul className={styles.attention}>
                {result.data.attention.map((a, i) => (
                  <li key={`${a.kind}-${a.paymentId}-${i}`}>
                    <Link href={`/payments/${a.paymentId}`}>{a.customerName}</Link>
                    <span>{attentionLabel(a.kind)}</span>
                    <span className="tnum">{tl(a.amount)}</span>
                    {a.since && <span className={ui.muted}>{formatDateTime(a.since)}</span>}
                    {a.orderId && <span className={`${ui.faint} tnum`}>{a.orderId}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className={styles.layout}>
            <Card>
              <ChipRow>
                <FilterChip href={href({ status: "", attention: "" })} active={!status && !attention}>Tümü</FilterChip>
                <FilterChip href={href({ attention: "true", status: "" })} active={attention}>Dikkat gerektirenler</FilterChip>
                {STATUSES.map((s) => (
                  <FilterChip key={s} href={href({ status: s, attention: "" })} active={status === s}>
                    {paymentStatusLabel(s)}
                  </FilterChip>
                ))}
              </ChipRow>
              <form method="GET" action="/payments" role="search" className={ui.filterForm}>
                <input type="hidden" name="from" value={from} />
                <input type="hidden" name="to" value={to} />
                {status && <input type="hidden" name="status" value={status} />}
                <input className={ui.search} type="search" name="q" defaultValue={q}
                  placeholder="Ad, telefon, sipariş no ya da RRN" aria-label="Ödemelerde ara" />
                <input className={ui.select} type="date" name="from" defaultValue={from} max={today} aria-label="Başlangıç" />
                <input className={ui.select} type="date" name="to" defaultValue={to} max={today} aria-label="Bitiş" />
                <button className={ui.button} type="submit">Ara</button>
              </form>

              {result.data.rows.length === 0 ? (
                <EmptyState title="Bu aralıkta ödeme yok" />
              ) : (
                <TableWrap>
                  <table className={ui.table}>
                    <thead>
                      <tr>
                        <th>Misafir</th>
                        <th>Rezervasyon</th>
                        <th>Tutar</th>
                        <th>Durum</th>
                        <th>Ödendi</th>
                        <th>Son kod</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.rows.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <Link className={ui.rowLink} href={`/payments/${r.id}`}>{r.customerName}</Link>
                            {r.needsAttention && <> <Badge tone="crit">Dikkat</Badge></>}
                          </td>
                          <td className={ui.nowrap}>
                            {r.facilityName} · {formatDate(r.slotDate)} {r.startTime.slice(0, 5)}
                          </td>
                          <td className="tnum">
                            {tl(r.amount)}
                            {Number(r.refundedAmount) > 0 && (
                              <div className={ui.muted}>{r.status === "REFUNDED" ? "İade" : "Mükerrer iade"}: {tl(r.refundedAmount)}</div>
                            )}
                          </td>
                          <td><Badge tone={paymentStatusTone(r.status)}>{paymentStatusLabel(r.status)}</Badge></td>
                          <td className={ui.nowrap}>{r.paidAt ? formatDateTime(r.paidAt) : "—"}</td>
                          <td className="tnum">{codeLabel(r.lastCode)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Card>

            <Card>
              <h2 className={styles.cardTitle}>Banka kodları</h2>
              <p className={styles.cardSub}>Kart bilgisi saklanmaz; ayrıntı bankanın panelindedir</p>
              <dl className={styles.legend}>
                {CODE_LEGEND.map(([c, t]) => (
                  <div key={c} style={{ display: "contents" }}>
                    <dt>{c}</dt>
                    <dd>{t}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
        </>
      )}
    </PageBody>
  );
}

/** Plain `YYYY-MM-DD` arithmetic on UTC midnights — never the viewer's zone. */
function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
