import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Badge, EmptyState, TableWrap, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/dates";
import { readSession } from "@/lib/session";
import type { PaymentDetail } from "@/lib/types";
import {
  codeLabel, paymentStatusLabel, paymentStatusTone, posKindLabel, posStatusLabel, posStatusTone, reasonLabel, tl,
} from "../labels";
import styles from "../payments.module.css";
import { PaymentActions } from "./PaymentActions";

export const metadata = { title: "Ödeme · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * One payment: every bank conversation (`pos_transactions`), the contract the guest
 * accepted, and the two actions (virtual_pos.md §9.1). No card data, no bank message text.
 */
export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await readSession();
  if (session?.user.role !== "ADMIN") {
    return (
      <PageBody>
        <PageHeader title="Ödeme" />
        <Card><EmptyState title="Bu ekranı yalnızca yöneticiler görebilir" /></Card>
      </PageBody>
    );
  }

  const result = await apiRequest<PaymentDetail>(`/api/v1/crm/payments/${encodeURIComponent(id)}`);
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Ödeme" />
        <Card><EmptyState title="Ödeme yüklenemedi">{result.message}</EmptyState></Card>
      </PageBody>
    );
  }
  const d = result.data;
  const p = d.payment;

  return (
    <PageBody>
      <PageHeader
        title={p.customerName}
        subtitle={`${p.facilityName} · ${formatDate(p.slotDate)} ${p.startTime.slice(0, 5)} · ${tl(p.amount)}`}
        actions={<Link className={`${ui.button} ${ui.buttonGhost}`} href="/payments">← Ödemeler</Link>}
      />

      <div className={styles.layout}>
        <div className={styles.stack}>
          <Card>
            <h2 className={styles.cardTitle}>Bankayla yapılan işlemler</h2>
            <p className={styles.cardSub}>Her deneme, iptal ve iade ayrı bir satır</p>
            <TableWrap>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>İşlem</th>
                    <th>Durum</th>
                    <th>Tutar</th>
                    <th>Kod</th>
                    <th>Zaman</th>
                    <th>Sipariş / RRN</th>
                  </tr>
                </thead>
                <tbody>
                  {d.transactions.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {posKindLabel(t.kind)}
                        {t.primary && <> <Badge tone="good">Asıl ödeme</Badge></>}
                        {t.reason && <div className={ui.muted}>{reasonLabel(t.reason)}</div>}
                        {t.requestedByName && <div className={ui.muted}>{t.requestedByName}</div>}
                        {t.note && <div className={ui.muted}>“{t.note}”</div>}
                      </td>
                      <td><Badge tone={posStatusTone(t.status)}>{posStatusLabel(t.status)}</Badge></td>
                      <td className="tnum">{tl(t.amount)}</td>
                      <td className="tnum">{codeLabel(t.procReturnCode)}</td>
                      <td className={ui.nowrap}>
                        {formatDateTime(t.createdAt)}
                        {t.completedAt && <div className={ui.muted}>bitti {formatDateTime(t.completedAt)}</div>}
                      </td>
                      <td className="tnum">
                        {t.orderId}
                        {t.rrn && <div className={ui.muted}>RRN {t.rrn}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        </div>

        <div className={styles.stack}>
          <Card>
            <dl className={styles.facts}>
              <dt>Durum</dt>
              <dd><Badge tone={paymentStatusTone(p.status)}>{paymentStatusLabel(p.status)}</Badge></dd>
              <dt>Rezervasyon</dt>
              <dd>{p.reservationStatus === "CANCELLED" ? "İptal edildi" : p.reservationStatus === "CONFIRMED" ? "Onaylı" : "Beklemede"}</dd>
              {p.customerPhone && (<><dt>Telefon</dt><dd className="tnum">{p.customerPhone}</dd></>)}
              <dt>Ödendi</dt>
              <dd>{p.paidAt ? formatDateTime(p.paidAt) : "—"}</dd>
              {Number(p.refundedAmount) > 0 && (<><dt>{p.status === "REFUNDED" ? "İade edilen" : "Mükerrer iade"}</dt><dd className="tnum">{tl(p.refundedAmount)}</dd></>)}
              {p.refundedAt && (<><dt>İade tarihi</dt><dd>{formatDateTime(p.refundedAt)}</dd></>)}
              <dt>Deneme</dt>
              <dd>{p.saleAttempts}</dd>
              <dt>Sözleşme</dt>
              <dd>
                {d.contractVersion ? `${d.contractVersion} · ${formatDateTime(d.contractAcceptedAt)}` : "—"}
              </dd>
              <dt>Sözleşme e-postası</dt>
              <dd>
                {d.contractMailedAt
                  ? formatDateTime(d.contractMailedAt)
                  : d.contractMailGaveUpAt
                    ? `⚠️ Gönderilemedi (${formatDateTime(d.contractMailGaveUpAt)})`
                    : "—"}
              </dd>
            </dl>
          </Card>

          <Card>
            <PaymentActions
              paymentId={p.id}
              canRefund={d.canRefund}
              providerConfigured={d.providerConfigured}
              amountLabel={tl(p.amount)}
            />
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
