"use client";

import { useActionState, useEffect, useState } from "react";
import { FormMessage } from "@/components/Form";
import type { FormState } from "@/lib/formState";
import type { SurveyDetail } from "@/lib/types";
import { sendSurveyAction } from "./actions";
import styles from "./feedback.module.css";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

/**
 * One button that runs one server action — «Kaldır», «Ekle», «Yanıtı sil». Same control
 * as the events screen's: success is silent because the row itself changes.
 */
export function InlineAction({
  action,
  fields,
  label,
  className,
  confirmText,
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  className?: string;
  confirmText?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form
      action={formAction}
      className={styles.inline}
      onSubmit={(e) => { if (confirmText && !window.confirm(confirmText)) e.preventDefault(); }}
    >
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" className={className ?? styles.miniButton} disabled={pending}>{label}</button>
      {state.error && <span className={styles.inlineError}>{state.error}</span>}
    </form>
  );
}

/**
 * «Anketi gönder» / «Hatırlat» — e-mail only (WhatsApp needs a template the club does not
 * have). While the campaign switch is off it explains and offers nothing to press; when
 * on, a send needs a second, counted confirmation.
 */
export function SurveySendPanel({ survey }: { survey: SurveyDetail }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(sendSurveyAction, {});
  const [armed, setArmed] = useState<"INVITE" | "REMIND" | null>(null);
  useEffect(() => { setArmed(null); }, [state]);

  const notSent = survey.recipients.filter((r) => !r.sentAt && !r.answered).length;
  const remindable = survey.recipients.filter((r) => r.sentAt && !r.answered).length;

  if (!survey.sending.sendingEnabled) {
    return (
      <p className={styles.notice}>
        <strong>Gönderim kapalı.</strong> Anket e-postaları kampanyalarla aynı anahtara bağlı ve kulübün
        onayı (İYS ve izin konusu) bekleniyor. O zamana kadar kağıt ya da telefonla gelen yanıtları
        listeden «Yanıt gir» ile kaydedin.
      </p>
    );
  }
  if (survey.status !== "OPEN") {
    return <p className={styles.notice}>Yalnızca <strong>açık</strong> bir anket gönderilir.</p>;
  }

  const count = armed === "INVITE" ? notSent : remindable;
  return (
    <form action={formAction}>
      <input type="hidden" name="surveyId" value={survey.id} />
      <input type="hidden" name="kind" value={armed ?? ""} />
      <FormMessage state={state} />
      {armed === null ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className={styles.miniButton} disabled={pending || notSent === 0} onClick={() => setArmed("INVITE")}>
            E-posta ile gönder ({notSent})
          </button>
          <button type="button" className={styles.miniButton} disabled={pending || remindable === 0} onClick={() => setArmed("REMIND")}>
            Yanıtsızlara hatırlat ({remindable})
          </button>
        </div>
      ) : (
        <div className={styles.confirm}>
          <p style={{ margin: "0 0 10px" }}>
            <strong>{count} üyeye</strong> e-posta ile {armed === "INVITE" ? "anket bağlantısı" : "hatırlatma"} gönderilecek.
            İzni olmayanlara gönderilmez. Geri alınamaz.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className={styles.miniButton} disabled={pending}>Evet, gönder</button>
            <button type="button" className={styles.linkButton} onClick={() => setArmed(null)}>Vazgeç</button>
          </div>
        </div>
      )}
    </form>
  );
}
