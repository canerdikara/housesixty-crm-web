"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { FormMessage, formStyles as f } from "@/components/Form";
import {
  cancelCampaignAction,
  deleteCampaignAction,
  scheduleCampaignAction,
  sendCampaignAction,
  testSendAction,
} from "./actions";
import type { CampaignDetail } from "@/lib/types";
import { CHANNEL_LABELS } from "@/lib/types";
import styles from "./campaigns.module.css";

/**
 * Everything that can be done to a campaign that has not gone out yet.
 *
 * ## The send is not a button
 *
 * It is a modal confirmation that **names every channel and what each one will do**, and
 * that is the whole reason this component exists rather than a row of `ActionForm`s.
 * Every other write in this panel is undoable — a wrong lead status is one more click to
 * fix. This one puts a real message on a real member's phone and in their inbox, and
 * there is no second click that takes it back.
 *
 * ⚠️ **Naming the channels is the point of the dialog, not decoration.** Since V49 a
 * campaign may send on two, and the difference between «E-posta» and «E-posta ·
 * WhatsApp» is one chip on a screen an admin has stopped reading. The dialog states each
 * channel on its own line, says which cannot go and why, and makes the admin confirm
 * against that list — so a WhatsApp message nobody intended cannot be sent by pressing a
 * button that looked the same yesterday.
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
  const cancelRef = useRef<HTMLButtonElement>(null);

  const { campaign, audiencePreview, sendBlockedReason, channelBlockedReasons } = detail;
  const editable = campaign.status === "DRAFT" || campaign.status === "SCHEDULED";

  /** Which channels this press would actually send on, and which are only listed. */
  const sendable = campaign.channels.filter((c) => !channelBlockedReasons[c]);
  const blocked = campaign.channels.filter((c) => channelBlockedReasons[c]);

  /*
   * Escape closes it, and focus starts on «Vazgeç».
   *
   * ⚠️ The cancelling control takes focus, not the sending one. A dialog that opens with
   * the irreversible button focused turns a stray Enter — from the keypress that opened
   * it — into a send to the whole membership.
   */
  useEffect(() => {
    if (!armed) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setArmed(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed]);

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
              Bu işlem geri alınamaz. Bu kampanya{" "}
              <strong>{sendable.map((c) => CHANNEL_LABELS[c]).join(" ve ")}</strong>{" "}
              ile gönderilecek.{" "}
              {audiencePreview === null ? (
                <>Segmentteki tüm üyelere gerçek mesaj gider.</>
              ) : (
                <>
                  Şu anda segmentte <strong>{audiencePreview} üye</strong> var; ilgili
                  kanalın iznine sahip olmayanlar gönderim anında elenir ve listede
                  «Gönderilmedi» olarak görünür.
                </>
              )}{" "}
              Önce kendinize test göndermeniz önerilir.
            </p>

            <button
              type="button"
              className={`${f.submit} ${f.submitDanger}`}
              disabled={pending}
              onClick={() => setArmed(true)}
            >
              Gönder
            </button>
          </div>

          {/*
            The confirmation. A real modal rather than an inline arming step, because the
            thing it has to make unmissable is *which channels* — and an inline block that
            appears under a button the admin already pressed is read as "yes, I know".

            `confirm()` is deliberately not used: it cannot show a per-channel list, its
            copy cannot be Turkish-cased, and browsers increasingly suppress it.
          */}
          {armed && (
            <div
              className={styles.confirmOverlay}
              // A click on the backdrop cancels — never confirms. The only path to a send
              // is the button that says so.
              onClick={() => !pending && setArmed(false)}
            >
              <div
                className={styles.confirmBox}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="send-confirm-title"
                onClick={(e) => e.stopPropagation()}
              >
                <p className={styles.confirmTitle} id="send-confirm-title">
                  Göndermek istediğinize emin misiniz?
                </p>

                <p className={styles.confirmLead}>
                  <strong>{campaign.name}</strong>
                  {campaign.segmentName ? <> · {campaign.segmentName}</> : null}
                  {audiencePreview !== null ? <> · {audiencePreview} üye</> : null}
                </p>

                <p className={styles.confirmLabel}>Şu kanallardan gönderilecek</p>
                <ul className={styles.confirmChannels}>
                  {sendable.map((channel) => (
                    <li key={channel} className={styles.confirmChannelOn}>
                      <span aria-hidden="true">✓</span>
                      <span>
                        <strong>{CHANNEL_LABELS[channel]}</strong>
                        {channel === "WHATSAPP" ? (
                          <em> — onaylı şablon, telefonu ve WhatsApp izni olan üyelere</em>
                        ) : (
                          <em> — e-posta izni olan üyelere</em>
                        )}
                      </span>
                    </li>
                  ))}

                  {/* Listed, not hidden. A channel the admin selected and that will not
                      go has to say so here — finding out from an empty funnel afterwards
                      is how somebody concludes the feature is broken. */}
                  {blocked.map((channel) => (
                    <li key={channel} className={styles.confirmChannelOff}>
                      <span aria-hidden="true">✕</span>
                      <span>
                        <strong>{CHANNEL_LABELS[channel]}</strong>
                        <em> — gönderilmeyecek: {channelBlockedReasons[channel]}</em>
                      </span>
                    </li>
                  ))}
                </ul>

                <p className={styles.confirmWarning}>
                  Bu işlem <strong>geri alınamaz</strong>. Gönderilen bir mesaj geri
                  çekilemez.
                </p>

                <div className={styles.actionBar}>
                  <button
                    type="button"
                    ref={cancelRef}
                    className={`${f.submit} ${f.submitGhost}`}
                    disabled={pending}
                    onClick={() => setArmed(false)}
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    className={`${f.submit} ${f.submitDanger}`}
                    disabled={pending}
                    onClick={() => run(() => sendCampaignAction(campaign.id))}
                  >
                    {pending
                      ? "Gönderiliyor…"
                      : `Evet, ${sendable.map((c) => CHANNEL_LABELS[c]).join(" ve ")} gönder`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
