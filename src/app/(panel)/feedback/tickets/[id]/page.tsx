import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/Form";
// Directly, not via Form.tsx's `formStyles` — see surveys/[id]/page.tsx.
import f from "@/components/forms.module.css";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Badge, EmptyState } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import {
  TICKET_STATUSES,
  TICKET_TYPES,
  ticketStatusLabel,
  ticketStatusTone,
  ticketTypeLabel,
} from "@/lib/labels";
import { canManageFeedback, roleLabel } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { Ticket } from "@/lib/types";
import { deleteTicketAction, updateTicketAction } from "../../actions";
import { InlineAction } from "../../FeedbackControls";
import styles from "../../feedback.module.css";

export const dynamic = "force-dynamic";

type PanelUser = { id: string; fullName: string; role: string };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiRequest<Ticket>(`/api/v1/crm/tickets/${id}`);
  return { title: r.kind === "ok" ? `${r.data.subject} · House Sixty CRM` : "Talep · House Sixty CRM" };
}

/**
 * One ticket. Three ways to see it, decided by who is looking:
 *
 * - **ADMIN** edits everything.
 * - **The assignee**, whatever their role, moves it on — status and resolution note. The
 *   other fields ride along as hidden inputs carrying their current values; the backend
 *   ignores them from a non-admin anyway.
 * - **Everyone else** reads.
 */
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await readSession();
  const [result, staff] = await Promise.all([
    apiRequest<Ticket>(`/api/v1/crm/tickets/${id}`),
    apiRequest<PanelUser[]>("/api/v1/crm/users"),
  ]);
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind === "error" && result.status === 404) notFound();
  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Talep" subtitle={<Link href="/feedback">Geri Bildirim</Link>} />
        <Card><EmptyState title="Talep yüklenemedi">{result.message}</EmptyState></Card>
      </PageBody>
    );
  }

  const t = result.data;
  const isAdmin = canManageFeedback(session?.user.role);
  const isAssignee = !!session && t.assigneeUserId === session.user.id;
  const staffList = staff.kind === "ok" ? staff.data : [];

  return (
    <PageBody>
      <PageHeader title="Talep" subtitle={<><Link href="/feedback">Geri Bildirim</Link> › {t.subject}</>} />

      <div className={styles.split}>
        <Card>
          <h2 className={styles.cardTitle} style={{ fontSize: 19 }}>{t.subject}</h2>
          <div style={{ display: "flex", gap: 8, margin: "10px 0 14px", flexWrap: "wrap" }}>
            <Badge tone={ticketStatusTone(t.status)}>{ticketStatusLabel(t.status)}</Badge>
            <span className={styles.typePill}>{ticketTypeLabel(t.type)}</span>
          </div>
          {t.description
            ? <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{t.description}</p>
            : <p className={styles.cardSub}>Açıklama yok.</p>}
          {t.resolutionNote && (
            <>
              <h3 className={f.sectionTitle} style={{ marginTop: 18 }}>Çözüm notu</h3>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{t.resolutionNote}</p>
            </>
          )}

          {(isAdmin || isAssignee) && (
            <div style={{ marginTop: 22 }}>
              <h3 className={f.sectionTitle} style={{ marginBottom: 10 }}>{isAdmin ? "Düzenle" : "Durumu güncelle"}</h3>
              <ActionForm action={updateTicketAction} hiddenFields={isAdmin ? { id: t.id } : {
                id: t.id, subject: t.subject, type: t.type, description: t.description ?? "",
                assigneeUserId: t.assigneeUserId ?? "",
              }} keepValuesOnSuccess>
                {isAdmin && (
                  <>
                    <div className={f.field}>
                      <label className={`${f.label} ${f.required}`} htmlFor="tk-subject">Konu</label>
                      <input id="tk-subject" name="subject" className={f.input} required maxLength={200} defaultValue={t.subject} />
                    </div>
                    <div className={f.row}>
                      <div className={f.field}>
                        <label className={f.label} htmlFor="tk-type">Tür</label>
                        <select id="tk-type" name="type" className={f.select} defaultValue={t.type}>
                          {TICKET_TYPES.map((x) => <option key={x} value={x}>{ticketTypeLabel(x)}</option>)}
                        </select>
                      </div>
                      <div className={f.field}>
                        <label className={f.label} htmlFor="tk-assignee">Sorumlu</label>
                        <select id="tk-assignee" name="assigneeUserId" className={f.select} defaultValue={t.assigneeUserId ?? ""}>
                          <option value="">— atanmadı —</option>
                          {staffList.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({roleLabel(u.role)})</option>)}
                        </select>
                      </div>
                    </div>
                    <div className={f.field}>
                      <label className={f.label} htmlFor="tk-desc">Açıklama</label>
                      <textarea id="tk-desc" name="description" className={f.textarea} rows={4} maxLength={4000} defaultValue={t.description ?? ""} />
                    </div>
                  </>
                )}
                <div className={f.field}>
                  <label className={f.label} htmlFor="tk-status">Durum</label>
                  <select id="tk-status" name="status" className={f.select} defaultValue={t.status}>
                    {TICKET_STATUSES.map((x) => <option key={x} value={x}>{ticketStatusLabel(x)}</option>)}
                  </select>
                  <p className={f.hint}>«Kapatıldı»: çözülmeden kapatılan (mükerrer, karşılanamayan talep).</p>
                </div>
                <div className={f.field}>
                  <label className={f.label} htmlFor="tk-note">Çözüm notu</label>
                  <textarea id="tk-note" name="resolutionNote" className={f.textarea} rows={3} maxLength={4000}
                    defaultValue={t.resolutionNote ?? ""} placeholder="Ne yapıldı, üyeye ne söylendi" />
                </div>
                <div className={f.actions}><SubmitButton>Kaydet</SubmitButton></div>
              </ActionForm>
            </div>
          )}
        </Card>

        <div className={styles.side}>
          <Card>
            <ul className={styles.kv}>
              <li><span>Üye</span><span><Link href={`/members/${t.userId}`}>{t.memberName}</Link></span></li>
              <li><span>Sorumlu</span><span>{t.assigneeName ?? "—"}</span></li>
              <li><span>Açılış</span><span>{formatDateTime(t.createdAt)}</span></li>
              <li><span>Kaydeden</span><span>{t.createdByName ?? "—"}</span></li>
              <li><span>{t.resolvedAt ? "Çözüm" : "Yaş"}</span><span>{t.resolvedAt ? formatDateTime(t.resolvedAt) : `${t.ageDays} gün`}</span></li>
              <li><span>Son güncelleme</span><span>{formatDateTime(t.updatedAt)}</span></li>
            </ul>
          </Card>
          {isAdmin && (
            <InlineAction action={deleteTicketAction} fields={{ id: t.id }} label="Talebi sil" className={styles.linkButton}
              confirmText="Bu talep kalıcı olarak silinsin mi? Yanlışlıkla açılmış bir kayıt için kullanın — kapatmak için durumu değiştirin." />
          )}
        </div>
      </div>
    </PageBody>
  );
}
