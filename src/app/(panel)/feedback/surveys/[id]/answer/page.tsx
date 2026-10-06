import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/Form";
// Directly, not via Form.tsx's `formStyles` — see surveys/[id]/page.tsx.
import f from "@/components/forms.module.css";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import { canRecordFeedback } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { MemberDetail, SurveyDetail } from "@/lib/types";
import { recordAnswersAction } from "../../../actions";
import styles from "../../../feedback.module.css";

export const metadata = { title: "Yanıt gir · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * Typing in a paper form or a phone answer, for one member. Opens filled in when the
 * member has already answered — saving again replaces the earlier answer, which is how a
 * typing mistake is fixed.
 *
 * A member who was never added to the survey is added by the save itself: somebody who
 * picked a form up at the desk was still asked.
 *
 * Plain radios and textareas, no client script — the 1–5 buttons are labels styled with
 * `:has(input:checked)`.
 */
export default async function AnswerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const userId = String((Array.isArray(sp.userId) ? sp.userId[0] : sp.userId) ?? "");

  const session = await readSession();
  const [result, member] = await Promise.all([
    apiRequest<SurveyDetail>(`/api/v1/crm/surveys/${id}`),
    userId ? apiRequest<MemberDetail>(`/api/v1/crm/members/${userId}`) : Promise.resolve(null),
  ]);
  if (result.kind === "unauthorized" || member?.kind === "unauthorized") redirect("/login");
  if (result.kind === "error" && result.status === 404) notFound();

  const surveyTitle = result.kind === "ok" ? result.data.title : "Anket";
  const header = (
    <PageHeader
      title="Yanıt gir"
      subtitle={<><Link href="/feedback">Geri Bildirim</Link> › <Link href={`/feedback/surveys/${id}`}>{surveyTitle}</Link> › Yanıt gir</>}
    />
  );
  const fail = (title: string, text?: string) => (
    <PageBody>{header}<Card><EmptyState title={title}>{text}</EmptyState></Card></PageBody>
  );

  if (!canRecordFeedback(session?.user.role)) return fail("Yanıt girme yetkiniz yok");
  if (result.kind !== "ok") return fail("Anket yüklenemedi", result.message);
  if (!member || member.kind !== "ok") return fail("Üye bulunamadı", "Anket ekranındaki aramadan üyeyi seçin.");

  const s = result.data;
  if (s.status === "DRAFT") return fail("Taslak ankete yanıt girilemez", "Önce anketi yanıta açın.");

  const existing = s.recipients.find((r) => r.userId === userId);
  const prior = existing?.answers ?? {};

  return (
    <PageBody>
      {header}
      <Card>
        <h2 className={styles.cardTitle}>{member.data.fullName}</h2>
        <p className={styles.cardSub}>
          {existing?.answered
            ? `${existing.source === "MEMBER" ? "Üye kendisi yanıtlamış" : "Elle girilmiş"} · ${formatDateTime(existing.submittedAt)} — kaydederseniz önceki yanıtın yerine geçer.`
            : existing ? "Ankete ekli, henüz yanıt yok." : "Ankete ekli değil — kaydettiğinizde eklenir."}
          {" "}Boş bıraktığınız sorular «yanıtsız» sayılır.
        </p>

        <ActionForm action={recordAnswersAction} hiddenFields={{ surveyId: s.id, userId }} keepValuesOnSuccess>
          {s.questions.map((q, i) => (
            <div key={q.id} className={f.field}>
              <input type="hidden" name={`type_${q.id}`} value={q.type} />
              {q.type === "RATING" ? (
                <fieldset className={f.fieldset} style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className={f.label}>{i + 1}. {q.label}</legend>
                  <div className={styles.rating}>
                    <label>
                      <input type="radio" name={q.id} value="" defaultChecked={prior[q.id] === undefined} />
                      —
                    </label>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n}>
                        <input type="radio" name={q.id} value={n} defaultChecked={Number(prior[q.id]) === n} />
                        {n}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <>
                  <label className={f.label} htmlFor={`ans-${q.id}`}>{i + 1}. {q.label}</label>
                  <textarea id={`ans-${q.id}`} name={q.id} className={f.textarea} rows={3} maxLength={2000}
                    defaultValue={typeof prior[q.id] === "string" ? String(prior[q.id]) : ""} />
                </>
              )}
            </div>
          ))}
          <div className={f.actions}>
            <SubmitButton>Yanıtı kaydet</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </PageBody>
  );
}
