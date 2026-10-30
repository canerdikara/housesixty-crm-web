import { redirect } from "next/navigation";
import { Card, PageBody, PageHeader } from "@/components/Page";
import { Badge, EmptyState, TableWrap, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import { canControlGate, roleLabel } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { AccountDeletionRequest } from "@/lib/types";
import { DeletionActions } from "./DeletionControls";
import styles from "./deletion.module.css";

export const metadata = { title: "Silme talepleri · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * «Silme talepleri» (V65) — account deletion requests from the member apps' «Hesabımı Sil»
 * and the unlinked /hesap-silme web page.
 *
 * A verified request (signed-in app, or web form with the right password) has already
 * closed the account; the desk may settle a membership first but must complete it — the
 * stores require the deletion to happen, and the app promises «en geç 30 gün». Only an
 * unverified web request can be rejected.
 *
 * ADMIN and RECEPTION — the same pair as «Turnikeler», so the same role check.
 */
export default async function DeletionRequestsPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  if (!canControlGate(session.user.role)) {
    return (
      <PageBody>
        <PageHeader title="Silme talepleri" />
        <Card>
          <EmptyState title="Bu ekranı görüntüleme yetkiniz yok">
            Hesap silme taleplerini yalnızca yönetici ve resepsiyon görebilir.
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const result = await apiRequest<AccountDeletionRequest[]>("/api/v1/crm/deletion-requests");
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Silme talepleri" />
        <Card>
          <EmptyState title="Talepler yüklenemedi">{result.message}</EmptyState>
        </Card>
      </PageBody>
    );
  }

  const pending = result.data.filter((r) => r.status === "PENDING");
  const closed = result.data.filter((r) => r.status !== "PENDING");

  return (
    <PageBody>
      <PageHeader
        title="Silme talepleri"
        subtitle="Uygulamadan ve web formundan gelen hesap silme talepleri — en geç 30 gün içinde sonuçlandırın"
      />

      <Card>
        <h2 className={styles.cardTitle}>Bekleyen talepler</h2>
        <p className={styles.cardSub}>
          Doğrulanmış talepte hesap zaten kapatıldı; aktif üyelik varsa önce kişiyle konuşun, ardından anonimleştirin.
        </p>
        {pending.length === 0 ? (
          <EmptyState title="Bekleyen talep yok" />
        ) : (
          <TableWrap>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Kişi</th>
                  <th>Rol</th>
                  <th>Kaynak</th>
                  <th>Durum</th>
                  <th>Neden</th>
                  <th>Talep tarihi</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => {
                  const name = r.fullName ?? r.identifier ?? "Bilinmeyen kişi";
                  return (
                    <tr key={r.id}>
                      <td>
                        <span className={styles.person}>{name}</span>
                        {r.fullName ? (
                          <>
                            {r.email && <span className={styles.contact}>{r.email}</span>}
                            {r.phone && <span className={styles.contact}>{r.phone}</span>}
                          </>
                        ) : (
                          <span className={styles.contact}>Hesap eşleşmedi — formda yazılan bilgi</span>
                        )}
                        {r.hasActiveMembership && <span className={styles.warn}>Aktif üyelik var</span>}
                      </td>
                      <td>{r.role ? roleLabel(r.role) : "—"}</td>
                      <td>{r.source === "APP" ? "Uygulama" : "Web"}</td>
                      <td>
                        {r.verified ? (
                          <Badge tone="good">Doğrulandı</Badge>
                        ) : (
                          <>
                            <Badge tone="crit">Doğrulanmadı</Badge>
                            <span className={styles.unverified}>Kişiyle iletişime geçip kimliğini teyit edin</span>
                          </>
                        )}
                      </td>
                      <td className={styles.reason}>{r.reason ?? "—"}</td>
                      <td className={ui.nowrap}>{formatDateTime(r.requestedAt)}</td>
                      <td>
                        <DeletionActions id={r.id} name={name} verified={r.verified} linked={r.userId !== null} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <h2 className={styles.cardTitle}>Son işlemler</h2>
        <p className={styles.cardSub}>Son 50 tamamlanan ya da reddedilen talep. Anonimleştirilen kişinin adı artık gösterilmez.</p>
        {closed.length === 0 ? (
          <EmptyState title="Henüz işlem yok" />
        ) : (
          <TableWrap>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Sonuç</th>
                  <th>Kaynak</th>
                  <th>Talep tarihi</th>
                  <th>İşlem tarihi</th>
                  <th>Not</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.status === "COMPLETED" ? <Badge tone="neutral">Anonimleştirildi</Badge> : <Badge tone="crit">Reddedildi</Badge>}
                    </td>
                    <td>{r.source === "APP" ? "Uygulama" : "Web"}</td>
                    <td className={ui.nowrap}>{formatDateTime(r.requestedAt)}</td>
                    <td className={ui.nowrap}>{formatDateTime(r.completedAt)}</td>
                    <td className={styles.reason}>{r.staffNote ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </PageBody>
  );
}
