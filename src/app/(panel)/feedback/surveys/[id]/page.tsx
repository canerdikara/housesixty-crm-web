import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/Form";
// Directly, not via Form.tsx's `formStyles` — a server component importing a value from a
// "use client" module gets a client reference and every class comes out undefined.
import f from "@/components/forms.module.css";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Badge, EmptyState, TableWrap, Tag, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDayMonth } from "@/lib/dates";
import { surveyStatusLabel } from "@/lib/labels";
import { canManageFeedback, canRecordFeedback } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { MemberListItem, Paged, SegmentList, SurveyDetail, SurveyRecipient } from "@/lib/types";
import {
  addRecipientsAction,
  clearAnswersAction,
  deleteSurveyAction,
  removeRecipientAction,
  setSurveyStatusAction,
} from "../../actions";
import { InlineAction, SurveySendPanel } from "../../FeedbackControls";
import { ScoreList } from "../../ScoreList";
import styles from "../../feedback.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiRequest<SurveyDetail>(`/api/v1/crm/surveys/${id}`);
  return { title: r.kind === "ok" ? `${r.data.title} · House Sixty CRM` : "Anket · House Sixty CRM" };
}

/**
 * One survey: its results, who was asked and who answered, and the ways in — adding
 * members (a segment or by name), typing in a paper form, and sending.
 *
 * Answers have two sources and the list says which: the member through their link, or
 * staff by hand. While sending is off, every answer is a staff one.
 *
 * The member search (`?q=`) is a GET form, like the events screen's.
 */
