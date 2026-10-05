import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/Form";
// The stylesheet itself, not `formStyles` re-exported from Form.tsx: that module is
// "use client", and a server component importing a plain value from one gets a client
// reference instead of the object — every `f.*` class silently comes out undefined.
import f from "@/components/forms.module.css";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Badge, EmptyState, TableWrap, Tag, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDateTime, formatDayMonth, izmirToday } from "@/lib/dates";
import { eventRsvpLabel, eventStatusLabel, eventTypeLabel } from "@/lib/labels";
import { canCheckInEvents, canManageEvents, canWriteCampaigns } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { EventDetail, EventInvitee, MemberListItem, Paged, SegmentList } from "@/lib/types";
import {
  checkInAction,
  deleteEventAction,
  inviteAction,
  sendEventMessagesAction,
  undoCheckInAction,
  uninviteAction,
} from "../actions";
import { InlineAction, RsvpSelect, SendPanel } from "../EventControls";
import styles from "../events.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiRequest<EventDetail>(`/api/v1/crm/events/${id}`);
  return { title: r.kind === "ok" ? `${r.data.title} · House Sixty CRM` : "Etkinlik · House Sixty CRM" };
}

/**
 * «Etkinlik Detayı» — mockup screen 14.
 *
 * The invitee list with each answer and whether they came; occupancy; inviting from a
 * segment or by name; check-in at the door (reception included); and sending.
 *
 * Answers have two sources and the list says which: the member through their own link,
 * or staff by hand. While sending is switched off every answer is a staff one, and that
 * is how this screen is meant to be used until the club decides on sending.
 *
 * The member search (`?q=`) is a GET form, so finding somebody at the door needs no
 * JavaScript and survives a reload.
 */
