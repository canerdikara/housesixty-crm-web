"use client";

import Link from "next/link";
import { ActionForm, SubmitButton, formStyles as f } from "@/components/Form";
import { createLeadAction } from "../actions";
import {
  CONSENT_CHANNELS,
  INTEREST_CATEGORIES,
  LEAD_SOURCES,
  consentChannelLabel,
  interestLabel,
  leadSourceLabel,
} from "@/lib/labels";

/**
 * Manual lead entry — reception, walk-ins, a name taken at an event.
 *
 * `WEBSITE_FORM` is absent from the source list on purpose. The backend reserves it
 * for the public endpoint and rejects it here with a 400; leaving it selectable would
 * offer an option that always fails. More to the point, source reporting is only
 * worth anything if "web sitesi formu" means the form.
 */
export function NewLeadForm({ consentTextVersion }: { consentTextVersion: string }) {
  const sources = LEAD_SOURCES.filter((s) => s !== "WEBSITE_FORM");

  return (
    <ActionForm action={createLeadAction}>
      <input type="hidden" name="consentTextVersion" value={consentTextVersion} />

      <div className={f.field}>
        <label className={`${f.label} ${f.required}`} htmlFor="l-name">Ad Soyad</label>
        <input id="l-name" name="fullName" className={f.input} required autoFocus />
      </div>

      <div className={f.row}>
        <div className={f.field}>
          <label className={f.label} htmlFor="l-phone">Telefon</label>
          <input id="l-phone" name="phone" className={f.input} inputMode="tel"
            placeholder="0532 000 00 00" />
        </div>
        <div className={f.field}>
          <label className={f.label} htmlFor="l-email">E-posta</label>
          <input id="l-email" name="email" type="email" className={f.input}
            autoCapitalize="none" spellCheck={false} />
        </div>
      </div>
      {/* Neither is individually required, but a lead nobody can contact is not a lead. */}
      <p className={f.hint}>Telefon veya e-postadan en az biri gerekli.</p>

      <div className={f.row}>
        <div className={f.field}>
          <label className={f.label} htmlFor="l-source">Kaynak</label>
          <select id="l-source" name="source" className={f.select} defaultValue="WALK_IN">
            {sources.map((s) => <option key={s} value={s}>{leadSourceLabel(s)}</option>)}
          </select>
        </div>
        <div className={f.field}>
          <label className={f.label} htmlFor="l-interest">İlgi alanı</label>
          <select id="l-interest" name="interestedIn" className={f.select} defaultValue="">
            <option value="">— belirtilmedi —</option>
            {INTEREST_CATEGORIES.map((c) => (
              <option key={c} value={c}>{interestLabel(c)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={f.row}>
        <div className={f.field}>
          <label className={f.label} htmlFor="l-birth">Doğum yılı</label>
          <input id="l-birth" name="birthYear" className={f.input} inputMode="numeric"
            pattern="[0-9]*" maxLength={4} placeholder="1990" />
        </div>
        <div className={f.field}>
          <label className={f.label} htmlFor="l-city">Şehir</label>
          <input id="l-city" name="city" className={f.input} defaultValue="İzmir" />
        </div>
      </div>

      <div className={f.row}>
        <div className={f.field}>
          <label className={f.label} htmlFor="l-occ">Meslek</label>
          <input id="l-occ" name="occupation" className={f.input} />
        </div>
        <div className={f.field}>
          <label className={f.label} htmlFor="l-co">Şirket</label>
          <input id="l-co" name="company" className={f.input} />
        </div>
      </div>

      <div className={f.field}>
        <label className={f.label} htmlFor="l-notes">Notlar</label>
        <textarea id="l-notes" name="notes" className={f.textarea}
          placeholder="Nasıl geldi, ne ile ilgileniyor?" />
      </div>

      {/*
        Consent is not optional and not a formality. Typing someone's details into the
        CRM is processing personal data exactly as the website form is, and KVKK does
        not care that a member of staff did the typing. The version is recorded so the
        record names the document they were actually read.
      */}
      <div className={f.disclosure}>
        <label className={f.checkRow}>
          <input type="checkbox" name="consentGranted" className={f.checkbox} />
          <span>
            <strong>KVKK aydınlatma metni okundu ve açık rıza alındı.</strong>
            <br />
            <span className={f.hint}>
              Metin sürümü {consentTextVersion} olarak kaydedilir. Rıza olmadan aday
              kaydedilemez.
            </span>
          </span>
        </label>

        <div className={f.field} style={{ marginTop: 12 }}>
          <span className={f.label}>Onaylanan iletişim kanalları</span>
          <div className={f.checkGroup}>
            {CONSENT_CHANNELS.map((c) => (
              <label key={c} className={f.checkInline}>
                <input type="checkbox" name="consentChannels" value={c} className={f.checkbox} />
                {consentChannelLabel(c)}
              </label>
            ))}
          </div>
          {/*
            Empty is a real answer, not an omission: consent to be contacted about this
            enquiry is what makes the lead lawful; marketing permission is separate.
          */}
          <p className={f.hint}>
            Hiçbiri seçilmezse yalnızca bu başvuru için işleme rızası kaydedilir —
            pazarlama izni verilmemiş sayılır.
          </p>
        </div>
      </div>

      <div className={f.actions}>
        <SubmitButton pendingLabel="Kaydediliyor…">Adayı kaydet</SubmitButton>
        <Link href="/leads" className={`${f.submit} ${f.submitGhost}`}>Vazgeç</Link>
      </div>
    </ActionForm>
  );
}
