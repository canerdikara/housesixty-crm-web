"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/Form";
import f from "@/components/forms.module.css";
import { inquirePaymentAction, refundPaymentAction } from "../actions";

/** «Bankaya sor» and «Elle iade» (virtual_pos.md §9.1). ADMIN only, enforced by the API. */
export function PaymentActions({
  paymentId,
  canRefund,
  providerConfigured,
  amountLabel,
}: {
  paymentId: string;
  canRefund: boolean;
  providerConfigured: boolean;
  amountLabel: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!providerConfigured) {
    return <p className={f.hint}>Banka bağlantısı yapılandırılmadığı için sorgu ve iade kapalı.</p>;
  }

  return (
    <>
      <ActionForm action={inquirePaymentAction} hiddenFields={{ paymentId }}>
        <p className={f.hint}>
          Bankaya bu ödemeyi yeniden sorar ve sonucu uygular (sistemin birkaç dakikada bir
          yaptığı kontrolün aynısı). Para hareketi yapmaz.
        </p>
        <div className={f.actions}>
          <SubmitButton variant="ghost" pendingLabel="Soruluyor…">Bankaya sor</SubmitButton>
        </div>
      </ActionForm>

      {canRefund && (
        <ActionForm action={refundPaymentAction} hiddenFields={{ paymentId }}>
          <div className={f.field}>
            <label className={`${f.label} ${f.required}`} htmlFor="p-note">İade nedeni</label>
            <textarea id="p-note" name="note" className={f.textarea} required maxLength={500} />
          </div>
          <p className={f.hint}>
            {amountLabel} karta tam iade edilir. Rezervasyon iptal <strong>edilmez</strong>; iptal
            gerekiyorsa takvimden yapın (takvimden iptal zaten iade eder, ikisini birden yapmayın).
          </p>
          <div className={f.actions}>
            {confirming ? (
              <SubmitButton variant="danger" pendingLabel="İade ediliyor…">Emin misiniz? Tam iade et</SubmitButton>
            ) : (
              <button type="button" className={`${f.submit} ${f.submitGhost}`} onClick={() => setConfirming(true)}>
                Elle iade et
              </button>
            )}
          </div>
        </ActionForm>
      )}
    </>
  );
}