export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const q = String((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim();

  const session = await readSession();
  const role = session?.user.role;
  const canManage = canManageEvents(role);
  const canCheckIn = canCheckInEvents(role);
  const canSend = canWriteCampaigns(role);

  const [result, segments, search] = await Promise.all([
    apiRequest<EventDetail>(`/api/v1/crm/events/${id}`),
    canManage ? apiRequest<SegmentList>("/api/v1/crm/segments") : Promise.resolve(null),
    q.length >= 2
      ? apiRequest<Paged<MemberListItem>>(`/api/v1/crm/members?q=${encodeURIComponent(q)}&size=8`)
      : Promise.resolve(null),
  ]);
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind === "error" && result.status === 404) notFound();
  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Etkinlik" subtitle={<Link href="/events">Etkinlikler</Link>} />
        <Card><EmptyState title="Etkinlik yüklenemedi">{result.message}</EmptyState></Card>
      </PageBody>
    );
  }

  const e = result.data;
  const s = e.stats;
  const past = e.eventDate < izmirToday();
  const cancelled = e.status === "CANCELLED";
  // Check-in opens on the day and stays open afterwards; the backend refuses it earlier.
  const checkInOpen = canCheckIn && !cancelled && e.eventDate <= izmirToday();
  const invitedIds = new Set(e.invitees.map((i) => i.userId));
  const attendedIds = new Set([...e.invitees.filter((i) => i.attended).map((i) => i.userId), ...e.walkIns.map((w) => w.userId)]);
  const segmentOptions = segments?.kind === "ok" ? segments.data.segments : [];
  const results = search?.kind === "ok" ? search.data.content : [];
  const fill = e.capacity ? Math.min(1, s.accepted / e.capacity) : null;
  const day = Number(e.eventDate.slice(8, 10));
  const longDate = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric", month: "long", year: "numeric", weekday: "long", timeZone: "Europe/Istanbul",
  }).format(new Date(`${e.eventDate}T12:00:00Z`));

  return (
    <PageBody>
      <PageHeader
        title="Etkinlik Detayı"
        subtitle={<><Link href="/events">Etkinlikler</Link> › {e.title}</>}
        actions={canManage ? (
          <Link className={`${ui.button} ${ui.buttonGhost}`} href={`/events/${e.id}/edit`}>Düzenle</Link>
        ) : null}
      />

      <Card>
        <div className={styles.head}>
          <div className={`${styles.dateMark} ${cancelled ? styles.dateMarkMuted : ""}`} aria-hidden="true">
            <span className={styles.dateMarkDay}>{day}</span>
          </div>
          <div className={styles.headMain}>
            <h2 className={styles.headName}>{e.title}</h2>
            <p className={styles.headMeta}>
              {longDate} {e.startTime.slice(0, 5)}
              {e.location ? ` · ${e.location}` : ""}
              {e.capacity ? ` · Kontenjan ${e.capacity}` : " · Kontenjan sınırsız"}
            </p>
            <div className={styles.headTags}>
              <Badge tone={cancelled ? "crit" : past ? "neutral" : e.status === "DRAFT" ? "neutral" : "good"}>
                {cancelled ? "İptal" : past ? "Geçmiş" : e.status === "DRAFT" ? "Taslak" : "Yaklaşan"}
              </Badge>
              <span className={styles.typePill}>{eventTypeLabel(e.type)}</span>
              {e.segmentName && <Tag muted>Segment: {e.segmentName}</Tag>}
              <Tag muted>Davet: {s.invited} üye</Tag>
            </div>
          </div>
          <div className={styles.headStats}>
            <Stat value={s.invited} label="davet" />
            <Stat value={s.responded} label="yanıt" />
            <Stat value={s.accepted} label="katılacak" />
            {past || s.attended > 0
              ? <Stat value={s.attended} label="geldi" />
              : <Stat value={s.freeSpots ?? "∞"} label="boş yer" />}
          </div>
        </div>
        {e.description && <p className={styles.description}>{e.description}</p>}
      </Card>

      <div className={styles.split}>
        <Card>
          <h2 className={styles.cardTitle}>Davetliler</h2>
          <p className={styles.cardSub}>
            {e.segmentName ? `«${e.segmentName}» segmentinden ve elle eklenenler` : "Davet edilen üyeler"}
            {" · "}yanıtı üye kendi bağlantısından ya da siz buradan kaydedebilirsiniz
          </p>

          {e.invitees.length === 0 ? (
            <EmptyState title="Henüz davetli yok">
              {canManage ? "Sağdaki «Davet ekle» ile bir segmenti ya da tek tek üyeleri ekleyin." : null}
            </EmptyState>
          ) : (
            <TableWrap>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Üye</th>
                    <th>Üyelik</th>
                    <th>Yanıt</th>
                    <th>Yanıt tarihi</th>
                    <th className={styles.num}>Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {e.invitees.map((i) => (
                    <InviteeRow
                      key={i.userId} i={i} eventId={e.id}
                      canManage={canManage && !cancelled} canCheckIn={checkInOpen}
                      canRemind={canSend && e.sending.sendingEnabled && !past && !cancelled}
                      past={past}
                    />
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}

          {e.walkIns.length > 0 && (
            <>
              <h3 className={f.sectionTitle} style={{ marginTop: 18 }}>Davetsiz gelenler</h3>
              <TableWrap>
                <table className={ui.table}>
                  <tbody>
                    {e.walkIns.map((w) => (
                      <tr key={w.userId}>
                        <td><Link href={`/members/${w.userId}`} className={ui.rowLink}>{w.fullName}</Link></td>
                        <td>{w.tier ?? <span className={ui.faint}>—</span>}</td>
                        <td className={ui.nowrap}>{formatDateTime(w.checkedInAt)}</td>
                        <td className={styles.num}>
                          {canCheckIn && (
                            <InlineAction action={undoCheckInAction} fields={{ eventId: e.id, userId: w.userId }} label="Geri al" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </>
          )}
        </Card>

        <div className={styles.side}>
          <Card>
            <h2 className={styles.cardTitle}>Doluluk</h2>
            <p className={styles.big}>
              {s.accepted}
              <span className={styles.bigOf}>{e.capacity ? `/ ${e.capacity} kişi` : "kişi · sınırsız"}</span>
            </p>
            {fill !== null && (
              <div className={styles.bar} style={{ marginTop: 12 }}>
                <span className={styles.barTrack}>
                  <span
                    className={`${styles.barFill} ${fill >= 1 ? styles.barCrit : fill >= 0.8 ? styles.barWarn : styles.barGood}`}
                    style={{ width: `${fill * 100}%` }}
                  />
                </span>
                <span className={styles.barLabel}>%{Math.round(fill * 100)} dolu</span>
              </div>
            )}
            <ul className={styles.kv}>
              <li><span>Katılacak</span><span>{s.accepted}</span></li>
              <li><span>Katılamayacak</span><span>{s.declined}</span></li>
              <li><span>Yanıt yok</span><span>{s.pending}</span></li>
              <li><span>Geldi</span><span>{s.attended}{s.walkIns ? ` (${s.walkIns} davetsiz)` : ""}</span></li>
            </ul>
          </Card>

          {(checkInOpen || (canManage && !cancelled)) && (
            <Card>
              <h2 className={styles.cardTitle}>
                {checkInOpen ? (canManage ? "Üye bul — davet et ya da katılım al" : "Katılım al") : "Üye bul — davet et"}
              </h2>
              <p className={styles.cardSub}>
                {checkInOpen
                  ? "Davetli olmayan biri gelirse buradan da kaydedebilirsiniz."
                  : "Katılım, etkinlik günü açılır."}
              </p>
              <form method="GET" action={`/events/${e.id}`} className={ui.filterForm}>
                <input className={ui.search} type="search" name="q" defaultValue={q}
                  placeholder="İsim, telefon veya e-posta" aria-label="Üye ara" />
                <button type="submit" className={`${ui.button} ${ui.buttonGhost}`}>Ara</button>
              </form>
              {q.length >= 2 && (
                results.length === 0 ? (
                  <p className={styles.cardSub} style={{ marginTop: 10 }}>«{q}» için üye bulunamadı.</p>
                ) : (
                  <ul className={styles.results}>
                    {results.map((m) => (
                      <li key={m.userId}>
                        <span>
                          {m.fullName}
                          {m.membershipType && <span className={styles.resultTier}> · {m.membershipType}</span>}
                        </span>
                        <span className={styles.rowActions}>
                          {canManage && !invitedIds.has(m.userId) && (
                            <InlineAction action={inviteAction} fields={{ eventId: e.id, userId: m.userId }} label="Davet et" />
                          )}
                          {checkInOpen && (attendedIds.has(m.userId)
                            ? <span className={`${styles.miniButton} ${styles.miniButtonOn}`}>✓ Geldi</span>
                            : <InlineAction action={checkInAction} fields={{ eventId: e.id, userId: m.userId }} label="Katılım al" />)}
                          {!checkInOpen && invitedIds.has(m.userId) && <span className={styles.resultTier}>davetli</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </Card>
          )}

          {canManage && !cancelled && (
            <Card>
              <h2 className={styles.cardTitle}>Davet ekle</h2>
              <p className={styles.cardSub}>
                Segmentin şu anki üyeleri eklenir; zaten davetli olanların yanıtı korunur.
              </p>
              <ActionForm action={inviteAction} hiddenFields={{ eventId: e.id }}>
                <div className={f.field}>
                  <label className={f.label} htmlFor="ev-seg">Segment</label>
                  <select id="ev-seg" name="segmentId" className={f.select} defaultValue={e.segmentId ?? ""}>
                    <option value="">— seçin —</option>
                    {segmentOptions.map((sg) => (
                      <option key={sg.id} value={sg.id}>
                        {sg.name}{sg.lastCount !== null ? ` (${sg.lastCount})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={f.actions}><SubmitButton variant="ghost">Segmenti davet et</SubmitButton></div>
              </ActionForm>
            </Card>
          )}

          {canSend && (
            <Card>
              <h2 className={styles.cardTitle}>Davet gönderimi</h2>
              <ul className={styles.kv} style={{ margin: "0 0 12px" }}>
                <li><span>Gönderilen davet</span><span>{s.sentCount} / {s.invited}</span></li>
              </ul>
              <SendPanel event={e} />
            </Card>
          )}

          {canManage && s.sentCount === 0 && s.attended === 0 && (
            <InlineAction
              action={deleteEventAction}
              fields={{ id: e.id }}
              label="Etkinliği sil"
              className={styles.linkButton}
              confirmText={`«${e.title}» silinsin mi? Davet listesi de silinir.`}
            />
          )}
        </div>
      </div>
    </PageBody>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className={styles.stat}>
      <p className={styles.statValue}>{value}</p>
      <p className={styles.statLabel}>{label}</p>
    </div>
  );
}

function InviteeRow({
  i, eventId, canManage, canCheckIn, canRemind, past,
}: {
  i: EventInvitee; eventId: string; canManage: boolean; canCheckIn: boolean; canRemind: boolean; past: boolean;
}) {
  const tone = i.rsvp === "ACCEPTED" ? "good" : i.rsvp === "DECLINED" ? "crit" : "neutral";
  const ids = { eventId, userId: i.userId };
  return (
    <tr>
      <td>
        <Link href={`/members/${i.userId}`} className={ui.rowLink}>{i.fullName}</Link>
        {i.lastSendNote && <div className={styles.rowNote}>{i.lastSendNote}</div>}
        {!i.lastSendNote && i.sentAt && (
          <div className={styles.rowNote}>
            Gönderildi {formatDayMonth(i.sentAt)}{i.remindedAt ? ` · hatırlatıldı ${formatDayMonth(i.remindedAt)}` : ""}
          </div>
        )}
      </td>
      <td>{i.tier ? <span className={styles.typePill}>{i.tier}</span> : <span className={ui.faint}>—</span>}</td>
      <td>
        {canManage
          ? <RsvpSelect eventId={eventId} userId={i.userId} rsvp={i.rsvp} />
          : <Badge tone={tone}>{eventRsvpLabel(i.rsvp)}</Badge>}
      </td>
      <td className={ui.nowrap}>
        {i.respondedAt ? formatDayMonth(i.respondedAt) : <span className={ui.faint}>—</span>}
        {i.rsvpSource === "MEMBER" && <div className={styles.rowNote}>üye bildirdi</div>}
      </td>
      <td>
        <span className={styles.rowActions}>
          {canCheckIn && (i.attended
            ? <InlineAction action={undoCheckInAction} fields={ids} label="✓ Geldi"
                className={`${styles.miniButton} ${styles.miniButtonOn}`} confirmText="Katılım kaydı geri alınsın mı?" />
            : <InlineAction action={checkInAction} fields={ids} label="Geldi" />)}
          {canRemind && i.rsvp !== "DECLINED" && (
            <InlineAction action={sendEventMessagesAction}
              fields={{ ...ids, kind: "REMIND", channel: "EMAIL" }}
              label="Hatırlat" className={styles.linkButton}
              confirmText={`${i.fullName} için e-posta ile hatırlatma gönderilsin mi?`} />
          )}
          {canManage && !past && !i.sentAt && !i.attended && (
            <InlineAction action={uninviteAction} fields={ids} label="Kaldır" className={styles.linkButton} />
          )}
        </span>
      </td>
    </tr>
  );
}
