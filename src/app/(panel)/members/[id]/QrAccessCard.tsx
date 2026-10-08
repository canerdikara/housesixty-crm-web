"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton, formStyles as f, FormMessage } from "@/components/Form";
import { recordQrExitAction, unbindQrDeviceAction } from "../actions";
import type { FormState } from "@/lib/formState";

/**
 * The two desk actions on «QR erişimi» (V53). Each asks for a second press, like the
 * contract delete: one moves a member's door access to whichever phone asks next, the
 * other writes an exit into the attendance record — neither should happen on a misclick.
 */
export function QrAccessActions({
  userId,
  hasDevice,
  inside,
}: {
  userId: string;
  hasDevice: boolean;
  inside: boolean;
}) {
  return (
    <>
      {inside && (
        <Confirmed
          userId={userId}
          action={recordQrExitAction}
          label="Çıkış kaydet"
          confirm="Emin misiniz? Çıkış kaydet"
          pending="Kaydediliyor…"
          hint="Turnikeden okutmadan çıkan kişi için. Kaydedilmezse bugün tekrar giriş yapamaz — sistem onu hâlâ içeride sayar."
        />
      )}
      {hasDevice && (
        <Confirmed
          userId={userId}
          action={unbindQrDeviceAction}
          label="Telefon bağını kaldır"
          confirm="Emin misiniz? Bağı kaldır"
          pending="Kaldırılıyor…"
          hint="Üye telefonunu değiştirdiyse ve uygulamadan taşıyamıyorsa. Bağ kalkınca QR ekranını açan İLK telefon yeni QR telefonu olur — işlemi üye yanınızdayken yapın."
        />
      )}
    </>
  );
}

function Confirmed({
  userId,
  action,
  label,
  confirm,
  pending,
  hint,
}: {
  userId: string;
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  label: string;
  confirm: string;
  pending: string;
  hint: string;
}) {
  const [state, run] = useActionState<FormState, FormData>(action, {});
  const [confirming, setConfirming] = useState(false);

  // Back to the safe label once it has happened, so the card never sits on a primed button.
  useEffect(() => {
    if (state.ok) setConfirming(false);
  }, [state.ok]);

  return (
    <form action={run} style={{ marginTop: 12 }}>
      <input type="hidden" name="userId" value={userId} />
      <FormMessage state={state} />
      {confirming ? (
        <>
          <p className={f.hint}>{hint}</p>
          <SubmitButton variant="danger" pendingLabel={pending}>
            {confirm}
          </SubmitButton>
        </>
      ) : (
        <button type="button" className={`${f.submit} ${f.submitGhost}`} onClick={() => setConfirming(true)}>
          {label}
        </button>
      )}
    </form>
  );
}
