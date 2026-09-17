"use client";

import { useState } from "react";
import { ActionForm, SubmitButton, formStyles as f } from "@/components/Form";
import { convertLeadAction } from "../../actions";
import { EMERGENCY_GENDERS, PAYMENT_METHODS, paymentMethodLabel } from "@/lib/labels";
import type { LeadDetail, MembershipTier } from "@/lib/types";

/** İzmir's calendar date. Never the browser's — the club is in one timezone. */
function izmirToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** The same İzmir day one year on, the ordinary membership term. */
function izmirOneYearOn(): string {
  const [y, m, d] = izmirToday().split("-");
  return `${Number(y) + 1}-${m}-${d}`;
}

export function ConvertForm({
  lead,
  tiers,
  isAdmin,
}: {
  lead: LeadDetail;
  tiers: MembershipTier[];
  isAdmin: boolean;
}) {
  /*
   * The dates only matter once a tier is chosen, and a tier without them is refused
   * both here and by the backend. Tracking the selection lets the form say so by
   * revealing the dates rather than by rejecting a save.
   */
  const [tierId, setTierId] = useState("");

  return (
    <ActionForm action={convertLeadAction} hiddenFields={{ leadId: lead.id }}>
      <p className={f.hint} style={{ marginBottom: 2 }}>
        Üye hesabı oluşturulur ve bu adayın tüm etkileşim geçmişi üyeye taşınır. Aynı
        e-posta veya telefona sahip bir üye zaten varsa yeni kayıt açılmaz, aday mevcut
        üyeye bağlanır.
      </p>

      <h3 className={f.sectionTitle}>Üye hesabı</h3>
      <div className={f.row}>
        <div className={f.field}>
          <label className={`${f.label} ${lead.email ? "" : f.required}`} htmlFor="c-email">
            E-posta
          </label>
          {/* Both are required for an account — e-mail and phone are each a login
              identifier since V28. Pre-filled from the lead; asked for when missing. */}
          <input id="c-email" name="email" type="email" className={f.input}
            autoCapitalize="none" spellCheck={false}
            defaultValue={lead.email ?? ""} required={!lead.email} />
        </div>
        <div className={f.field}>
          <label className={`${f.label} ${lead.phone ? "" : f.required}`} htmlFor="c-phone">
            Telefon
          </label>
          <input id="c-phone" name="phone" className={f.input} inputMode="tel"
            defaultValue={lead.phone ?? ""} required={!lead.phone} />
        </div>
      </div>

      {!isAdmin ? (
        <p className={f.hint}>
          Acil durum kişisi, ödeme şekli, kimlik numarası, üyelik tipi ve sözleşme
          yalnızca yöneticiler tarafından kaydedilebilir. Dönüştürmeden sonra bir
          yönetici üye sayfasından tamamlayabilir.
        </p>
      ) : (
        <>
          <h3 className={f.sectionTitle}>Acil durum kişisi</h3>
          <div className={f.row}>
            <div className={f.field}>
              <label className={f.label} htmlFor="c-ec-name">Ad Soyad</label>
              <input id="c-ec-name" name="emergencyContactName" className={f.input} maxLength={160} />
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="c-ec-phone">Telefon</label>
              <input id="c-ec-phone" name="emergencyContactPhone" className={f.input}
                inputMode="tel" maxLength={30} />
            </div>
          </div>
          <div className={f.row}>
            <div className={f.field}>
              <label className={f.label} htmlFor="c-ec-gender">Cinsiyet</label>
              {/*
                A closed list (user, 2026-09-16). It was free text to match
                `member_profiles.gender`, which still is — but that field describes the
                member and this one describes a person being written down in a hurry at
                a desk, where two spellings of the same word are the likelier outcome
                than a third answer. The column stays VARCHAR, so widening the list later
                costs nothing.
              */}
              <select id="c-ec-gender" name="emergencyContactGender" className={f.select}
                defaultValue="">
                <option value="">— belirtilmedi —</option>
                {EMERGENCY_GENDERS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <h3 className={f.sectionTitle}>Üyelik ve ödeme</h3>
          <div className={f.row}>
            <div className={f.field}>
              <label className={f.label} htmlFor="c-tier">Üyelik tipi</label>
              <select id="c-tier" name="tierId" className={f.select} value={tierId}
                onChange={(e) => setTierId(e.target.value)}>
                <option value="">— şimdi atama —</option>
                {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="c-payment">Ödeme şekli</label>
              <select id="c-payment" name="paymentMethod" className={f.select} defaultValue="">
                <option value="">— belirtilmedi —</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{paymentMethodLabel(m)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Revealed by the tier, because a membership without dates is not a
              membership — every booking gate and every renewal query reads them. */}
          {tierId && (
            <div className={f.row}>
              <div className={f.field}>
                <label className={`${f.label} ${f.required}`} htmlFor="c-start">Başlangıç</label>
                <input id="c-start" name="membershipStart" type="date" className={f.input}
                  defaultValue={izmirToday()} required />
              </div>
              <div className={f.field}>
                <label className={`${f.label} ${f.required}`} htmlFor="c-end">Bitiş</label>
                <input id="c-end" name="membershipEnd" type="date" className={f.input}
                  defaultValue={izmirOneYearOn()} required />
              </div>
            </div>
          )}

          <h3 className={f.sectionTitle}>Kimlik ve araç</h3>
          <div className={f.row}>
            <div className={f.field}>
              <label className={f.label} htmlFor="c-nid">T.C. Kimlik No. / Pasaport No.</label>
              <input id="c-nid" name="nationalId" className={f.input} maxLength={40}
                autoComplete="off" />
            </div>
          </div>
          <div className={f.row}>
            <div className={f.field}>
              <label className={f.label} htmlFor="c-p1">Araç plakası</label>
              <input id="c-p1" name="vehiclePlate1" className={f.input} maxLength={20}
                placeholder="35 ABC 123" />
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="c-p2">İkinci araç plakası</label>
              <input id="c-p2" name="vehiclePlate2" className={f.input} maxLength={20} />
            </div>
          </div>

          <h3 className={f.sectionTitle}>Sözleşme</h3>
          <div className={f.field}>
            <label className={f.label} htmlFor="c-contract">Taranmış sözleşme</label>
            {/*
              Uploaded after the member exists, so it can be keyed to them. If it fails
              the member is still created and the message says to retry from their
              profile — the alternative, one multipart call, would lose the whole
              conversion to a dropped connection.
            */}
            <input id="c-contract" name="contract" type="file" className={f.input}
              accept="application/pdf,image/jpeg,image/png" />
            <p className={f.hint}>PDF, JPEG veya PNG · en fazla 20 MB.</p>
          </div>
        </>
      )}

      <div className={f.actions}><SubmitButton>Üyeye dönüştür</SubmitButton></div>
    </ActionForm>
  );
}
