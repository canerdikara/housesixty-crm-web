"use client";

import { useState } from "react";
import Link from "next/link";
import { ActionForm, SubmitButton, formStyles as f } from "@/components/Form";
import { BirthDateField } from "@/components/BirthDateField";
import { createLeadAction } from "../actions";
import {
  CONSENT_CHANNELS,
  LEAD_INTEREST_CATEGORIES,
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

  /*
   * Two of the source values want a follow-up question, and only ever one of them:
   * a referral wants the member's name, an event wants the event's.
   *
   * Both inputs are **controlled**, so switching the source away and back does not
   * discard what was already typed — React unmounts the field, and an uncontrolled
   * input's value would go with it. The one that is not on screen is not submitted at
   * all, and the backend drops a mismatched value anyway, so the source on the saved
   * lead and the detail beside it cannot disagree.
   */
  const [source, setSource] = useState("WALK_IN");
  const [referredByName, setReferredByName] = useState("");
  const [eventName, setEventName] = useState("");

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
          <select id="l-source" name="source" className={f.select} value={source}
            onChange={(e) => setSource(e.target.value)}>
            {sources.map((s) => <option key={s} value={s}>{leadSourceLabel(s)}</option>)}
          </select>
        </div>
      </div>

      {source === "REFERRAL" && (
        <div className={f.field}>
          <label className={f.label} htmlFor="l-ref">Referans veren üye</label>
          <input id="l-ref" name="referredByName" className={f.input}
            value={referredByName} onChange={(e) => setReferredByName(e.target.value)}
            placeholder="Ad Soyad" />
          {/* Not required: "a friend recommended you, I forget who" is a real answer,
              and refusing the lead over it loses more than the blank field costs. */}
          <p className={f.hint}>Adayı yönlendiren üyenin adı soyadı.</p>
        </div>
      )}

      {source === "EVENT" && (
        <div className={f.field}>
          <label className={f.label} htmlFor="l-event">Etkinlik adı</label>
          <input id="l-event" name="eventName" className={f.input}
            value={eventName} onChange={(e) => setEventName(e.target.value)}
            placeholder="Örn. Açılış Turnuvası" />
          <p className={f.hint}>Adayın tanıştığı etkinliğin adı.</p>
        </div>
      )}

      {/*
        Interests replace what was a single «İlgi alanı» dropdown. Someone enquiring
        about padel who also wants the spa is the normal case, and the dropdown could
        only record one of them.

        Every box is named `interests`; the backend takes the first in category order as
        the primary and writes it to `interested_in`, which is what the leads list chip
        and the pipeline card still read. Derived rather than asked for separately, so
        the chip can never contradict the list beside it.
      */}
      <fieldset className={f.fieldset}>
        <legend className={f.label}>İlgi alanları</legend>
        <div className={f.chipGroup}>
          {LEAD_INTEREST_CATEGORIES.map((c) => (
            <label key={c} className={f.chipCheck}>
              <input type="checkbox" name="interests" value={c} />
              <span>{interestLabel(c)}</span>
            </label>
          ))}
        </div>
        <p className={f.hint}>Birden fazla seçilebilir.</p>
      </fieldset>

      <div className={f.row}>
        <BirthDateField idPrefix="l-birth" />
        <div className={f.field}>
          <label className={f.label} htmlFor="l-city">Şehir</label>
          <input id="l-city" name="city" className={f.input} defaultValue="İzmir" />
        </div>
      </div>

      {/*
        A textarea, not an input: a Turkish address runs to three or four lines
        (mahalle / cadde / no / daire / ilçe) and a single-line box invites the kind of
        truncation nobody notices until something has to be posted.
      */}
      <div className={f.field}>
        <label className={f.label} htmlFor="l-address">Adres</label>
        <textarea id="l-address" name="address" className={f.textarea} rows={2}
          style={{ minHeight: 56 }} placeholder="Mahalle, cadde, no, daire, ilçe" />
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
