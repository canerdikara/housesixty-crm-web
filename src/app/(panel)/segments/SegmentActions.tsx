"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/components/ui";
import type { FormState } from "@/lib/formState";
import { deleteSegmentAction, runSegmentAction } from "./actions";
import styles from "./segments.module.css";

/**
 * «Yeniden çalıştır» and «Sil», in the detail screen's header.
 *
 * Separate from the builder because they act on the **saved** segment, not on what is
 * currently on screen. Running with unsaved rule edits in the builder would recompute
 * the version in the database and show a count that matches neither.
 */
export function SegmentActions({ id, isDynamic }: { id: string; isDynamic: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run() {
    start(async () => {
      const result = await runSegmentAction(id);
      setState(result);
      // The preview beside the rules is server-rendered, so it needs the refresh to
      // show the number that was just recomputed.
      if (result.ok) router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const result = await deleteSegmentAction(id);
      // A successful delete redirects inside the action and never returns.
      setState(result);
    });
  }

  return (
    <div className={styles.headActions}>
      {state.error && (
        <span className={styles.headMessage} role="alert">
          {state.error}
        </span>
      )}
      {state.ok && (
        <span className={styles.headMessage} role="status">
          {state.ok}
        </span>
      )}

      <button
        type="button"
        className={`${ui.button} ${ui.buttonGhost}`}
        onClick={run}
        disabled={pending}
        title={
          isDynamic
            ? "Kart üzerindeki sayıyı yeniden hesaplar"
            : "Dondurulmuş üye listesini kriterlere göre yeniden çizer"
        }
      >
        {pending ? "Çalışıyor…" : "Yeniden çalıştır"}
      </button>

      {/*
        Two taps to delete, with no modal.
        A segment is cheap to rebuild but the click sits next to "run", and the panel has
        no dialog primitive — an inline confirm is honest about what the second click does.
      */}
      {confirming ? (
        <button type="button" className={styles.deleteConfirm} onClick={remove} disabled={pending}>
          Emin misiniz? Sil
        </button>
      ) : (
        <button
          type="button"
          className={`${ui.button} ${ui.buttonGhost}`}
          onClick={() => setConfirming(true)}
        >
          Sil
        </button>
      )}
    </div>
  );
}
