"use client";

import { useActionState, useEffect } from "react";
import { ActionForm, Disclosure, SubmitButton, formStyles as f, FormMessage } from "@/components/Form";
import {
  createTermAction,
  saveInterestsAction,
  savePreferencesAction,
  saveProfileAction,
  updateTermAction,
  saveOnboardingAction,
  uploadContractAction,
  contractLinkAction,
} from "../actions";
import {
  CONSENT_CHANNELS,
  INTEREST_CATEGORIES,
  consentChannelLabel,
  interestLabel,
  renewalStatusLabel,
  termStatusLabel,
  PAYMENT_METHODS,
  paymentMethodLabel,
  EMERGENCY_GENDERS,
} from "@/lib/labels";
import type { FormState } from "@/lib/formState";
import type { MemberDetail, MembershipTerm } from "@/lib/types";

/**
 * The editing controls on the Üye 360 — mockup screen 7.
 *
 * Each one sits *below* the card's read view rather than replacing it, revealed by a
 * disclosure. The 360 is a screen people scan, and a screen of form fields is a
 * different screen; opening one section to edit it leaves the other eleven readable.
 *
 * Every form here is prefilled with what is currently stored, and that is load-bearing
 * rather than a courtesy: profile, interests and preferences are whole-object PUTs, so
 * a field left out of the form is a field the next save erases.
 */

const TERM_STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED"] as const;
const RENEWAL_STATUSES = [
  "NOT_CONTACTED",
  "CONTACTED",
  "PROPOSAL_SENT",
  "RENEWED",
  "DECLINED",
] as const;

/**
 * The two tiers that actually exist, offered as suggestions rather than as a closed
 * list.
 *
 * A `<datalist>` and not a `<select>`: the column is free text on the backend, the club
 * has changed its tier names once already, and a select would make a third tier
 * unenterable until someone edits this file. The suggestions cover the normal case; the
 * field still accepts anything.
 */
const KNOWN_TIERS = ["Kurucu Üye", "Üye"];
const TIER_LIST_ID = "hs-tiers";

/**
 * The tier suggestions, rendered once per screen.
 *
 * Deliberately not inside the forms that reference it. A `<datalist>` inside a
 * disclosure only exists in the DOM while that disclosure is open, so the term-edit
 * forms would lose their suggestions whenever "Dönem ekle" happened to be closed — and
 * one copy per term would repeat the same element id, which is invalid and leaves which
 * list the browser picks up to chance.
 */
export function TierSuggestions() {
  return (
    <datalist id={TIER_LIST_ID}>
      {KNOWN_TIERS.map((t) => (
        <option key={t} value={t} />
      ))}
    </datalist>
  );
}

/** İzmir's calendar date. Never the browser's — the club is in one timezone. */
function izmirToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Same İzmir day, `years` later. Used for the default term end date. */
function izmirTodayPlusYears(years: number): string {
  const [y, m, d] = izmirToday().split("-");
  return `${Number(y) + years}-${m}-${d}`;
}


// ── Profile ──────────────────────────────────────────────────────────────────

