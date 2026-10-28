"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, TableWrap, EmptyState, ui } from "@/components/ui";
import { izmirNowLocalInput, izmirToday } from "@/lib/dates";
import type { DeskVisit, GatePerson } from "@/lib/types";
import {
  createDeskVisitAction,
  deleteDeskVisitAction,
  deskPeopleAction,
  deskVisitsAction,
  exitDeskVisitAction,
} from "./actions";
import styles from "./gate.module.css";

/**
 * The desk's turnstile log (V61, Can 2026-10-28).
 *
 * The desk opens the turnstile with the supplier's physical button; nothing here opens
 * anything. It records who was let through and when:
 *
 * - **Giriş** — a member (also a trainer or employee) without their phone or whose QR
 *   would not draw, picked from a search; or a guest, by name with a note on why they
 *   came. A member's entry also counts in the reports, like a scan. Date and time default
 *   to now and can be changed (the desk may write it down a little later).
 * - **Çıkış** — the people let in here with no exit yet; click one to give the exit time.
 * - **Kayıtlar** — one day's log, with «Sil» for a row written by mistake.
 *
 * The page stays open all shift: the lists refresh every 30 s, and `router.refresh()`
 * every few minutes keeps the session cookies fresh. An action that finds the session gone
 * sends the browser to /login.
 */

const LIST_POLL_MS = 30_000;
const SESSION_REFRESH_MS = 4 * 60_000;

type Mode = "member" | "guest";
type Feedback = { tone: "good" | "crit"; text: string } | null;

const timeFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });
const dayTimeFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" });

/** "14:05" today, "27 Eki 14:05" on another day. */
function when(iso: string | null, today: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return dayFmt.format(d) === today ? timeFmt.format(d) : dayTimeFmt.format(d);
}

function toLogin(): never {
  window.location.href = "/login?next=/gate";
  throw new Error("redirecting to login");
}

