"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/formState";
import { setEmployeeActiveAction } from "./actions";
import styles from "./employees.module.css";

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
