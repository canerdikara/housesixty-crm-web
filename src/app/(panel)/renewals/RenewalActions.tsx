"use client";

import { ActionForm, Disclosure, SubmitButton, formStyles as f } from "@/components/Form";
import { logContactAction } from "./actions";
import { renewalStatusLabel } from "@/lib/labels";
import type { RenewalListItem, RenewalStatus } from "@/lib/types";

const STATUSES: RenewalStatus[] = [
  "NOT_CONTACTED",
  "CONTACTED",
  "PROPOSAL_SENT",
  "RENEWED",
  "DECLINED",
];

const TYPES = [
  ["CALL", "Telefon"],
  ["WHATSAPP", "WhatsApp"],
  ["EMAIL", "E-posta"],
  ["SMS", "SMS"],
  ["MEETING", "Görüşme"],
  ["VISIT", "Ziyaret"],
  ["NOTE", "Not"],
] as const;

/**
 * The per-row "log a call" form, behind a disclosure.
 *
 * Behind a disclosure rather than inline, for the same reason the 360's editors are:
 * this is a list people scan down looking for who to ring next, and five open forms on
 * screen at once buries the list itself.
 *
 * `canWrite` is passed from the server component. It hides the form for a MARKETING
 * user, who may read renewals but not write them (§6). The backend enforces it either
 * way — this only avoids offering an action that would be refused.
 */
export function RenewalActions({
  row,
  canWrite,
}: {
  row: RenewalListItem;
  canWrite: boolean;
}) {
  if (!canWrite) return null;

  return (
    <Disclosure label="Görüşme kaydet">
      <ActionForm action={logContactAction} hiddenFields={{ termId: row.termId }}>
        <div className={f.row}>
          <div className={f.field}>
            <label className={f.label} htmlFor={`s-${row.termId}`}>
              Yenileme durumu
            </label>
            <select
              id={`s-${row.termId}`}
              name="renewalStatus"
              className={f.input}
              defaultValue={row.renewalStatus}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {renewalStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>

          <div className={f.field}>
            <label className={f.label} htmlFor={`t-${row.termId}`}>
              Kanal
            </label>
            <select id={`t-${row.termId}`} name="interactionType" className={f.input} defaultValue="CALL">
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={f.field}>
          <label className={f.label} htmlFor={`n-${row.termId}`}>
            Görüşme notu
          </label>
          <input
            id={`n-${row.termId}`}
            name="note"
            className={f.input}
            maxLength={4000}
            required
            placeholder="Ne konuşuldu?"
          />
          <p className={f.hint}>
            Üyenin geçmişine işlenir. Durum değiştiyse o da nota eklenir.
          </p>
        </div>

        <div className={f.field}>
          <label className={f.label} htmlFor={`rn-${row.termId}`}>
            Liste notu (isteğe bağlı)
          </label>
          <input
            id={`rn-${row.termId}`}
            name="renewalNote"
            className={f.input}
            maxLength={2000}
            defaultValue={row.renewalNote ?? ""}
            placeholder="Bu satırda görünecek tek satır"
          />
          <p className={f.hint}>
            Boş bırakılırsa mevcut not korunur — görüşme notundan ayrıdır.
          </p>
        </div>

        <SubmitButton>Kaydet</SubmitButton>
      </ActionForm>
    </Disclosure>
  );
}