export function DeskLog({ initialOpen, initialDay, initialDate }: { initialOpen: DeskVisit[]; initialDay: DeskVisit[]; initialDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [day, setDay] = useState(initialDay);
  const [date, setDate] = useState(initialDate);
  const today = izmirToday();

  // ── entry form ──
  const [mode, setMode] = useState<Mode>("member");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GatePerson[]>([]);
  const [searched, setSearched] = useState(false);
  const [person, setPerson] = useState<GatePerson | null>(null);
  const [guestName, setGuestName] = useState("");
  const [note, setNote] = useState("");
  const [entryLocal, setEntryLocal] = useState(() => izmirNowLocalInput());
  const [saving, setSaving] = useState(false);
  const [entryFeedback, setEntryFeedback] = useState<Feedback>(null);

  // ── exit ──
  const [exiting, setExiting] = useState<string | null>(null);
  const [exitLocal, setExitLocal] = useState("");
  const [exitFeedback, setExitFeedback] = useState<Feedback>(null);

  const refresh = useCallback(async (d: string) => {
    const r = await deskVisitsAction(d);
    if (r.kind === "unauthorized") toLogin();
    if (r.kind === "ok") {
      setOpen(r.data.open);
      setDay(r.data.day);
    }
  }, []);

  useEffect(() => {
    const l = setInterval(() => refresh(date), LIST_POLL_MS);
    const s = setInterval(() => router.refresh(), SESSION_REFRESH_MS);
    return () => [l, s].forEach(clearInterval);
  }, [refresh, router, date]);

  // Member search, debounced.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const handle = setTimeout(async () => {
      const r = await deskPeopleAction(term);
      if (r.kind === "unauthorized") toLogin();
      if (r.kind === "ok") {
        setResults(r.data);
        setSearched(true);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function resetEntry() {
    setPerson(null);
    setQuery("");
    setResults([]);
    setGuestName("");
    setNote("");
    setEntryLocal(izmirNowLocalInput());
  }

  async function saveEntry() {
    setEntryFeedback(null);
    if (mode === "member" && !person) return setEntryFeedback({ tone: "crit", text: "Listeden bir üye seçin" });
    if (mode === "guest" && guestName.trim().length < 2) return setEntryFeedback({ tone: "crit", text: "Misafirin adını ve soyadını yazın" });
    setSaving(true);
    try {
      const r = await createDeskVisitAction({
        userId: mode === "member" ? person!.userId : undefined,
        guestName: mode === "guest" ? guestName : undefined,
        note,
        entryLocal,
      });
      if (r.kind === "unauthorized") toLogin();
      if (r.kind === "error") return setEntryFeedback({ tone: "crit", text: r.message });
      setEntryFeedback({ tone: "good", text: `${r.data.name} — giriş ${when(r.data.entryAt, today)} kaydedildi ✓` });
      resetEntry();
      refresh(date);
    } finally {
      setSaving(false);
    }
  }

  function startExit(v: DeskVisit) {
    setExitFeedback(null);
    setExiting(v.id);
    setExitLocal(izmirNowLocalInput());
  }

  async function saveExit(v: DeskVisit) {
    const r = await exitDeskVisitAction(v.id, exitLocal);
    if (r.kind === "unauthorized") toLogin();
    if (r.kind === "error") return setExitFeedback({ tone: "crit", text: r.message });
    setExitFeedback({ tone: "good", text: `${v.name} — çıkış ${when(r.data.exitAt, today)} kaydedildi ✓` });
    setExiting(null);
    refresh(date);
  }

  async function remove(v: DeskVisit) {
    if (!window.confirm(`${v.name} için ${when(v.entryAt, today)} girişli kayıt silinsin mi?${v.guest ? "" : " Raporlardaki giriş/çıkışı da silinir."}`)) return;
    const r = await deleteDeskVisitAction(v.id);
    if (r.kind === "unauthorized") toLogin();
    if (r.kind === "error") return window.alert(r.message);
    refresh(date);
  }

  function changeDate(d: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > today) return;
    setDate(d);
    refresh(d);
  }

  const nowMax = izmirNowLocalInput();

  return (
    <>
      <p className={styles.intro}>
        Turnikeyi resepsiyondaki butonla açtığınız kişileri buraya kaydedin: telefonu yanında olmayan ya da QR kodu
        oluşturamayan üyeler ve misafirler. Üyelerin giriş ve çıkışı raporlara da işlenir.
      </p>

      <div className={styles.grid}>
        {/* ── Giriş ── */}
        <section className={styles.card} aria-label="Giriş kaydı">
          <h2 className={styles.cardTitle}>Giriş</h2>

          <div className={styles.modeRow} role="radiogroup" aria-label="Kim?">
            {(["member", "guest"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                className={`${styles.chip} ${mode === m ? styles.chipOn : ""}`}
                onClick={() => {
                  setMode(m);
                  setEntryFeedback(null);
                }}
              >
                {m === "member" ? "Üye" : "Misafir"}
              </button>
            ))}
          </div>

          {mode === "member" ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="desk-person">Üye</label>
              {person ? (
                <div className={styles.chosen}>
                  <strong>{person.fullName}</strong>
                  {person.role !== "MEMBER" && <span className={ui.faint}>· {roleShort(person.role)}</span>}
                  <button type="button" className={`${ui.button} ${ui.buttonGhost} ${styles.small}`} onClick={() => setPerson(null)}>
                    Değiştir
                  </button>
                </div>
              ) : (
                <div className={styles.searchRow}>
                  <input
                    id="desk-person"
                    className={ui.search}
                    type="search"
                    autoComplete="off"
                    placeholder="Ad soyad veya telefon ile arayın"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {(results.length > 0 || (searched && query.trim().length >= 2)) && (
                    <ul className={styles.results}>
                      {results.length === 0 ? (
                        <li className={styles.noResult}>Eşleşen üye yok</li>
                      ) : (
                        results.map((p) => (
                          <li key={p.userId}>
                            <button
                              type="button"
                              onClick={() => {
                                setPerson(p);
                                setQuery("");
                                setResults([]);
                              }}
                            >
                              {p.fullName}
                              {p.role !== "MEMBER" && <span className={ui.faint}> · {roleShort(p.role)}</span>}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="desk-guest">Ad soyad</label>
              <input
                id="desk-guest"
                className={ui.search}
                type="text"
                maxLength={120}
                autoComplete="off"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="desk-note">
              {mode === "guest" ? "Not — neden geldi?" : "Not (isteğe bağlı)"}
            </label>
            <textarea
              id="desk-note"
              className={`${ui.search} ${styles.note}`}
              maxLength={500}
              rows={2}
              placeholder={mode === "guest" ? "Ör. 14:00 masaj randevusu" : "Ör. telefonu yanında değil"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="desk-entry">Giriş tarihi ve saati</label>
            <input
              id="desk-entry"
              className={`${ui.search} ${styles.when}`}
              type="datetime-local"
              max={nowMax}
              value={entryLocal}
              onChange={(e) => setEntryLocal(e.target.value)}
            />
          </div>

          <button type="button" className={ui.button} disabled={saving} onClick={saveEntry}>
            {saving ? "Kaydediliyor…" : "Girişi kaydet"}
          </button>
          {entryFeedback && (
            <p className={`${styles.feedback} ${styles[`fb_${entryFeedback.tone}`]}`} role="status">
              {entryFeedback.text}
            </p>
          )}
        </section>

        {/* ── Çıkış ── */}
        <section className={styles.card} aria-label="Çıkış kaydı">
          <h2 className={styles.cardTitle}>Çıkış</h2>
          <p className={styles.cardSub}>Burada girişi kaydedilmiş, çıkışı henüz girilmemiş kişiler. Çıkış için kişiye tıklayın.</p>
          {exitFeedback && (
            <p className={`${styles.feedback} ${styles[`fb_${exitFeedback.tone}`]}`} role="status">
              {exitFeedback.text}
            </p>
          )}
          {open.length === 0 ? (
            <EmptyState title="İçeride kayıtlı kimse yok" />
          ) : (
            <ul className={styles.openList}>
              {open.map((v) => (
                <li key={v.id} className={exiting === v.id ? styles.openOn : undefined}>
                  <button type="button" className={styles.openRow} onClick={() => (exiting === v.id ? setExiting(null) : startExit(v))}>
                    <span className={styles.openName}>
                      {v.name}
                      {v.guest ? <Badge tone="accent">Misafir</Badge> : v.role && v.role !== "MEMBER" ? <span className={ui.faint}> · {roleShort(v.role)}</span> : null}
                    </span>
                    <span className={ui.faint}>giriş {when(v.entryAt, today)}</span>
                  </button>
                  {v.note && <p className={styles.openNote}>{v.note}</p>}
                  {exiting === v.id && (
                    <div className={styles.exitForm}>
                      <label className={styles.label} htmlFor={`exit-${v.id}`}>Çıkış tarihi ve saati</label>
                      <input
                        id={`exit-${v.id}`}
                        className={`${ui.search} ${styles.when}`}
                        type="datetime-local"
                        max={nowMax}
                        value={exitLocal}
                        onChange={(e) => setExitLocal(e.target.value)}
                      />
                      <div className={styles.exitButtons}>
                        <button type="button" className={ui.button} onClick={() => saveExit(v)}>Çıkışı kaydet</button>
                        <button type="button" className={`${ui.button} ${ui.buttonGhost}`} onClick={() => setExiting(null)}>Vazgeç</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Kayıtlar ── */}
      <section className={styles.card} aria-label="Kayıtlar">
        <div className={styles.logHead}>
          <h2 className={styles.cardTitle}>Kayıtlar</h2>
          <input
            className={`${ui.search} ${styles.dateInput}`}
            type="date"
            max={today}
            value={date}
            onChange={(e) => changeDate(e.target.value)}
            aria-label="Gün"
          />
        </div>
        {day.length === 0 ? (
          <EmptyState title={date === today ? "Bugün elle kaydedilmiş geçiş yok" : "Bu gün elle kaydedilmiş geçiş yok"} />
        ) : (
          <TableWrap>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Giriş</th>
                  <th>Çıkış</th>
                  <th>Kişi</th>
                  <th>Not</th>
                  <th>Kaydeden</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {day.map((v) => (
                  <tr key={v.id}>
                    <td className={ui.nowrap}>{timeFmt.format(new Date(v.entryAt))}</td>
                    <td className={ui.nowrap}>{v.exitAt ? when(v.exitAt, dayFmt.format(new Date(v.entryAt))) : <span className={ui.faint}>içeride</span>}</td>
                    <td>
                      {v.name}{" "}
                      {v.guest ? <Badge tone="accent">Misafir</Badge> : v.role && v.role !== "MEMBER" ? <span className={ui.faint}>· {roleShort(v.role)}</span> : null}
                    </td>
                    <td>{v.note ?? <span className={ui.faint}>—</span>}</td>
                    <td className={ui.faint}>
                      {v.entryRecordedByName ?? "—"}
                      {v.exitRecordedByName && v.exitRecordedByName !== v.entryRecordedByName ? ` / ${v.exitRecordedByName}` : ""}
                    </td>
                    <td>
                      <button type="button" className={`${ui.button} ${ui.buttonGhost} ${styles.small}`} onClick={() => remove(v)}>
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </section>
    </>
  );
}

function roleShort(role: string): string {
  switch (role) {
    case "TRAINER": return "Antrenör";
    case "EMPLOYEE": return "Çalışan";
    case "MEMBER": return "Üye";
    default: return role;
  }
}