export function EditProfile({ member }: { member: MemberDetail }) {
  const p = member.profile;
  return (
    <Disclosure label="Profili düzenle">
      <ActionForm action={saveProfileAction} hiddenFields={{ userId: member.userId }}>
        {/*
          Said first and plainly: this endpoint is a PUT, so an emptied box is stored as
          empty. The lead screen's profile editor now works the same way and says the
          same thing — it is the notes box beside it, a PATCH, that does not.
        */}
        <p className={f.hint}>
          Bu form profilin tamamını kaydeder — boş bıraktığınız alanlar silinir.
        </p>

        <div className={f.row}>
          <div className={f.field}>
            <label className={f.label} htmlFor="p-birth">Doğum tarihi</label>
            <input id="p-birth" name="birthDate" type="date" className={f.input}
              max={izmirToday()} defaultValue={p?.birthDate ?? ""} />
          </div>
          <div className={f.field}>
            <label className={f.label} htmlFor="p-gender">Cinsiyet</label>
            <input id="p-gender" name="gender" className={f.input} maxLength={30}
              defaultValue={p?.gender ?? ""} placeholder="Serbest metin" />
          </div>
        </div>

        <div className={f.row}>
          <div className={f.field}>
            <label className={f.label} htmlFor="p-occupation">Meslek</label>
            <input id="p-occupation" name="occupation" className={f.input} maxLength={160}
              defaultValue={p?.occupation ?? ""} />
          </div>
          <div className={f.field}>
            <label className={f.label} htmlFor="p-company">Şirket</label>
            <input id="p-company" name="company" className={f.input} maxLength={160}
              defaultValue={p?.company ?? ""} />
          </div>
        </div>

        <div className={f.row}>
          <div className={f.field}>
            <label className={f.label} htmlFor="p-city">Şehir</label>
            <input id="p-city" name="city" className={f.input} maxLength={100}
              defaultValue={p?.city ?? ""} />
          </div>
          <div className={f.field}>
            <label className={f.label} htmlFor="p-padel">Padel seviyesi</label>
            <input id="p-padel" name="padelLevel" className={f.input} maxLength={40}
              defaultValue={p?.padelLevel ?? ""} placeholder="Başlangıç, orta, ileri…" />
          </div>
        </div>

        <div className={f.row}>
          <div className={f.field}>
            <label className={f.label} htmlFor="p-instagram">Instagram</label>
            <input id="p-instagram" name="instagramHandle" className={f.input} maxLength={120}
              defaultValue={p?.instagramHandle ?? ""} placeholder="@kullanici" />
          </div>
          <div className={f.field}>
            <label className={f.label} htmlFor="p-linkedin">LinkedIn</label>
            <input id="p-linkedin" name="linkedinUrl" type="url" className={f.input} maxLength={300}
              defaultValue={p?.linkedinUrl ?? ""} placeholder="https://…" />
          </div>
        </div>

        <div className={f.field}>
          <label className={f.label} htmlFor="p-channel">Tercih ettiği kanal</label>
          <select id="p-channel" name="preferredChannel" className={f.select}
            defaultValue={p?.preferredChannel ?? ""}>
            <option value="">— belirtilmedi —</option>
            {CONSENT_CHANNELS.map((c) => (
              <option key={c} value={c}>{consentChannelLabel(c)}</option>
            ))}
          </select>
          {/*
            The distinction the database draws and the screen must not blur: this is
            where they would rather be reached, which is not the same as what they
            consented to be reached on. The consent record is the one with legal weight
            and it is not editable from here at all.
          */}
          <p className={f.hint}>
            Tercihtir, rıza değildir. KVKK rızası ayrı bir kayıttır ve bu formdan
            değiştirilemez.
          </p>
        </div>

        <div className={f.field}>
          <label className={f.label} htmlFor="p-notes">Notlar</label>
          <textarea id="p-notes" name="notes" className={f.textarea} maxLength={4000}
            defaultValue={p?.notes ?? ""} placeholder="Ekip notları" />
        </div>

        <div className={f.actions}><SubmitButton>Profili kaydet</SubmitButton></div>
      </ActionForm>
    </Disclosure>
  );
}

// ── Interests ────────────────────────────────────────────────────────────────

