"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormMessage, formStyles as f } from "@/components/Form";
import { eventRsvpLabel } from "@/lib/labels";
import type { FormState } from "@/lib/formState";
import type { EventDetail, EventRsvp } from "@/lib/types";
import { sendEventMessagesAction, setRsvpAction } from "./actions";
import styles from "./events.module.css";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

/**
 * One button that runs one server action — the per-row «Geldi», «Kaldır», «Davet et».
 *
 * A row-sized control, so the message is a short inline error and success is silent: the
 * page revalidates and the row itself changes, which is the confirmation.
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
  /** Asked before submitting, for the few row actions that cannot be taken back. */
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
 * Staff recording an answer by hand: a select that saves on change.
 *
 * On change rather than with a button because a column of «Kaydet» buttons beside a
 * column of selects is twice the controls for one decision per row.
 */
export function RsvpSelect({ eventId, userId, rsvp }: { eventId: string; userId: string; rsvp: EventRsvp }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setRsvpAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={formAction} className={styles.inline}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="userId" value={userId} />
      <select
        name="rsvp"
        className={styles.miniSelect}
        defaultValue={rsvp}
        disabled={pending}
        aria-label="Yanıtı değiştir"
        onChange={() => formRef.current?.requestSubmit()}
      >
        {(["PENDING", "ACCEPTED", "DECLINED"] as const).map((r) => (
          <option key={r} value={r}>{eventRsvpLabel(r)}</option>
        ))}
      </select>
      {state.error && <span className={styles.inlineError}>{state.error}</span>}
    </form>
  );
}

/**
 * «Davet gönder» / «Hatırlat» — the card that reaches members.
 *
 * While the campaign switch is off it says so and offers nothing to press. When it is
 * on, the channels are ticked explicitly (none by default) and a send needs a second,
 * named confirmation: this is the one control on the screen that cannot be taken back.
 */
export function SendPanel({ event }: { event: EventDetail }) {
  const { sending, stats } = event;
  const [state, formAction, pending] = useActionState<FormState, FormData>(sendEventMessagesAction, {});
  const [channels, setChannels] = useState<string[]>([]);
  const [armed, setArmed] = useState<"INVITE" | "REMIND" | null>(null);

  // Disarm once the send has answered — not in onSubmit, which would race the hidden
  // `kind` field being read into the submitted FormData.
  useEffect(() => { setArmed(null); }, [state]);

  const notSent = stats.invited - stats.sentCount;
  const past = event.eventDate < new Date().toISOString().slice(0, 10);
  const closed = event.status === "CANCELLED" || past;

  if (!sending.sendingEnabled) {
    return (
      <p className={styles.notice}>
        <strong>Gönderim kapalı.</strong> Davetler kampanyalarla aynı anahtara bağlı ve kulübün
        onayı (İYS ve izin konusu) bekleniyor. O zamana kadar yanıtları listeden elle kaydedin;
        üyeler kendi bağlantılarından da yanıt verebilir — bağlantı ilk gönderimle gider.
      </p>
    );
  }
  if (closed) {
    return <p className={styles.notice}>{event.status === "CANCELLED" ? "İptal edilmiş" : "Geçmiş"} bir etkinlik için gönderim yapılmaz.</p>;
  }

  const toggle = (c: string) => setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const count = armed === "INVITE" ? notSent : stats.pending;

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="kind" value={armed ?? ""} />
      {channels.map((c) => <input key={c} type="hidden" name="channel" value={c} />)}
      <FormMessage state={state} />

      <div className={styles.channels}>
        <label>
          <input type="checkbox" checked={channels.includes("EMAIL")} onChange={() => toggle("EMAIL")} disabled={!!sending.emailBlocked} />
          E-posta
          {sending.emailBlocked && <span className={styles.channelBlocked}>{sending.emailBlocked}</span>}
        </label>
        <label>
          <input type="checkbox" checked={channels.includes("WHATSAPP")} onChange={() => toggle("WHATSAPP")} disabled={!!sending.whatsappBlocked} />
          WhatsApp
          {sending.whatsappBlocked && <span className={styles.channelBlocked}>{sending.whatsappBlocked}</span>}
        </label>
      </div>

      {armed === null ? (
        <div className={f.actions} style={{ justifyContent: "flex-start", gap: 8 }}>
          <button type="button" className={styles.miniButton} disabled={pending || channels.length === 0 || notSent === 0}
            onClick={() => setArmed("INVITE")}>
            Davet gönder ({notSent})
          </button>
          <button type="button" className={styles.miniButton} disabled={pending || channels.length === 0 || stats.pending === 0}
            onClick={() => setArmed("REMIND")}>
            Yanıtsızlara hatırlat ({stats.pending})
          </button>
        </div>
      ) : (
        <div className={styles.confirm}>
          <p style={{ margin: "0 0 10px" }}>
            <strong>{count} üyeye</strong> {channels.map((c) => (c === "EMAIL" ? "e-posta" : "WhatsApp")).join(" ve ")}{" "}
            ile {armed === "INVITE" ? "davet" : "hatırlatma"} gönderilecek. İzni olmayanlara gönderilmez.
            Geri alınamaz.
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
