"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "./actions";
import styles from "./login.module.css";

/**
 * Submit button, split out purely so it can read `useFormStatus`.
 *
 * That hook only reports the status of a form *above* it in the tree, so it cannot be
 * called from the same component that renders the `<form>`.
 */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.submit} disabled={pending}>
      {pending ? "Giriş yapılıyor…" : "Giriş yap"}
    </button>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.8" />
      {!open && <path d="m4 4 16 16" />}
    </svg>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  /*
   * Reveal toggle, matching the eye icon added to all twelve password fields across
   * the four native apps. Here it is a plain type swap — the iOS version needs extra
   * handling because toggling secure entry wipes the text and resets the font, which
   * is a UIKit problem and not a web one.
   */
  const [reveal, setReveal] = useState(false);

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="next" value={next} />

      {state.error && (
        <div className={styles.error} role="alert">
          <svg className={styles.errorIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5M12 16.2v.6" />
          </svg>
          <span>{state.error}</span>
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className={styles.input}
          placeholder="ad@housesixty.com"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          // Focus lands here on load: this is the first thing anyone does on this page,
          // and autoFocus on a single-purpose form does not steal focus from anything.
          autoFocus
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">
          Parola
        </label>
        <div className={styles.passwordWrap}>
          <input
            id="password"
            name="password"
            type={reveal ? "text" : "password"}
            className={styles.input}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setReveal((v) => !v)}
            // The control's purpose changes with its state, so the label has to as
            // well — a static "Show password" is wrong half the time.
            aria-label={reveal ? "Parolayı gizle" : "Parolayı göster"}
            aria-pressed={reveal}
            tabIndex={-1}
          >
            <EyeIcon open={reveal} />
          </button>
        </div>
      </div>

      <div className={styles.metaRow}>
        <label className={styles.remember}>
          <input type="checkbox" name="remember" className={styles.checkbox} defaultChecked />
          Beni hatırla
        </label>

        {/*
          Disabled, not hidden. The mockup draws this link and staff will look for it,
          but there is no reset flow for panel accounts yet: the emailed-code reset
          (V25) is wired to the member apps only, and neither admin app has one either.
          A dead link that silently does nothing is worse than one that says why.
        */}
        <button
          type="button"
          className={styles.forgot}
          onClick={() =>
            alert("Parola sıfırlama henüz panelde mevcut değil. Lütfen yöneticinizle iletişime geçin.")
          }
        >
          Parolamı unuttum
        </button>
      </div>

      <SubmitButton />
    </form>
  );
}
