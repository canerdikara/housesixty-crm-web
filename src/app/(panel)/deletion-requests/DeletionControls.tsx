"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/formState";
import { completeDeletionAction, rejectDeletionAction } from "./actions";
import styles from "./deletion.module.css";

/**
 * One pending row's actions: an optional note, «Anonimleştir», and — only for an
 * unverified request — «Reddet». Confirm-then-submit, like «Çalışan takibi».
 */
export function DeletionActions({
  id,
  name,
  verified,
  linked,
}: {
  id: string;
  name: string;
  verified: boolean;
  /** False when the web form matched no account: nothing to anonymise, only «Reddet». */
  linked: boolean;
}) {
  const [done, complete, completing] = useActionState<FormState, FormData>(
    completeDeletionAction,
    {},
  );
  const [rejected, reject, rejecting] = useActionState<FormState, FormData>(
    rejectDeletionAction,
    {},
  );
  const pending = completing || rejecting;
  const error = done.error ?? rejected.error;

  return (
    <form className={styles.actions}>
      <input type="hidden" name="id" value={id} />
      <input
        className={styles.note}
        name="note"
        placeholder="Not (isteğe bağlı)"
        maxLength={1000}
        disabled={pending}
      />
      <div className={styles.buttons}>
        {linked && (
          <button
            type="submit"
            formAction={complete}
            className={styles.danger}
            disabled={pending}
            onClick={(e) => {
              const ok = window.confirm(
                `${name} anonimleştirilsin mi?\n\n` +
                  "Bu işlem geri alınamaz. Ad, e-posta, telefon, profil, sözleşme taraması ve bildirim kaydı silinir; " +
                  "kişi uygulamaya bir daha giremez.\n\n" +
                  "Yasal olarak saklanması gereken kayıtlar ad olmadan kalır: ödemeler, sözleşme onayları, " +
                  "giriş-çıkış kayıtları ve izin (KVKK/İYS) kayıtları.",
              );
              if (!ok) e.preventDefault();
            }}
          >
            Anonimleştir
          </button>
        )}
        {!verified && (
          <button
            type="submit"
            formAction={reject}
            className={styles.linkButton}
            disabled={pending}
            onClick={(e) => {
              if (
                !window.confirm(
                  `${name} için talep reddedilsin mi? Hesapta hiçbir değişiklik yapılmaz.`,
                )
              )
                e.preventDefault();
            }}
          >
            Reddet
          </button>
        )}
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </form>
  );
}
