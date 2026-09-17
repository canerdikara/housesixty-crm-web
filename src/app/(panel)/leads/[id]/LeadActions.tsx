"use client";

import Link from "next/link";

import { useState } from "react";
import { ActionForm, Disclosure, SubmitButton, formStyles as f } from "@/components/Form";
import { BirthDateField } from "@/components/BirthDateField";
import {
  addInteractionAction,
  updateLeadAction,
  updateLeadProfileAction,
  updateOwnerAction,
  updateStatusAction,
} from "../actions";
import {
  INTERACTION_TYPES,
  LEAD_INTEREST_CATEGORIES,
  LEAD_SOURCES,
  interactionTypeLabel,
  interestLabel,
  leadSourceLabel,
  leadStatusLabel,
} from "@/lib/labels";
import type { InterestCategory, LeadDetail } from "@/lib/types";

/** The stages a human may set directly. WON is reached by converting, LOST has its own form. */
const SETTABLE = ["NEW", "CONTACTED", "VISITED", "PROPOSAL_SENT"] as const;

type PanelUser = { id: string; fullName: string; role: string };

/** İzmir's calendar date, for date input defaults — never the browser's. */
function izmirToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function LogInteraction({ lead }: { lead: LeadDetail }) {
  return (
    <ActionForm action={addInteractionAction} hiddenFields={{ leadId: lead.id }}>
      {/*
        Radios, not checkboxes: **one channel per entry** (user, 2026-09-16, after
        testing the multi-select that shipped earlier that day).
        
        The chips are kept — they read better than a select and are quicker to hit —
        but `type="radio"` means the browser enforces the single choice, so the server
        action's `getAll("type")` simply returns one value and needs no change. The V36
        `additional_types` column stays in place, unused from here: it is deployed,
        harmless, and reverting a migration to undo a UI decision would cost more than
        leaving one nullable column empty.

        Telephone is pre-selected so the commonest entry needs no clicking, and a radio
        group cannot be emptied once set — which quietly removes the "nothing ticked"
        case the checkbox version had to guard against.
      */}
      <fieldset className={f.fieldset}>
        <legend className={f.label}>Tür</legend>
        <div className={f.chipGroup}>
          {INTERACTION_TYPES.map((t) => (
            <label key={t} className={f.chipCheck}>
              <input type="radio" name="type" value={t} defaultChecked={t === "CALL"} />
              <span>{interactionTypeLabel(t)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {/* Half-width on its own row, exactly as it was when the type select sat beside it. */}
      <div className={f.row}>
        <div className={f.field}>
          <label className={f.label} htmlFor="i-date">Tarih</label>
          {/*
            Left empty on purpose, meaning "now". Pre-filling today would make writing
            up yesterday's calls a silent mistake — the field would look answered.
          */}
          <input id="i-date" name="occurredOn" type="date" className={f.input} max={izmirToday()} />
        </div>
      </div>
      <div className={f.field}>
        <label className={`${f.label} ${f.required}`} htmlFor="i-note">Not</label>
        <textarea id="i-note" name="note" className={f.textarea} required
          placeholder="Ne konuşuldu, ne kararlaştırıldı?" />
      </div>
      <p className={f.hint}>
        Telefon, WhatsApp, e-posta, SMS, görüşme ve ziyaret «son temas» tarihini
        günceller. Not güncellemez.
      </p>
      <div className={f.actions}><SubmitButton>Etkileşim ekle</SubmitButton></div>
    </ActionForm>
  );
}

export function ChangeStatus({ lead }: { lead: LeadDetail }) {
  // The reason box only appears once LOST is chosen — it is required then and
  // meaningless otherwise.
  const [status, setStatus] = useState<string>(
    SETTABLE.includes(lead.status as (typeof SETTABLE)[number]) ? lead.status : "CONTACTED"
  );
  const isLost = status === "LOST";

  if (lead.convertedUserId) {
    return (
      <p className={f.hint} style={{ margin: 0 }}>
        Bu aday üyeye dönüştürüldü. Durumu artık değiştirilemez.
      </p>
    );
  }

  return (
    <ActionForm action={updateStatusAction} hiddenFields={{ leadId: lead.id }}>
      <div className={f.field}>
        <label className={f.label} htmlFor="s-status">Durum</label>
        <select id="s-status" name="status" className={f.select} value={status}
          onChange={(e) => setStatus(e.target.value)}>
          {SETTABLE.map((s) => (
            <option key={s} value={s}>{leadStatusLabel(s)}</option>
          ))}
          <option value="LOST">{leadStatusLabel("LOST")}</option>
        </select>
      </div>

      {isLost && (
        <div className={f.field}>
          <label className={`${f.label} ${f.required}`} htmlFor="s-reason">Sebep</label>
          <input id="s-reason" name="lostReason" className={f.input} required
            placeholder="Fiyat, şehir değişikliği, ilgilenmiyor…" />
          <p className={f.hint}>
            Sebep zorunlu — sebepsiz kaybedilen aday, «neden kaybediyoruz» sorusunu
            hiçbir zaman yanıtlayamaz.
          </p>
        </div>
      )}

      <div className={f.actions}>
        <SubmitButton variant={isLost ? "danger" : "primary"}>
          {isLost ? "Olumsuz olarak işaretle" : "Durumu güncelle"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AssignOwner({ lead, users }: { lead: LeadDetail; users: PanelUser[] }) {
  return (
    <ActionForm action={updateOwnerAction} hiddenFields={{ leadId: lead.id }}>
      <div className={f.field}>
        <label className={f.label} htmlFor="o-owner">Sorumlu</label>
        <select id="o-owner" name="ownerUserId" className={f.select}
          defaultValue={lead.ownerUserId ?? ""}>
          <option value="">— atanmadı —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </select>
      </div>
      <div className={f.actions}><SubmitButton variant="ghost">Ata</SubmitButton></div>
    </ActionForm>
  );
}

export function NextActionAndNotes({ lead }: { lead: LeadDetail }) {
  const hasCurrent = Boolean(lead.nextActionNote || lead.notes);

  return (
    <ActionForm action={updateLeadAction} hiddenFields={{ leadId: lead.id }}>
      {/*
        What is on file, shown *above* the form rather than loaded into it.
        
        The boxes used to open pre-filled with these values, which was wrong twice over:
        after saving, the text you had just typed sat there looking unsaved (user,
        2026-09-16), and a pre-filled box invites clearing it — which this endpoint
        cannot express, since a PATCH reads an absent field as "leave alone". Blank
        boxes say what the form actually does: write something new over the top.
      */}
      {hasCurrent && (
        <div className={f.readback}>
          {lead.nextActionNote && (
            <p><strong>Aksiyon:</strong> {lead.nextActionNote}</p>
          )}
          {lead.notes && (
            <p style={{ whiteSpace: "pre-wrap" }}><strong>Notlar:</strong> {lead.notes}</p>
          )}
        </div>
      )}

      <div className={f.row}>
        <div className={f.field}>
          <label className={f.label} htmlFor="n-date">Sonraki adım tarihi</label>
          <input id="n-date" name="nextActionOn" type="date" className={f.input} />
        </div>
        <div className={f.field}>
          <label className={f.label} htmlFor="n-note">Aksiyon</label>
          <input id="n-note" name="nextActionNote" className={f.input}
            placeholder="Tekrar ara, teklif hazırla…" />
        </div>
      </div>
      <div className={f.field}>
        <label className={f.label} htmlFor="n-notes">Notlar</label>
        <textarea id="n-notes" name="notes" className={f.textarea} placeholder="Ekip notları" />
      </div>
      {/*
        Still stated, because it is still true: a PATCH cannot say "make this empty".
        Leaving a box blank now means "leave it alone", which is the same thing the
        endpoint does — so the form and the API finally agree.
      */}
      <p className={f.hint}>
        Boş bıraktığınız alanlar değişmez. Bir alanı tamamen boşaltmak şu an mümkün
        değil; üzerine yazın.
      </p>
      <div className={f.actions}><SubmitButton variant="ghost">Kaydet</SubmitButton></div>
    </ActionForm>
  );
}

export function ConvertLead({ lead }: { lead: LeadDetail }) {
  if (lead.convertedUserId) {
    return (
      <p className={f.hint} style={{ margin: 0 }}>
        Üyeye dönüştürüldü. <Link href={`/members/${lead.convertedUserId}`}>Üye sayfası</Link>
      </p>
    );
  }

  /*
   * A link to its own page, not a form here.
   *
   * Conversion stopped being "press the button" when it started collecting the
   * emergency contact, the payment, the identity document, the car and the signed
   * contract (V39). That is a desk interview, and it does not fit under a timeline —
   * nor should a file input live in a box someone opens by accident.
   */
  return (
    <>
      <p className={f.hint} style={{ marginBottom: 10 }}>
        Üye hesabı açılır, etkileşim geçmişi taşınır ve üyelik bilgileri kaydedilir.
      </p>
      <div className={f.actions}>
        <Link className={f.submit} href={`/leads/${lead.id}/convert`}>
          Üyeye dönüştür
        </Link>
      </div>
    </>
  );
}


// ── Profile ──────────────────────────────────────────────────────────────────

/**
 * Everything about a lead that is not its stage, its owner or its notes.
 *
 * Until this existed nothing on the screen could be corrected: the only write was a
 * PATCH carrying notes and the next action, so a mistyped phone number or a mis-ticked
 * interest was permanent. It sits behind a disclosure below the read view, as the
 * member 360's editors do — the detail screen is something people scan, and a wall of
 * open inputs is a different screen.
 */
export function EditLeadProfile({ lead }: { lead: LeadDetail }) {
  const [source, setSource] = useState<string>(lead.source);

  /*
   * Seeded from the set, falling back to the single primary.
   *
   * The fallback is not cosmetic: a lead created before interests existed has an
   * `interestedIn` and no rows at all, and without this the editor would open with
   * nothing ticked and the first save would silently erase what it had.
   */
  const [interests, setInterests] = useState<string[]>(
    lead.interests?.length ? lead.interests : lead.interestedIn ? [lead.interestedIn] : []
  );

  /*
   * The five the form offers, plus anything this lead already holds that is not among
   * them.
   *
   * The old dropdown offered all eleven categories, so a lead can be carrying Pilates
   * or Wellness. Rendering only the five would leave that category ticked-but-invisible
   * and the whole-object save would drop it — the same trap the member 360's editor has
   * with its own list. An extra chip is cheaper than silent data loss.
   */
  const held = lead.interests?.length
    ? lead.interests
    : lead.interestedIn ? [lead.interestedIn] : [];
  const offered: InterestCategory[] = [
    ...LEAD_INTEREST_CATEGORIES,
    ...held.filter((c) => !LEAD_INTEREST_CATEGORIES.includes(c)),
  ];

  const toggle = (c: string) =>
    setInterests((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <Disclosure label="Profili düzenle">
      <ActionForm action={updateLeadProfileAction} hiddenFields={{ leadId: lead.id }}>
        {/*
          Said before the first field, because it is the opposite of the notes box lower
          down the same screen. This endpoint is a PUT: an emptied box is stored empty.
        */}
        <p className={f.hint}>
          Bu form profilin tamamını kaydeder — boş bıraktığınız alanlar silinir. Notlar,
          sonraki adım, durum ve sorumlu bu formdan etkilenmez.
        </p>

        <div className={f.field}>
          <label className={`${f.label} ${f.required}`} htmlFor="p-name">Ad Soyad</label>
          <input id="p-name" name="fullName" className={f.input} required
            defaultValue={lead.fullName} maxLength={160} />
        </div>

        <div className={f.row}>
          <div className={f.field}>
            <label className={f.label} htmlFor="p-phone">Telefon</label>
            <input id="p-phone" name="phone" className={f.input} inputMode="tel"
              defaultValue={lead.phone ?? ""} maxLength={30} />
          </div>
          <div className={f.field}>
            <label className={f.label} htmlFor="p-email">E-posta</label>
            <input id="p-email" name="email" type="email" className={f.input}
              autoCapitalize="none" spellCheck={false}
              defaultValue={lead.email ?? ""} maxLength={200} />
          </div>
        </div>
        <p className={f.hint}>Telefon veya e-postadan en az biri gerekli.</p>

        <div className={f.row}>
          {/*
            Seeded from the date when there is one and from the bare year otherwise, so
            a lead that arrived from the website form opens with its year already
            selected rather than with the whole field empty.
          */}
          <BirthDateField idPrefix="p-birth" value={lead.birthDate} yearOnly={lead.birthYear} />
          <div className={f.field}>
            <label className={f.label} htmlFor="p-city">Şehir</label>
            <input id="p-city" name="city" className={f.input}
              defaultValue={lead.city ?? ""} maxLength={100} />
          </div>
        </div>

        <div className={f.row}>
          <div className={f.field}>
            <label className={f.label} htmlFor="p-occ">Meslek</label>
            <input id="p-occ" name="occupation" className={f.input}
              defaultValue={lead.occupation ?? ""} maxLength={160} />
          </div>
          <div className={f.field}>
            <label className={f.label} htmlFor="p-co">Şirket</label>
            <input id="p-co" name="company" className={f.input}
              defaultValue={lead.company ?? ""} maxLength={160} />
          </div>
        </div>

        <div className={f.field}>
          <label className={f.label} htmlFor="p-address">Adres</label>
          <textarea id="p-address" name="address" className={f.textarea} rows={2}
            style={{ minHeight: 56 }} defaultValue={lead.address ?? ""} maxLength={1000} />
        </div>

        <div className={f.row}>
          <div className={f.field}>
            <label className={f.label} htmlFor="p-source">Kaynak</label>
            {/*
              WEBSITE_FORM is offered only to a lead that already carries it. It cannot
              be chosen — source reporting is worth nothing if "web sitesi formu" can be
              typed in by hand — but a website enquiry still has to be editable without
              being relabelled first.
            */}
            <select id="p-source" name="source" className={f.select} value={source}
              onChange={(e) => setSource(e.target.value)}>
              {LEAD_SOURCES
                .filter((s) => s !== "WEBSITE_FORM" || lead.source === "WEBSITE_FORM")
                .map((s) => <option key={s} value={s}>{leadSourceLabel(s)}</option>)}
            </select>
          </div>
        </div>

        {source === "REFERRAL" && (
          <div className={f.field}>
            <label className={f.label} htmlFor="p-ref">Referans veren üye</label>
            <input id="p-ref" name="referredByName" className={f.input} maxLength={160}
              defaultValue={lead.referredByName ?? ""} placeholder="Ad Soyad" />
          </div>
        )}

        {source === "EVENT" && (
          <div className={f.field}>
            <label className={f.label} htmlFor="p-event">Etkinlik adı</label>
            <input id="p-event" name="eventName" className={f.input} maxLength={160}
              defaultValue={lead.eventName ?? ""} placeholder="Örn. Açılış Turnuvası" />
          </div>
        )}

        <fieldset className={f.fieldset}>
          <legend className={f.label}>İlgi alanları</legend>
          <div className={f.chipGroup}>
            {offered.map((c) => (
              <label key={c} className={f.chipCheck}>
                {/* Controlled, so the ticks survive changing the source above them. */}
                <input type="checkbox" name="interests" value={c}
                  checked={interests.includes(c)} onChange={() => toggle(c)} />
                <span>{interestLabel(c)}</span>
              </label>
            ))}
          </div>
          <p className={f.hint}>Hiçbiri seçili değilse ilgi alanları silinir.</p>
        </fieldset>

        <div className={f.actions}><SubmitButton>Profili kaydet</SubmitButton></div>
      </ActionForm>
    </Disclosure>
  );
}