export default async function SurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const q = String((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim();

  const session = await readSession();
  const role = session?.user.role;
  const canManage = canManageFeedback(role);
  const canRecord = canRecordFeedback(role);

  const [result, segments, search] = await Promise.all([
    apiRequest<SurveyDetail>(`/api/v1/crm/surveys/${id}`),
    canManage ? apiRequest<SegmentList>("/api/v1/crm/segments") : Promise.resolve(null),
    q.length >= 2 && (canManage || canRecord)
      ? apiRequest<Paged<MemberListItem>>(`/api/v1/crm/members?q=${encodeURIComponent(q)}&size=8`)
      : Promise.resolve(null),
  ]);
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind === "error" && result.status === 404) notFound();
  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Anket" subtitle={<Link href="/feedback">Geri Bildirim</Link>} />
        <Card><EmptyState title="Anket yüklenemedi">{result.message}</EmptyState></Card>
      </PageBody>
    );
  }

  const s = result.data;
  const draft = s.status === "DRAFT";
  const closed = s.status === "CLOSED";
  const canEnter = canRecord && !draft;
  const listed = new Set(s.recipients.map((r) => r.userId));
  const answeredIds = new Set(s.recipients.filter((r) => r.answered).map((r) => r.userId));
  const segmentOptions = segments?.kind === "ok" ? segments.data.segments : [];
  const results = search?.kind === "ok" ? search.data.content : [];
  const rate = s.asked ? Math.round((s.answered / s.asked) * 100) : null;
  const ratings = s.stats.filter((x) => x.type === "RATING");
  const texts = s.stats.filter((x) => x.type === "TEXT");
  const touched = s.answered > 0 || s.recipients.some((r) => r.sentAt);

  return (
    <PageBody>
      <PageHeader
        title="Anket"
        subtitle={<><Link href="/feedback">Geri Bildirim</Link> › {s.title}</>}
        actions={canManage ? (
          <Link className={`${ui.button} ${ui.buttonGhost}`} href={`/feedback/surveys/${s.id}/edit`}>Düzenle</Link>
        ) : null}
      />

      <Card>
        <div className={styles.cardHead}>
          <div style={{ minWidth: 0 }}>
            <h2 className={styles.cardTitle} style={{ fontSize: 21 }}>{s.title}</h2>
            <p className={styles.cardSub}>
              Oluşturuldu {formatDayMonth(s.createdAt)} · {s.questions.length} soru
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Badge tone={s.status === "OPEN" ? "good" : "neutral"}>{surveyStatusLabel(s.status)}</Badge>
              {s.segmentName && <Tag muted>Segment: {s.segmentName}</Tag>}
              <Tag muted>{s.asked} üye · {s.answered} yanıt{rate !== null ? ` · %${rate}` : ""}</Tag>
            </div>
          </div>
          {canManage && (
            <div className={styles.rowActions}>
              {draft && <InlineAction action={setSurveyStatusAction} fields={{ id: s.id, status: "OPEN" }} label="Yanıta aç" />}
              {s.status === "OPEN" && (
                <InlineAction action={setSurveyStatusAction} fields={{ id: s.id, status: "CLOSED" }} label="Anketi kapat"
                  confirmText="Anket kapatılsın mı? Üyeler bağlantılarından artık yanıt veremez." />
              )}
              {closed && <InlineAction action={setSurveyStatusAction} fields={{ id: s.id, status: "OPEN" }} label="Yeniden aç" />}
            </div>
          )}
        </div>
        {s.intro && <p className={styles.cardSub} style={{ margin: "12px 0 0", whiteSpace: "pre-wrap" }}>{s.intro}</p>}
        {draft && (
          <p className={styles.notice} style={{ margin: "14px 0 0" }}>
            <strong>Taslak.</strong> Yanıt girilemez ve gönderilemez — soruları tamamlayınca «Yanıta aç»a basın.
          </p>
        )}
      </Card>

      <div className={styles.split}>
        <div className={styles.side}>
          <Card>
            <h2 className={styles.cardTitle}>Sonuçlar</h2>
            <p className={styles.cardSub}>{s.answered} yanıt · puanlar 5 üzerinden</p>
            {ratings.length > 0 && <ScoreList stats={ratings} />}
            {texts.map((t) => (
              <div key={t.id} style={{ marginTop: 18 }}>
                <h3 className={f.sectionTitle}>{t.label} <span className={ui.faint}>· {t.count} yanıt</span></h3>
                {t.texts && t.texts.length > 0 ? (
                  <ul className={styles.texts}>{t.texts.map((x, i) => <li key={i}>{x}</li>)}</ul>
                ) : (
                  <p className={styles.cardSub}>Henüz yazılı yanıt yok.</p>
                )}
              </div>
            ))}
          </Card>

          <Card>
            <h2 className={styles.cardTitle}>Üyeler</h2>
            <p className={styles.cardSub}>
              Ankete eklenenler · yanıtı üye kendi bağlantısından verir ya da siz «Yanıt gir» ile kaydedersiniz
            </p>
            {s.recipients.length === 0 ? (
              <EmptyState title="Henüz kimse eklenmedi">
                {canManage ? "Sağdan bir segment ya da tek tek üye ekleyin." : null}
              </EmptyState>
            ) : (
              <TableWrap>
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th>Üye</th>
                      <th>Durum</th>
                      <th>Yanıt tarihi</th>
                      <th className={styles.num}>Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.recipients.map((r) => (
                      <RecipientRow key={r.userId} r={r} surveyId={s.id}
                        canManage={canManage} canEnter={canEnter} closed={closed} />
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
        </div>

        <div className={styles.side}>
          {(canEnter || (canManage && !closed)) && (
            <Card>
              <h2 className={styles.cardTitle}>Üye bul</h2>
              <p className={styles.cardSub}>
                {canEnter ? "Kağıt ya da telefonla gelen yanıtı girmek için üyeyi bulun." : "Ankete tek tek üye ekleyin."}
              </p>
              <form method="GET" action={`/feedback/surveys/${s.id}`} className={ui.filterForm}>
                <input className={ui.search} type="search" name="q" defaultValue={q}
                  placeholder="İsim, telefon veya e-posta" aria-label="Üye ara" />
                <button type="submit" className={`${ui.button} ${ui.buttonGhost}`}>Ara</button>
              </form>
              {q.length >= 2 && (
                results.length === 0 ? (
                  <p className={styles.cardSub} style={{ marginTop: 10 }}>«{q}» için üye bulunamadı.</p>
                ) : (
                  <ul className={styles.results}>
                    {results.map((m) => (
                      <li key={m.userId}>
                        <span>
                          {m.fullName}
                          {answeredIds.has(m.userId)
                            ? <span className={styles.resultMeta}> · yanıtladı</span>
                            : listed.has(m.userId) ? <span className={styles.resultMeta}> · listede</span> : null}
                        </span>
                        <span className={styles.rowActions}>
                          {canManage && !closed && !listed.has(m.userId) && (
                            <InlineAction action={addRecipientsAction} fields={{ surveyId: s.id, userId: m.userId }} label="Ekle" />
                          )}
                          {canEnter && (
                            <Link className={styles.miniButton} href={`/feedback/surveys/${s.id}/answer?userId=${m.userId}`}>
                              {answeredIds.has(m.userId) ? "Yanıtı düzelt" : "Yanıt gir"}
                            </Link>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </Card>
          )}

          {canManage && !closed && (
            <Card>
              <h2 className={styles.cardTitle}>Segment ekle</h2>
              <p className={styles.cardSub}>Segmentin şu anki üyeleri eklenir; listede olanların yanıtı korunur.</p>
              <ActionForm action={addRecipientsAction} hiddenFields={{ surveyId: s.id }}>
                <div className={f.field}>
                  <label className={f.label} htmlFor="sv-seg">Segment</label>
                  <select id="sv-seg" name="segmentId" className={f.select} defaultValue={s.segmentId ?? ""}>
                    <option value="">— seçin —</option>
                    {segmentOptions.map((sg) => (
                      <option key={sg.id} value={sg.id}>
                        {sg.name}{sg.lastCount !== null ? ` (${sg.lastCount})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={f.actions}><SubmitButton variant="ghost">Segmenti ekle</SubmitButton></div>
              </ActionForm>
            </Card>
          )}

          {canManage && (
            <Card>
              <h2 className={styles.cardTitle}>Gönderim</h2>
              <ul className={styles.kv} style={{ margin: "0 0 12px" }}>
                <li><span>Bağlantısı gönderilen</span><span>{s.recipients.filter((r) => r.sentAt).length} / {s.asked}</span></li>
              </ul>
              <SurveySendPanel survey={s} />
            </Card>
          )}

          {canManage && !touched && (
            <InlineAction action={deleteSurveyAction} fields={{ id: s.id }} label="Anketi sil"
              className={styles.linkButton} confirmText={`«${s.title}» silinsin mi? Üye listesi de silinir.`} />
          )}
        </div>
      </div>
    </PageBody>
  );
}

function RecipientRow({
  r, surveyId, canManage, canEnter, closed,
}: {
  r: SurveyRecipient; surveyId: string; canManage: boolean; canEnter: boolean; closed: boolean;
}) {
  const ids = { surveyId, userId: r.userId };
  return (
    <tr>
      <td>
        <Link href={`/members/${r.userId}`} className={ui.rowLink}>{r.fullName}</Link>
        {r.lastSendNote && <div className={styles.rowNote}>{r.lastSendNote}</div>}
        {!r.lastSendNote && r.sentAt && <div className={styles.rowNote}>Bağlantı gönderildi {formatDayMonth(r.sentAt)}</div>}
      </td>
      <td>
        {r.answered
          ? <Badge tone="good">Yanıtladı</Badge>
          : <Badge tone="neutral">Bekliyor</Badge>}
        {r.source === "STAFF" && <div className={styles.rowNote}>elle girildi</div>}
        {r.source === "MEMBER" && <div className={styles.rowNote}>üye yanıtladı</div>}
      </td>
      <td className={ui.nowrap}>{r.submittedAt ? formatDayMonth(r.submittedAt) : <span className={ui.faint}>—</span>}</td>
      <td>
        <span className={styles.rowActions}>
          {canEnter && (
            <Link className={styles.miniButton} href={`/feedback/surveys/${surveyId}/answer?userId=${r.userId}`}>
              {r.answered ? "Yanıtı gör" : "Yanıt gir"}
            </Link>
          )}
          {canManage && r.answered && (
            <InlineAction action={clearAnswersAction} fields={ids} label="Yanıtı sil" className={styles.linkButton}
              confirmText={`${r.fullName} için girilen yanıt silinsin mi?`} />
          )}
          {canManage && !closed && !r.answered && !r.sentAt && (
            <InlineAction action={removeRecipientAction} fields={ids} label="Kaldır" className={styles.linkButton} />
          )}
        </span>
      </td>
    </tr>
  );
}
