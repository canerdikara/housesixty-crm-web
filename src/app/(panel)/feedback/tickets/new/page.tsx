import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/Form";
// Directly, not via Form.tsx's `formStyles` — see surveys/[id]/page.tsx.
import f from "@/components/forms.module.css";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { TICKET_TYPES, ticketTypeLabel } from "@/lib/labels";
import { canRecordFeedback, roleLabel } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { MemberDetail, MemberListItem, Paged } from "@/lib/types";
import { createTicketAction } from "../../actions";
import styles from "../../feedback.module.css";

export const metadata = { title: "Yeni talep · House Sixty CRM" };
export const dynamic = "force-dynamic";

type PanelUser = { id: string; fullName: string; role: string };

/**
 * Logging a member's request, complaint or suggestion — at the desk or from a call.
 *
 * Two steps on one URL: find the member (`?q=`, a GET form), then the ticket form for the
 * one picked (`?userId=`). A ticket is always about one member, fixed at creation.
 */
export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => String((Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "").trim();
  const q = one("q");
  const userId = one("userId");

  const session = await readSession();
  const header = (
    <PageHeader title="Yeni talep" subtitle={<><Link href="/feedback">Geri Bildirim</Link> › Yeni talep</>} />
  );
  if (!canRecordFeedback(session?.user.role)) {
    return <PageBody>{header}<Card><EmptyState title="Talep kaydetme yetkiniz yok" /></Card></PageBody>;
  }

  const [search, member, staff] = await Promise.all([
    q.length >= 2 ? apiRequest<Paged<MemberListItem>>(`/api/v1/crm/members?q=${encodeURIComponent(q)}&size=8`) : Promise.resolve(null),
    userId ? apiRequest<MemberDetail>(`/api/v1/crm/members/${userId}`) : Promise.resolve(null),
    apiRequest<PanelUser[]>("/api/v1/crm/users"),
  ]);
  if (search?.kind === "unauthorized" || member?.kind === "unauthorized") redirect("/login");
  const results = search?.kind === "ok" ? search.data.content : [];
  const staffList = staff.kind === "ok" ? staff.data : [];

  return (
    <PageBody>
      {header}
      <Card>
        <h2 className={styles.cardTitle}>1. Üye</h2>
        {member?.kind === "ok" ? (
          <p className={styles.cardSub} style={{ marginBottom: 0 }}>
            <strong>{member.data.fullName}</strong>
            {member.data.phone ? ` · ${member.data.phone}` : ""} · <Link href="/feedback/tickets/new">değiştir</Link>
          </p>
        ) : (
          <>
            <p className={styles.cardSub}>Talep hangi üye adına? İsim, telefon veya e-posta ile arayın.</p>
            <form method="GET" action="/feedback/tickets/new" className={ui.filterForm}>
              <input className={ui.search} type="search" name="q" defaultValue={q} autoFocus
                placeholder="İsim, telefon veya e-posta" aria-label="Üye ara" />
              <button type="submit" className={`${ui.button} ${ui.buttonGhost}`}>Ara</button>
            </form>
            {q.length >= 2 && (results.length === 0 ? (
              <p className={styles.cardSub} style={{ marginTop: 10 }}>«{q}» için üye bulunamadı.</p>
            ) : (
              <ul className={styles.results}>
                {results.map((m) => (
                  <li key={m.userId}>
                    <span>{m.fullName}{m.membershipType && <span className={styles.resultMeta}> · {m.membershipType}</span>}</span>
                    <Link className={styles.miniButton} href={`/feedback/tickets/new?userId=${m.userId}`}>Seç</Link>
                  </li>
                ))}
              </ul>
            ))}
          </>
        )}
      </Card>

      {member?.kind === "ok" && (
        <Card>
          <h2 className={styles.cardTitle}>2. Talep</h2>
          <p className={styles.cardSub}>Kayıt «Açık» olarak başlar.</p>
          <ActionForm action={createTicketAction} hiddenFields={{ userId }}>
            <div className={f.field}>
              <label className={`${f.label} ${f.required}`} htmlFor="tk-subject">Konu</label>
              <input id="tk-subject" name="subject" className={f.input} required maxLength={200}
                placeholder="ör. Kort 3 aydınlatması" />
            </div>
            <div className={f.row}>
              <div className={f.field}>
                <label className={`${f.label} ${f.required}`} htmlFor="tk-type">Tür</label>
                <select id="tk-type" name="type" className={f.select} defaultValue="COMPLAINT">
                  {TICKET_TYPES.map((t) => <option key={t} value={t}>{ticketTypeLabel(t)}</option>)}
                </select>
              </div>
              <div className={f.field}>
                <label className={f.label} htmlFor="tk-assignee">Sorumlu</label>
                <select id="tk-assignee" name="assigneeUserId" className={f.select} defaultValue="">
                  <option value="">— atanmadı —</option>
                  {staffList.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({roleLabel(u.role)})</option>)}
                </select>
                <p className={f.hint}>Sorumlu kişi talebin durumunu kendisi güncelleyebilir.</p>
              </div>
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="tk-desc">Açıklama</label>
              <textarea id="tk-desc" name="description" className={f.textarea} rows={4} maxLength={4000}
                placeholder="Üyenin anlattığı, ne zaman, nerede…" />
            </div>
            <div className={f.actions}><SubmitButton>Talebi kaydet</SubmitButton></div>
          </ActionForm>
        </Card>
      )}
    </PageBody>
  );
}
