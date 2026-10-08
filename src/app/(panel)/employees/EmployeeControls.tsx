"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/formState";
import { setEmployeeActiveAction } from "./actions";
import { recordQrExitAction, unbindQrDeviceAction } from "../members/actions";
import styles from "./employees.module.css";

/**
 * «Bağı kaldır» / «Çıkış kaydet» on one row (V53) — the same two desk actions as the
 * member 360's «QR erişimi», with this screen's confirm-then-submit style.
 */
export function QrRowAction({
  userId,
  kind,
  name,
}: {
  userId: string;
  kind: "unbind" | "exit";
  name: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    kind === "unbind" ? unbindQrDeviceAction : recordQrExitAction,
    {}
  );
  const question =
    kind === "unbind"
      ? `${name} için QR telefon bağı kaldırılsın mı? QR ekranını açan ilk telefon yeni QR telefonu olur.`
      : `${name} için çıkış kaydedilsin mi? Mesai kaydına çıkış olarak yazılır.`;
  return (
    <form
      action={action}
      className={styles.inline}
      onSubmit={(e) => {
        if (!window.confirm(question)) e.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" className={styles.linkButton} disabled={pending}>
        {kind === "unbind" ? "Bağı kaldır" : "Çıkış kaydet"}
      </button>
      {state.error && <span className={styles.inlineError}>{state.error}</span>}
    </form>
  );
}

/** «Devre dışı bırak» / «Etkinleştir» on one row. Confirms the switch-off only. */
export function ActiveToggle({ userId, isActive, name }: { userId: string; isActive: boolean; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setEmployeeActiveAction, {});
  return (
    <form
      action={action}
      className={styles.inline}
      onSubmit={(e) => {
        if (isActive && !window.confirm(`${name} devre dışı bırakılsın mı? Geçmiş kayıtları korunur; uygulamaya giriş yapamaz.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={String(!isActive)} />
      <button type="submit" className={styles.linkButton} disabled={pending}>
        {isActive ? "Devre dışı bırak" : "Etkinleştir"}
      </button>
      {state.error && <span className={styles.inlineError}>{state.error}</span>}
    </form>
  );
}
