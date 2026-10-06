"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, formStyles as f } from "@/components/Form";
import { SURVEY_STATUSES, surveyQuestionTypeLabel, surveyStatusLabel } from "@/lib/labels";
import type { FormState } from "@/lib/formState";
import type { SurveyDetail, SurveyQuestionType } from "@/lib/types";
import { saveSurveyAction } from "./actions";
import styles from "./feedback.module.css";

type Row = { key: number; id: string; label: string; type: SurveyQuestionType; original: SurveyQuestionType | null };

/**
 * The mockup's six categories plus a comment box — what a new survey starts from. Kept in
 * step with `FeedbackService.DEFAULT_QUESTIONS`. Every row can be edited or removed.
 */
const DEFAULTS: { label: string; type: SurveyQuestionType }[] = [
  { label: "Genel memnuniyet", type: "RATING" },
  { label: "Tesis temizliği", type: "RATING" },
  { label: "Antrenör kalitesi", type: "RATING" },
  { label: "Rezervasyon kolaylığı", type: "RATING" },
  { label: "F&B", type: "RATING" },
  { label: "Etkinlik programı", type: "RATING" },
  { label: "Eklemek istedikleriniz", type: "TEXT" },
];

/**
 * Create or edit a survey.
 *
 * Questions are posted as three parallel lists in screen order; an empty id is a new
 * question. Once anybody has answered (`questionsLocked`) an existing question can be
 * reworded and new ones appended, but not removed or retyped — the controls for that are
 * disabled here and the backend refuses it anyway.
 */
export function SurveyForm({ survey }: { survey?: SurveyDetail }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveSurveyAction, {});
  const locked = survey?.questionsLocked ?? false;
  const [next, setNext] = useState(100);
  const [rows, setRows] = useState<Row[]>(() =>
    survey
      ? survey.questions.map((q, i) => ({ key: i, id: q.id, label: q.label, type: q.type, original: q.type }))
      : DEFAULTS.map((q, i) => ({ key: i, id: "", label: q.label, type: q.type, original: null }))
  );

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i: number, by: number) =>
    setRows((rs) => {
      const out = [...rs];
      const [r] = out.splice(i, 1);
      out.splice(i + by, 0, r!);
      return out;
    });
  const add = () => {
    setRows((rs) => [...rs, { key: next, id: "", label: "", type: "RATING", original: null }]);
    setNext((n) => n + 1);
  };

  const firstRating = rows.find((r) => r.type === "RATING");

  return (
    <form action={formAction} className={f.form}>
      {survey && <input type="hidden" name="id" value={survey.id} />}
      <FormMessage state={state} />

      <div className={f.field}>
        <label className={`${f.label} ${f.required}`} htmlFor="sv-title">Anket adı</label>
        <input id="sv-title" name="title" className={f.input} required maxLength={160}
          defaultValue={survey?.title ?? ""} placeholder="ör. Ekim 2026 memnuniyet anketi" />
      </div>

      <div className={f.field}>
        <label className={f.label} htmlFor="sv-intro">Giriş metni (isteğe bağlı)</label>
        <textarea id="sv-intro" name="intro" className={f.textarea} rows={3} maxLength={2000}
          defaultValue={survey?.intro ?? ""} placeholder="Üyenin yanıt sayfasının üstünde görünür." />
      </div>

      <div className={f.field}>
        <label className={f.label} htmlFor="sv-status">Durum</label>
        <select id="sv-status" name="status" className={f.select} defaultValue={survey?.status ?? "DRAFT"}>
          {SURVEY_STATUSES.map((s) => <option key={s} value={s}>{surveyStatusLabel(s)}</option>)}
        </select>
        <p className={f.hint}>
          Taslak: yanıt alınmaz. Açık: üyeler bağlantılarından yanıtlar, siz de elle girebilirsiniz. Kapalı: yeni yanıt alınmaz.
        </p>
      </div>

      <fieldset className={f.fieldset} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className={f.label}>Sorular</legend>
        <p className={f.hint} style={{ marginTop: 0 }}>
          {firstRating
            ? <>«Genel memnuniyet» kutucuğu ilk puan sorusunu okur — şu an: <strong>{firstRating.label || "(boş)"}</strong>.</>
            : "Puan sorusu yok — «Genel memnuniyet» bu anketten beslenmez."}
          {locked && " Bu ankete yanıt gelmiş: sorular yeniden adlandırılabilir ve yeni soru eklenebilir, ama mevcut bir soru silinemez ya da türü değiştirilemez."}
        </p>

        {rows.map((r, i) => {
          const existingLocked = locked && r.original !== null;
          return (
            <div key={r.key} className={styles.qRow}>
              <span className={styles.qIndex}>{i + 1}.</span>
              <input type="hidden" name="qId" value={r.id} />
              {/* A disabled select is not submitted, so the type travels in a hidden field. */}
              <input type="hidden" name="qType" value={r.type} />
              <input name="qLabel" className={f.input} value={r.label} maxLength={200} required
                aria-label={`Soru ${i + 1}`} placeholder="Soru metni"
                onChange={(e) => update(r.key, { label: e.target.value })} />
              <select className={f.select} value={r.type} disabled={existingLocked} aria-label={`Soru ${i + 1} türü`}
                onChange={(e) => update(r.key, { type: e.target.value as SurveyQuestionType })}>
                {(["RATING", "TEXT"] as const).map((t) => <option key={t} value={t}>{surveyQuestionTypeLabel(t)}</option>)}
              </select>
              <span className={styles.qTools}>
                <button type="button" className={styles.qTool} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Yukarı taşı">↑</button>
                <button type="button" className={styles.qTool} disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Aşağı taşı">↓</button>
                <button type="button" className={styles.qTool} disabled={existingLocked || rows.length === 1}
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Soruyu sil">×</button>
              </span>
            </div>
          );
        })}
        <button type="button" className={styles.miniButton} onClick={add} disabled={rows.length >= 20} style={{ marginTop: 8 }}>
          + Soru ekle
        </button>
      </fieldset>

      <div className={f.actions}>
        <SubmitButton>{survey ? "Kaydet" : "Anketi oluştur"}</SubmitButton>
      </div>
    </form>
  );
}
