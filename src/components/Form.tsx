"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/formState";
import styles from "./forms.module.css";

/**
 * Shared form primitives for the panel's write actions.
 *
 * Client components — they need `useActionState` and `useFormStatus`. Everything they
 * submit goes to a server action, so no API URL and no token ever reaches the browser.
 */

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();
  const cls =
    variant === "ghost" ? styles.submitGhost : variant === "danger" ? styles.submitDanger : "";
  return (
    <button type="submit" className={`${styles.submit} ${cls}`} disabled={pending}>
      {pending ? (pendingLabel ?? "Kaydediliyor…") : children}
    </button>
  );
}

/**
 * The result of the last submit.
 *
 * `role="status"` rather than `role="alert"` for the success case: an alert interrupts
 * a screen reader mid-sentence, which is right for an error and rude for "saved".
 */
export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p className={`${styles.message} ${styles.messageError}`} role="alert">
        <span aria-hidden="true">▲</span>
        <span>{state.error}</span>
      </p>
    );
  }
  if (state.ok) {
    return (
      <p className={`${styles.message} ${styles.messageOk}`} role="status">
        <span aria-hidden="true">●</span>
        <span>{state.ok}</span>
      </p>
    );
  }
  return null;
}

/**
 * A form bound to a server action, with its own message area.
 *
 * The lead detail screen has five independent forms on it. Each keeps its own state,
 * so saving a note does not clear the message from a status change that happened a
 * moment earlier — and an error on one does not blank the others.
 */
export function ActionForm({
  action,
  children,
  hiddenFields,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  hiddenFields?: Record<string, string>;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={formAction} className={styles.form}>
      {hiddenFields &&
        Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <FormMessage state={state} />
      {children}
    </form>
  );
}

export { styles as formStyles };