export function EditInterests({ member }: { member: MemberDetail }) {
  const current = new Map(member.interests.map((i) => [i.category as string, i.level]));

  return (
    <Disclosure label="İlgi alanlarını düzenle">
      <ActionForm action={saveInterestsAction} hiddenFields={{ userId: member.userId }}>
        <p className={f.hint}>
          İşareti kaldırılan ilgi alanı silinir. Seviye 1 düşük, 3 yüksek.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {INTEREST_CATEGORIES.map((c) => {
            const level = current.get(c);
            return (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label className={f.checkRow} style={{ flex: 1, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    className={f.checkbox}
                    name="interest"
                    value={c}
                    defaultChecked={level !== undefined}
                    style={{ marginTop: 0 }}
                  />
                  {interestLabel(c)}
                </label>
                {/*
                  The level select stays enabled whether or not the box is ticked. A
                  disabled control submits nothing, so disabling it would mean the level
                  of a newly ticked interest silently defaulted to 1 — and the value is
                  simply ignored when the box is unticked, because the action reads
                  levels only for categories that were submitted.
                */}
                <select
                  name={`level-${c}`}
                  className={f.select}
                  defaultValue={String(level ?? 1)}
                  aria-label={`${interestLabel(c)} seviyesi`}
                  style={{ width: 64, flex: "0 0 auto", padding: "5px 7px" }}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </div>
            );
          })}
        </div>

        <div className={f.actions}><SubmitButton>İlgi alanlarını kaydet</SubmitButton></div>
      </ActionForm>
    </Disclosure>
  );
}

// ── Preferences ──────────────────────────────────────────────────────────────

/** Three spare rows, so adding a preference never needs a separate "add row" step. */
const SPARE_PREFERENCE_ROWS = 3;

export function EditPreferences({ member }: { member: MemberDetail }) {
  const rows = [
    ...member.preferences,
    ...Array.from({ length: SPARE_PREFERENCE_ROWS }, () => ({ key: "", value: "" })),
  ];

  return (
    <Disclosure label="Tercihleri düzenle">
      <ActionForm action={savePreferencesAction} hiddenFields={{ userId: member.userId }}>
        <p className={f.hint}>
          Serbest anahtar/değer. Bir tercihi silmek için satırı boşaltın; kaydedilen
          liste tercihlerin tamamıdır.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r, i) => (
            <div key={`${r.key}-${i}`} className={f.row} style={{ gap: 8 }}>
              <input
                name="prefKey"
                className={f.input}
                maxLength={60}
                defaultValue={r.key}
                placeholder="Anahtar"
                aria-label={`Tercih ${i + 1} anahtarı`}
              />
              <input
                name="prefValue"
                className={f.input}
                maxLength={300}
                defaultValue={r.value}
                placeholder="Değer"
                aria-label={`Tercih ${i + 1} değeri`}
              />
            </div>
          ))}
        </div>

        <div className={f.actions}><SubmitButton>Tercihleri kaydet</SubmitButton></div>
      </ActionForm>
    </Disclosure>
  );
}

// ── Membership terms ─────────────────────────────────────────────────────────

