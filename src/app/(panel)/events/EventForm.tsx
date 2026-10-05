import { ActionForm, SubmitButton } from "@/components/Form";
// Directly, not via Form.tsx's `formStyles` — see the note in [id]/page.tsx.
import f from "@/components/forms.module.css";
import { izmirToday } from "@/lib/dates";
import { EVENT_STATUSES, EVENT_TYPES, eventStatusLabel, eventTypeLabel } from "@/lib/labels";
import type { EventDetail } from "@/lib/types";
import { saveEventAction } from "./actions";

/**
 * Create or edit an event. One form for both, because it is the same record.
 *
 * Every field is rendered and submitted: the update is a PUT, so a field left off this
 * form would be cleared by the first save.
 */
export function EventForm({ event }: { event?: EventDetail }) {
  return (
    <ActionForm action={saveEventAction} hiddenFields={event ? { id: event.id } : undefined}>
      <div className={f.field}>
        <label className={`${f.label} ${f.required}`} htmlFor="e-title">Etkinlik adı</label>
        <input id="e-title" name="title" className={f.input} required maxLength={160}
          defaultValue={event?.title ?? ""} placeholder="örn. Community Talk · Girişimcilik" />
      </div>

      <div className={f.row}>
        <div className={f.field}>
          <label className={`${f.label} ${f.required}`} htmlFor="e-type">Tür</label>
          <select id="e-type" name="type" className={f.select} defaultValue={event?.type ?? "TALK"}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{eventTypeLabel(t)}</option>)}
          </select>
          {/* Said here because it is the first thing somebody looks for. */}
          <p className={f.hint}>Turnuvalar yönetici uygulamasından oluşturulur ve bu listede kendiliğinden görünür.</p>
        </div>
        <div className={f.field}>
          <label className={f.label} htmlFor="e-status">Durum</label>
          <select id="e-status" name="status" className={f.select} defaultValue={event?.status ?? "DRAFT"}>
            {EVENT_STATUSES.map((s) => <option key={s} value={s}>{eventStatusLabel(s)}</option>)}
          </select>
          <p className={f.hint}>İlk davet gönderildiğinde taslak kendiliğinden yayına alınır.</p>
        </div>
      </div>

      <div className={f.row}>
        <div className={f.field}>
          <label className={`${f.label} ${f.required}`} htmlFor="e-date">Tarih</label>
          <input id="e-date" name="eventDate" type="date" className={f.input} required
            defaultValue={event?.eventDate ?? izmirToday()} />
        </div>
        <div className={f.field}>
          <label className={`${f.label} ${f.required}`} htmlFor="e-time">Saat</label>
          <input id="e-time" name="startTime" type="time" className={f.input} required
            defaultValue={event?.startTime?.slice(0, 5) ?? "19:00"} />
        </div>
      </div>

      <div className={f.row}>
        <div className={f.field}>
          <label className={f.label} htmlFor="e-location">Yer</label>
          <input id="e-location" name="location" className={f.input} maxLength={160}
            defaultValue={event?.location ?? ""} placeholder="örn. Lounge" />
        </div>
        <div className={f.field}>
          <label className={f.label} htmlFor="e-capacity">Kontenjan</label>
          <input id="e-capacity" name="capacity" type="number" min={1} max={5000} step={1}
            className={f.input} defaultValue={event?.capacity ?? ""} placeholder="sınırsız" />
          <p className={f.hint}>Doluysa üyenin bağlantısından «Katılacağım» kabul edilmez; elle kayıt sınırsızdır.</p>
        </div>
      </div>

      <div className={f.field}>
        <label className={f.label} htmlFor="e-desc">Açıklama</label>
        <textarea id="e-desc" name="description" className={f.textarea} rows={4} maxLength={4000}
          defaultValue={event?.description ?? ""} />
        <p className={f.hint}>Davet e-postasında ve üyenin yanıt sayfasında görünür.</p>
      </div>

      <div className={f.actions}><SubmitButton>{event ? "Kaydet" : "Etkinliği oluştur"}</SubmitButton></div>
    </ActionForm>
  );
}
