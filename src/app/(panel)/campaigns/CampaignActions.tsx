"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormMessage, formStyles as f } from "@/components/Form";
import {
  cancelCampaignAction,
  deleteCampaignAction,
  scheduleCampaignAction,
  sendCampaignAction,
  testSendAction,
} from "./actions";
import type { CampaignDetail } from "@/lib/types";
import styles from "./campaigns.module.css";

/**
 * Everything that can be done to a campaign that has not gone out yet.
 *
 * ## The send is not a button
 *
 * It is a two-step confirmation that names the audience before it will arm, and that is
 * the whole reason this component exists rather than a row of `ActionForm`s. Every other
 * write in this panel is undoable — a wrong lead status is one more click to fix. This
 * one puts a real email in a real member's inbox and there is no second click that takes
 * it back.
 *
 * ## Test first is the advertised path
 *
 * «Kendime test gönder» sits before the send and works even when the server's sending
 * switch is off, so the copy can always be read in a real mail client before anybody
 * else sees it. The address is never a parameter — the backend sends to the signed-in
 * user and nobody else.
 */
export function CampaignActions({ detail }: { detail: CampaignDetail }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ error?: string; ok?: string }>({});
  const [armed, setArmed] = useState(false);
  const [when, setWhen] = useState("");

  const { campaign, audiencePreview, sendBlockedReason } = detail;
  const editable = campaign.status === "DRAFT" || campaign.status === "SCHEDULED";

  function run(fn: () => Promise<{ error?: string; ok?: string }>) {
    setState({});
    start(async () => {
      const result = await fn();
      setState(result);
      setArmed(false);
      // The status, the funnel and the recipient rows all change together; re-fetching
      // the server component is what keeps the page from showing a stale «Taslak» badge
      // above a message that says it was sent.
      router.refresh();
    });
  }

  if (!editable) return null;

  return (
    <>
      <FormMessage state={state} />

      <div className={styles.actionBar}>
        <button
          type="button"
          className={`${f.submit} ${f.submitGhost}`}
          disabled={pending || sendBlockedReason !== null}
          onClick={() => run(() => testSendAction(campaign.id))}
        >
          Kendime test gönder
        </button>

        <a className={`${f.submit} ${f.submitGhost}`} href={`/campaigns/${campaign.id}/edit`}>
          Düzenle
        </a>

        <button
          type="button"
          className={`${f.submit} ${f.submitGhost}`}
          disabled={pending}
          onClick={() => run(() => cancelCampaignAction(campaign.id))}
        >
          İptal et
        </button>

        {/* Only a campaign nobody has been written to can be deleted; a sent one answers
            409 because its recipient rows are the club's record of what it sent. */}
        {campaign.recipientCount === 0 && (
          <button
            type="button"
            className={`${f.submit} ${f.submitDanger}`}
            disabled={pending}
            onClick={() => run(() => deleteCampaignAction(campaign.id))}
          >
            Sil
          </button>
        )}
      </div>

      {sendBlockedReason !== null ? (
        <p className={styles.hint}>
          Gönderilebilmesi için: <strong>{sendBlockedReason}</strong>
        </p>
      ) : (
        <>
          <div className={f.row} style={{ marginTop: 16 }}>
            <div className={f.field}>
              <label className={f.label} htmlFor="c-when">
                Zamanla (İzmir saati)
              </label>
              <input
                id="c-when"
                type="datetime-local"
                className={f.input}
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
            {/*
              `styles.actionBar` rather than `f.field`, which is a flex child that grows —
              the button stretched the full width of its half of the row and read as a
              second input box. This is the same pattern the buttons above use.
            */}
            <div className={styles.actionBar} style={{ alignSelf: "end", marginTop: 0 }}>
              <button
                type="button"
                className={`${f.submit} ${f.submitGhost}`}
                disabled={pending || when === ""}
                onClick={() => run(() => scheduleCampaignAction(campaign.id, when))}
              >
                Zamanla
              </button>
            </div>
          </div>

          <div className={styles.danger}>
            <p className={styles.dangerTitle}>Şimdi gönder</p>
            <p className={styles.dangerText}>
              Bu işlem geri alınamaz.{" "}
              {audiencePreview === null ? (
                <>Segmentteki tüm üyelere gerçek e-posta gönderilir.</>
              ) : (
                <>
                  Şu anda segmentte <strong>{audiencePreview} üye</strong> var; e-posta izni
                  olmayanlar gönderim anında elenir ve listede «Gönderilmedi» olarak görünür.
                </>
              )}{" "}
              Önce kendinize test göndermeniz önerilir.
            </p>

            {armed ? (
              <div className={styles.actionBar}>
                <button
                  type="button"
                  className={`${f.submit} ${f.submitDanger}`}
                  disabled={pending}
                  onClick={() => run(() => sendCampaignAction(campaign.id))}
                >
                  {pending ? "Gönderiliyor…" : "Evet, gönder"}
                </button>
                <button
                  type="button"
                  className={`${f.submit} ${f.submitGhost}`}
                  disabled={pending}
                  onClick={() => setArmed(false)}
                >
                  Vazgeç
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`${f.submit} ${f.submitDanger}`}
                disabled={pending}
                onClick={() => setArmed(true)}
              >
                Gönder
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