function TermStatusFields({ term }: { term?: MembershipTerm }) {
  const idp = term ? `t-${term.id}` : "t-new";
  return (
    <div className={f.row}>
      <div className={f.field}>
        <label className={f.label} htmlFor={`${idp}-status`}>Dönem durumu</label>
        <select id={`${idp}-status`} name="status" className={f.select}
          defaultValue={term?.status ?? "ACTIVE"}>
          {TERM_STATUSES.map((s) => (
            <option key={s} value={s}>{termStatusLabel(s)}</option>
          ))}
        </select>
      </div>
      <div className={f.field}>
        <label className={f.label} htmlFor={`${idp}-renewal`}>Yenileme durumu</label>
        <select id={`${idp}-renewal`} name="renewalStatus" className={f.select}
          defaultValue={term?.renewalStatus ?? "NOT_CONTACTED"}>
          {RENEWAL_STATUSES.map((s) => (
            <option key={s} value={s}>{renewalStatusLabel(s)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function AddTerm({ member }: { member: MemberDetail }) {
  return (
    <Disclosure label="Dönem ekle">
      <ActionForm action={createTermAction} hiddenFields={{ userId: member.userId }}>
        <div className={f.field}>
          <label className={`${f.label} ${f.required}`} htmlFor="t-new-type">Üyelik tipi</label>
          <input id="t-new-type" name="membershipType" className={f.input} required maxLength={80}
            list={TIER_LIST_ID} defaultValue={member.membershipType ?? ""} />
        </div>

        <div className={f.row}>
          <div className={f.field}>
            <label className={`${f.label} ${f.required}`} htmlFor="t-new-start">Başlangıç</label>
            <input id="t-new-start" name="startDate" type="date" className={f.input} required
              defaultValue={member.membershipStart ?? izmirToday()} />
          </div>
          <div className={f.field}>
            <label className={`${f.label} ${f.required}`} htmlFor="t-new-end">Bitiş</label>
            <input id="t-new-end" name="endDate" type="date" className={f.input} required
              defaultValue={member.membershipEnd ?? izmirTodayPlusYears(1)} />
          </div>
        </div>

        <TermStatusFields />

        <div className={f.field}>
          <label className={f.label} htmlFor="t-new-note">Yenileme notu</label>
          <input id="t-new-note" name="renewalNote" className={f.input} maxLength={2000} />
        </div>

        {/*
          Terms are written forward only — nothing was backfilled from the existing
          membership rows, by decision. Saying so here is the difference between an
          empty history reading as "not populated yet" and reading as "this member
          never renewed", which would be a false claim about a real person.
        */}
        <p className={f.hint}>
          Dönem kayıtları ileriye dönük tutulur; mevcut üyelikler bu tabloya
          aktarılmadı.
        </p>

        <div className={f.actions}><SubmitButton>Dönemi ekle</SubmitButton></div>
      </ActionForm>
    </Disclosure>
  );
}

export function EditTerm({ term }: { term: MembershipTerm }) {
  return (
    <Disclosure label="Düzenle">
      <ActionForm
        action={updateTermAction}
        hiddenFields={{
          termId: term.id,
          // What the renewal status was when this form was drawn. The action compares
          // against it and withholds an unchanged value, so saving a corrected date
          // does not stamp a renewal contact that never happened.
          renewalStatusWas: term.renewalStatus,
        }}
      >
        <div className={f.field}>
          <label className={`${f.label} ${f.required}`} htmlFor={`t-${term.id}-type`}>
            Üyelik tipi
          </label>
          <input id={`t-${term.id}-type`} name="membershipType" className={f.input} required
            maxLength={80} list={TIER_LIST_ID} defaultValue={term.membershipType} />
        </div>

        <div className={f.row}>
          <div className={f.field}>
            <label className={`${f.label} ${f.required}`} htmlFor={`t-${term.id}-start`}>
              Başlangıç
            </label>
            <input id={`t-${term.id}-start`} name="startDate" type="date" className={f.input}
              required defaultValue={term.startDate} />
          </div>
          <div className={f.field}>
            <label className={`${f.label} ${f.required}`} htmlFor={`t-${term.id}-end`}>
              Bitiş
            </label>
            <input id={`t-${term.id}-end`} name="endDate" type="date" className={f.input}
              required defaultValue={term.endDate} />
          </div>
        </div>

        <TermStatusFields term={term} />

        <div className={f.field}>
          <label className={f.label} htmlFor={`t-${term.id}-note`}>Yenileme notu</label>
          <input id={`t-${term.id}-note`} name="renewalNote" className={f.input} maxLength={2000}
            defaultValue={term.renewalNote ?? ""} />
        </div>
        <p className={f.hint}>
          Yenileme durumunu değiştirmek «son yenileme teması» tarihini bugüne çeker.
        </p>

        <div className={f.actions}><SubmitButton variant="ghost">Dönemi güncelle</SubmitButton></div>
      </ActionForm>
    </Disclosure>
  );
}


// ── Onboarding and the contract (ADMIN only) ─────────────────────────────────

/**
 * The desk record, editable, plus the contract.
 *
 * Rendered only when the 360 payload carried an `onboarding` block — which the backend
 * sends to ADMIN alone. There is no role check here because there is nothing to check:
 * a non-admin never receives the data this form would edit.
 */
export function ContractActions({ member }: { member: MemberDetail }) {
  const o = member.onboarding;
  if (!o) return null;

  return (
    <>
      <Disclosure label="Üyelik kaydını düzenle">
        <ActionForm action={saveOnboardingAction} hiddenFields={{ userId: member.userId }}>
          {/* Same warning as the profile above it, and for the same reason. */}
          <p className={f.hint}>
            Bu form kaydın tamamını saklar — boş bıraktığınız alanlar silinir. Sözleşme
            bu formdan etkilenmez.
          </p>

          <div className={f.row}>
            <div className={f.field}>
              <label className={f.label} htmlFor="o-ec-name">Acil durum kişisi</label>
              <input id="o-ec-name" name="emergencyContactName" className={f.input}
                maxLength={160} defaultValue={o.emergencyContactName ?? ""} />
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="o-ec-phone">Telefonu</label>
              <input id="o-ec-phone" name="emergencyContactPhone" className={f.input}
                inputMode="tel" maxLength={30} defaultValue={o.emergencyContactPhone ?? ""} />
            </div>
          </div>

          <div className={f.row}>
            <div className={f.field}>
              <label className={f.label} htmlFor="o-ec-gender">Cinsiyeti</label>
              {/*
                A closed list, matching the conversion form. `defaultValue` falls back to
                "" for anything already stored that is not on it — free text predates
                this — so an unrecognised value shows as "belirtilmedi" rather than
                silently selecting the wrong option.
              */}
              <select id="o-ec-gender" name="emergencyContactGender" className={f.select}
                defaultValue={
                  EMERGENCY_GENDERS.includes(
                    (o.emergencyContactGender ?? "") as (typeof EMERGENCY_GENDERS)[number]
                  )
                    ? o.emergencyContactGender!
                    : ""
                }>
                <option value="">— belirtilmedi —</option>
                {EMERGENCY_GENDERS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="o-payment">Ödeme şekli</label>
              <select id="o-payment" name="paymentMethod" className={f.select}
                defaultValue={o.paymentMethod ?? ""}>
                <option value="">— belirtilmedi —</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{paymentMethodLabel(m)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={f.field}>
            <label className={f.label} htmlFor="o-nid">T.C. Kimlik No. / Pasaport No.</label>
            <input id="o-nid" name="nationalId" className={f.input} maxLength={40}
              autoComplete="off" defaultValue={o.nationalId ?? ""} />
          </div>

          <div className={f.row}>
            <div className={f.field}>
              <label className={f.label} htmlFor="o-p1">Araç plakası</label>
              <input id="o-p1" name="vehiclePlate1" className={f.input} maxLength={20}
                defaultValue={o.vehiclePlates[0] ?? ""} />
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="o-p2">İkinci araç plakası</label>
              <input id="o-p2" name="vehiclePlate2" className={f.input} maxLength={20}
                defaultValue={o.vehiclePlates[1] ?? ""} />
            </div>
          </div>

          <div className={f.actions}><SubmitButton>Kaydı kaydet</SubmitButton></div>
        </ActionForm>
      </Disclosure>

      <Disclosure label={o.hasContract ? "Sözleşmeyi değiştir" : "Sözleşme yükle"}>
        <ActionForm action={uploadContractAction} hiddenFields={{ userId: member.userId }}>
          {o.hasContract && (
            <p className={f.hint}>
              Yeni dosya yüklerseniz mevcut sözleşme silinir ve yerine bu geçer.
            </p>
          )}
          <div className={f.field}>
            <label className={f.label} htmlFor="o-contract">Taranmış sözleşme</label>
            <input id="o-contract" name="contract" type="file" className={f.input}
              accept="application/pdf,image/jpeg,image/png" required />
            <p className={f.hint}>PDF, JPEG veya PNG · en fazla 20 MB.</p>
          </div>
          <div className={f.actions}><SubmitButton>Yükle</SubmitButton></div>
        </ActionForm>
      </Disclosure>

      {o.hasContract && <ContractLink userId={member.userId} />}
    </>
  );
}

/**
 * Fetches an expiring link and opens it, rather than rendering an `<a href>`.
 *
 * A rendered link would put a working key to somebody's signed contract into the page
 * source, the browser history and any screenshot of the screen — and it would be stale
 * within minutes anyway. This asks for one at the moment it is wanted.
 */
function ContractLink({ userId }: { userId: string }) {
  const [state, action] = useActionState<FormState & { url?: string }, FormData>(
    contractLinkAction,
    {}
  );

  // Opened from an effect, not from the action: a server action's result arrives after
  // the render, and window.open during render is neither allowed nor reachable on the
  // server. The dependency is the URL itself, so the same link is not reopened on an
  // unrelated re-render.
  useEffect(() => {
    if (state.url) window.open(state.url, "_blank", "noopener,noreferrer");
  }, [state.url]);

  return (
    <form action={action} style={{ marginTop: 12 }}>
      <input type="hidden" name="userId" value={userId} />
      <FormMessage state={state} />
      <SubmitButton variant="ghost" pendingLabel="Bağlantı alınıyor…">
        Sözleşmeyi görüntüle
      </SubmitButton>
    </form>
  );
}
