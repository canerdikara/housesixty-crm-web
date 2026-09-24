"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormMessage, formStyles as f } from "@/components/Form";
import { saveCampaignAction } from "./actions";
import type { CampaignDetail, SegmentListItem } from "@/lib/types";
import styles from "./campaigns.module.css";

/**
 * Write a campaign. Mockup screen 12's "Gönderilen içerik" card, before it was sent.
 *
 * The same component creates and edits, because it is the same screen — the only
 * difference is whether there is an id to PUT to. Channel is not offered: only EMAIL
 * exists, and the backend refuses to create anything else until WhatsApp and SMS have
 * their integrations.
 *
 * ## It cannot send
 *
 * Saving a campaign and sending one are deliberately different actions on different
 * screens. A save button that could also start mail going to the membership is one
 * mis-click away from an accident nobody can recall, so this form's only outcome is a
 * draft — the send lives on the detail screen behind its own confirmation.
 */
export function CampaignEditor({
  campaign,
  segments,
}: {
  /** Null when creating. */
  campaign: CampaignDetail | null;
  segments: SegmentListItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ error?: string; ok?: string }>({});

  const [name, setName] = useState(campaign?.campaign.name ?? "");
  const [segmentId, setSegmentId] = useState(campaign?.campaign.segmentId ?? "");
  const [subject, setSubject] = useState(campaign?.campaign.subject ?? "");
  const [body, setBody] = useState(campaign?.body ?? "");

  const chosen = segments.find((s) => s.id === segmentId) ?? null;

  function save() {
    setState({});
    start(async () => {
      const result = await saveCampaignAction({
        id: campaign?.campaign.id,
        name: name.trim(),
        // "" is the empty `<option>`, and it must reach the backend as null rather than
        // as an empty string it would try to parse as a UUID.
        segmentId: segmentId || null,
        subject: subject.trim(),
        body,
      });
      if ("error" in result) {
        setState({ error: result.error });
        return;
      }
      router.push(`/campaigns/${result.id}`);
    });
  }

  return (
    <div className={styles.editorGrid}>
      <div className={styles.stack}>
        <FormMessage state={state} />

        <div className={f.field}>
          <label className={f.label} htmlFor="c-name">
            Kampanya adı
          </label>
          <input
            id="c-name"
            className={f.input}
            value={name}
            maxLength={160}
            onChange={(e) => setName(e.target.value)}
            placeholder="Eylül · Geri kazanım"
          />
        </div>

        <div className={f.field}>
          <label className={f.label} htmlFor="c-segment">
            Segment
          </label>
          <select
            id="c-segment"
            className={f.input}
            value={segmentId}
            onChange={(e) => setSegmentId(e.target.value)}
          >
            <option value="">Segment seçin…</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {/* The saved count, not a live one — that is what the panel beside this
                    box shows, and printing two different numbers for the same segment on
                    one screen would be worse than printing one. */}
                {s.lastCount !== null ? ` · ${s.lastCount} üye` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className={f.field}>
          <label className={f.label} htmlFor="c-subject">
            Konu satırı
          </label>
          <input
            id="c-subject"
            className={f.input}
            value={subject}
            maxLength={300}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Cumartesi sabahı kortlar sizin — Americano turnuvası"
          />
        </div>

        <div className={f.field}>
          <label className={f.label} htmlFor="c-body">
            İçerik
          </label>
          <textarea
            id="c-body"
            className={f.input}
            rows={14}
            value={body}
            maxLength={20000}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"<p>Merhaba {ad},</p>\n<p>Bu cumartesi 09:00'da…</p>"}
          />
          <p className={styles.mergeNote}>
            <code>{"{ad}"}</code> üyenin adı, <code>{"{tam_ad}"}</code> tam adı olarak
            değiştirilir. HTML yazabilirsiniz. Her e-postanın altına, siz eklemeseniz de,
            <strong> abonelikten çıkma bağlantısı</strong> eklenir — konumunu kendiniz
            seçmek isterseniz metne <code>{"{abonelik_iptal}"}</code> yazın.
          </p>
        </div>

        <div className={styles.actionBar}>
          <button
            type="button"
            className={f.submit}
            onClick={save}
            disabled={pending || name.trim() === ""}
          >
            {pending ? "Kaydediliyor…" : campaign ? "Değişiklikleri kaydet" : "Taslak olarak kaydet"}
          </button>
        </div>
        <p className={styles.hint}>
          Kaydetmek göndermez. Gönderim, kampanya sayfasındaki ayrı onay adımındadır.
        </p>
      </div>

      <aside className={styles.audience}>
        <p className={styles.audienceLabel}>Seçilen segment</p>
        <p className={styles.audienceValue}>
          {/* Em dash for "no segment chosen" and for "never counted" alike — neither is
              a number of members, and 0 would claim it was. */}
          {chosen?.lastCount ?? "—"}
        </p>
        <p className={styles.audienceLabel}>{chosen ? chosen.name : "Henüz seçilmedi"}</p>
        <p className={styles.audienceNote}>
          Gerçek alıcı listesi gönderim anında yeniden hesaplanır, ve e-posta izni
          olmayan üyeler o anda elenir. Buradaki sayı segmentin son çalıştırıldığı
          andaki büyüklüğüdür.
        </p>
      </aside>
    </div>
  );
}
