"use client";

import { useState } from "react";
import { ActionForm, SubmitButton, formStyles as f } from "@/components/Form";
import {
  addInteractionAction,
  convertLeadAction,
  updateLeadAction,
  updateOwnerAction,
  updateStatusAction,
} from "../actions";
import { INTERACTION_TYPES, interactionTypeLabel, leadStatusLabel } from "@/lib/labels";
import type { LeadDetail } from "@/lib/types";

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
      <div className={f.row}>
        <div className={f.field}>
          <label className={f.label} htmlFor="i-type">Tür</label>
          <select id="i-type" name="type" className={f.select} defaultValue="CALL">
            {INTERACTION_TYPES.map((t) => (
              <option key={t} value={t}>{interactionTypeLabel(t)}</option>
            ))}
          </select>
        </div>
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
  return (
    <ActionForm action={updateLeadAction} hiddenFields={{ leadId: lead.id }}>
      <div className={f.row}>
        <div className={f.field}>
          <label className={f.label} htmlFor="n-date">Sonraki adım tarihi</label>
          <input id="n-date" name="nextActionOn" type="date" className={f.input}
            defaultValue={lead.nextActionAt ? lead.nextActionAt.slice(0, 10) : ""} />
        </div>
        <div className={f.field}>
          <label className={f.label} htmlFor="n-note">Aksiyon</label>
          <input id="n-note" name="nextActionNote" className={f.input}
            defaultValue={lead.nextActionNote ?? ""} placeholder="Tekrar ara, teklif hazırla…" />
        </div>
      </div>
      <div className={f.field}>
        <label className={f.label} htmlFor="n-notes">Notlar</label>
        <textarea id="n-notes" name="notes" className={f.textarea}
          defaultValue={lead.notes ?? ""} placeholder="Ekip notları" />
      </div>
      {/*
        Stated because the API cannot express it: a PATCH treats an absent field as
        "leave alone", so there is no way to send "make this empty". Better to say so
        than to let someone clear a box, save, and watch the old text come back.
      */}
      <p className={f.hint}>Bir alanı boşaltmak için kaydetmek şu an mümkün değil; üzerine yazın.</p>
      <div className={f.actions}><SubmitButton variant="ghost">Kaydet</SubmitButton></div>
    </ActionForm>
  );
}

export function ConvertLead({ lead }: { lead: LeadDetail }) {
  const [open, setOpen] = useState(false);

  if (lead.convertedUserId) {
    return (
      <p className={f.hint} style={{ margin: 0 }}>
        Üyeye dönüştürüldü. Üye kaydı: <code>{lead.convertedUserId}</code>
      </p>
    );
  }

  // A member needs both. Asking for whichever is missing up front is kinder than
  // letting them press the button and be told no.
  const needsEmail = !lead.email;
  const needsPhone = !lead.phone;

  return (
    <>
      {!open ? (
        <div className={f.actions}>
          <button type="button" className={f.submit} onClick={() => setOpen(true)}>
            Üyeye dönüştür
          </button>
        </div>
      ) : (
        <ActionForm action={convertLeadAction} hiddenFields={{ leadId: lead.id }}>
          <p className={f.hint} style={{ marginBottom: 2 }}>
            Üye hesabı oluşturulur ve bu adayın tüm etkileşim geçmişi üyeye taşınır.
            Aynı e-posta veya telefona sahip bir üye zaten varsa yeni kayıt açılmaz,
            aday mevcut üyeye bağlanır.
          </p>

          {(needsEmail || needsPhone) && (
            <div className={f.row}>
              {needsEmail && (
                <div className={f.field}>
                  <label className={`${f.label} ${f.required}`} htmlFor="c-email">E-posta</label>
                  <input id="c-email" name="email" type="email" className={f.input} required />
                </div>
              )}
              {needsPhone && (
                <div className={f.field}>
                  <label className={`${f.label} ${f.required}`} htmlFor="c-phone">Telefon</label>
                  <input id="c-phone" name="phone" className={f.input} required />
                </div>
              )}
            </div>
          )}
          {(needsEmail || needsPhone) && (
            <p className={f.hint}>
              Üyelik için hem e-posta hem telefon gerekli — ikisi de giriş kimliği.
            </p>
          )}

          <div className={f.actions}>
            <SubmitButton pendingLabel="Dönüştürülüyor…">Onayla ve dönüştür</SubmitButton>
            <button type="button" className={`${f.submit} ${f.submitGhost}`} onClick={() => setOpen(false)}>
              Vazgeç
            </button>
          </div>
        </ActionForm>
      )}
    </>
  );
}
