"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormMessage, formStyles as f } from "@/components/Form";
import { saveCampaignAction } from "./actions";
import type { CampaignChannel, CampaignDetail, SegmentListItem } from "@/lib/types";
import { CHANNEL_LABELS } from "@/lib/types";
import styles from "./campaigns.module.css";

/**
 * Write a campaign. Mockup screen 12's "Gönderilen içerik" card, before it was sent.
 *
 * The same component creates and edits, because it is the same screen — the only
 * difference is whether there is an id to PUT to.
 *
 * ## Two channels, and they do not take the same message
 *
 * «E-posta» and «WhatsApp» are independent toggles, so a campaign may go out on either
 * or both. What they are **not** is two renderings of one piece of copy: Meta does not
 * carry free-form marketing, so a WhatsApp campaign sends a template approved in Meta
 * Business Manager and named here, while the body below is the email and only the email.
 * The form shows each channel's fields only when that channel is on, because a subject
 * line on a WhatsApp-only campaign is a field that will never be used.
 *
 * SMS and Push are deliberately absent rather than disabled: nothing sends them, and a
 * greyed-out button invites somebody to ask when it will be un-greyed.
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
  const [channels, setChannels] = useState<CampaignChannel[]>(
    campaign?.campaign.channels ?? ["EMAIL"],
  );
  const [templateRef, setTemplateRef] = useState(campaign?.templateRef ?? "");
  const [templateLanguage, setTemplateLanguage] = useState(campaign?.templateLanguage ?? "tr");
  const [templateParams, setTemplateParams] = useState(
    (campaign?.templateParams ?? []).join(", "),
  );

  const chosen = segments.find((s) => s.id === segmentId) ?? null;
  const usesEmail = channels.includes("EMAIL");
  const usesWhatsApp = channels.includes("WHATSAPP");

  /**
   * Toggle a channel, refusing to turn the last one off.
   *
   * A campaign with no channel cannot be sent and the backend refuses to save one, so
   * letting the button reach that state would mean an error on save for something the
   * form could simply decline. The last active button reads as selected and does nothing.
   */
  function toggleChannel(channel: CampaignChannel) {
    setChannels((current) =>
      current.includes(channel)
        ? current.length === 1
          ? current
          : current.filter((c) => c !== channel)
        : [...current, channel],
    );
  }

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
        channels,
        templateRef: templateRef.trim(),
        templateLanguage: templateLanguage.trim(),
        // Comma-separated in the box because that is how somebody types a short ordered
        // list; an array on the wire because order is what makes it meaningful.
        templateParams: templateParams
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p !== ""),
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
          <span className={f.label}>Gönderim kanalı</span>
          <div className={styles.channelPicker} role="group" aria-label="Gönderim kanalı">
            {(["EMAIL", "WHATSAPP"] as const).map((channel) => {
              const on = channels.includes(channel);
              return (
                <button
                  key={channel}
                  type="button"
                  // `aria-pressed` rather than a checkbox role: these are toggle buttons,
                  // and a screen reader has to say which are on — the styling alone does
                  // not carry that.
                  aria-pressed={on}
                  className={`${styles.channelButton} ${on ? styles.channelButtonOn : ""}`}
                  onClick={() => toggleChannel(channel)}
                >
                  {CHANNEL_LABELS[channel]}
                </button>
              );
            })}
          </div>
          <p className={styles.mergeNote}>
            İkisi birden seçilirse segmentteki her üyeye <strong>hem e-posta hem WhatsApp
            mesajı</strong> gider. Her kanalın izni ayrı okunur: yalnızca e-posta iznine
            sahip bir üye yalnızca e-posta alır.
          </p>
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

        {/* Both the subject and the body belong to email alone, so they share one
            conditional — and therefore one fragment, since a JSX expression holds a
            single root. */}
        {usesEmail && (
        <>
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
        </>
        )}

        {usesWhatsApp && (
          <div className={styles.templateCard}>
            <p className={styles.templateTitle}>WhatsApp şablonu</p>
            <p className={styles.mergeNote}>
              WhatsApp pazarlama mesajları <strong>serbest metin olarak gönderilemez</strong>.
              Meta Business Manager’da oluşturup onaylattığınız şablonun adını buraya yazın;
              yukarıdaki içerik yalnızca e-posta için kullanılır.
            </p>

            <div className={f.row}>
              <div className={f.field}>
                <label className={f.label} htmlFor="c-template">
                  Şablon adı
                </label>
                <input
                  id="c-template"
                  className={f.input}
                  value={templateRef}
                  maxLength={160}
                  onChange={(e) => setTemplateRef(e.target.value)}
                  placeholder="eylul_americano_duyuru"
                />
              </div>

              <div className={f.field}>
                <label className={f.label} htmlFor="c-template-lang">
                  Şablon dili
                </label>
                <input
                  id="c-template-lang"
                  className={f.input}
                  value={templateLanguage}
                  maxLength={10}
                  onChange={(e) => setTemplateLanguage(e.target.value)}
                  placeholder="tr"
                />
              </div>
            </div>

            <div className={f.field}>
              <label className={f.label} htmlFor="c-template-params">
                Şablon değişkenleri
              </label>
              <input
                id="c-template-params"
                className={f.input}
                value={templateParams}
                onChange={(e) => setTemplateParams(e.target.value)}
                placeholder="ad"
              />
              <p className={styles.mergeNote}>
                Şablondaki <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code> … sırasına
                karşılık gelir — virgülle ayırın. Kullanılabilir değerler:{" "}
                <code>{"ad"}</code>, <code>{"tam_ad"}</code>.{" "}
                <strong>Sıra önemlidir</strong>, ve sayı şablondakiyle birebir aynı
                olmalıdır; aksi hâlde Meta mesajı reddeder.
              </p>
            </div>
          </div>
        )}

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
          Gerçek alıcı listesi gönderim anında yeniden hesaplanır, ve seçilen kanalın
          iznine sahip olmayan üyeler o anda elenir. Buradaki sayı segmentin son
          çalıştırıldığı andaki büyüklüğüdür.
        </p>
        {usesWhatsApp && (
          <p className={styles.audienceNote}>
            <strong>WhatsApp için ayrı izin aranır.</strong> Kaydı olmayan üyeye mesaj
            gönderilmez — e-postadan farklı olarak burada sessizlik onay sayılmaz. Telefon
            numarası olmayan üyeler de elenir.
          </p>
        )}
      </aside>
    </div>
  );
}
