"use client";

import { useActionState, useRef } from "react";
import { PANEL_ROLES, roleLabel } from "@/lib/roles";
import type { FormState } from "@/lib/formState";
import { changeRoleAction } from "./actions";
import styles from "./settings.module.css";

/**
 * A panel user's role, saved on change — like the events screen's answer select.
 *
 * Moving somebody between panel roles signs them out (the backend revokes their tokens so
 * the old permissions do not linger for fifteen minutes), so the change asks first and
 * puts the select back if the answer is no.
 */
export function RoleSelect({ id, role, name }: { id: string; role: string; name: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(changeRoleAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={formAction} className={styles.inline}>
      <input type="hidden" name="id" value={id} />
      <select
        name="role"
        className={styles.miniSelect}
        defaultValue={role}
        disabled={pending}
        aria-label={`${name} rolü`}
        onChange={(e) => {
          const next = e.target.value;
          if (window.confirm(`${name}: ${roleLabel(role)} → ${roleLabel(next)}. Kişinin açık oturumları kapanır ve yeniden giriş yapması gerekir. Devam edilsin mi?`)) {
            formRef.current?.requestSubmit();
          } else {
            e.target.value = role;
          }
        }}
      >
        {PANEL_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
      </select>
      {state.error && <span className={styles.inlineError}>{state.error}</span>}
    </form>
  );
}

/**
 * «Panelden çıkar» (→ Üye) or «Panele ekle» (Üye → a panel role). One component for
 * both: a fixed role and a button, or a role picker and a button.
 */
export function RoleButton({
  id,
  name,
  role,
  label,
  confirmText,
  pick,
}: {
  id: string;
  name: string;
  role?: string;
  label: string;
  confirmText?: string;
  /** Offer a role picker instead of a fixed role. */
  pick?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(changeRoleAction, {});
  return (
    <form
      action={formAction}
      className={styles.inline}
      onSubmit={(e) => { if (confirmText && !window.confirm(confirmText)) e.preventDefault(); }}
    >
      <input type="hidden" name="id" value={id} />
      {pick ? (
        <select name="role" className={styles.miniSelect} defaultValue="RECEPTION" aria-label={`${name} için rol`}>
          {PANEL_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
      ) : (
        <input type="hidden" name="role" value={role} />
      )}
      <button type="submit" className={pick ? styles.miniButton : styles.linkButton} disabled={pending}>{label}</button>
      {state.error && <span className={styles.inlineError}>{state.error}</span>}
      {state.ok && pick && <span className={styles.inlineOk}>{state.ok}</span>}
    </form>
  );
}
