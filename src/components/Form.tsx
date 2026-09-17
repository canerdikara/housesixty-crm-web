"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  keepValuesOnSuccess = false,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  hiddenFields?: Record<string, string>;
  /**
   * Leave the fields as they were after a successful save.
   *
   * Only for a form whose inputs *are* the saved record — nothing uses it today. The
   * default is to reset, which is what every form on these screens wants.
   */
  keepValuesOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  /*
   * Empty the form once the save succeeds.
   *
   * Without this, typing a note, saving it, and coming back to log a second one starts
   * with the first one still sitting in the box — which reads as "it did not save", and
   * invites someone to press the button again.
   *
   * `form.reset()` restores each field to the value it was *rendered* with, so a blank
   * box goes blank and a seeded editor goes back to the record. Both are "as it opened",
   * which is the behaviour being asked for.
   *
   * Keyed on the state object rather than on `state.ok`: `useActionState` returns a new
   * object per submit, so two saves in a row with the same message still fire, while
   * ordinary re-renders do not.
   */
  useEffect(() => {
    if (!keepValuesOnSuccess && state.ok) formRef.current?.reset();
  }, [state, keepValuesOnSuccess]);

  return (
    <form ref={formRef} action={formAction} className={styles.form}>
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

/**
 * A labelled show/hide section.
 *
 * Moved here from `members/[id]/MemberActions.tsx` when the renewals screen needed the
 * same affordance — copying it would have been two components free to drift.
 *
 * A `<button>` plus state rather than `<details>/<summary>`: the panel styles the
 * trigger, and `<summary>`'s default marker and focus behaviour vary enough between
 * browsers to be worth not fighting.
 *
 * Both screens use it for the same reason. Each sits *below* a read view rather than
 * replacing it: the 360 and the renewals worklist are screens people scan, and a screen
 * of open form fields is a different screen.
 */
export function Disclosure({
  label,
  openLabel,
  children,
}: {
  label: string;
  openLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.disclosure}>
      <button
        type="button"
        className={styles.disclosureButton}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        {open ? (openLabel ?? "Kapat") : label}
      </button>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}
