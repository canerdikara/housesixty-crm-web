"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, TableWrap, EmptyState, ui } from "@/components/ui";
import type {
  GateAction,
  GateCommandLogItem,
  GateCommandStatus,
  GatePerson,
  GateSpaBooking,
  GateStatus,
  GateTurnstile,
  TurnstileDirection,
} from "@/lib/types";
import {
  createGateCommandAction,
  gateCommandAction,
  gateLogAction,
  gatePeopleAction,
  gateStatusAction,
} from "./actions";
import styles from "./gate.module.css";

/**
 * The desk's turnstile controls (turnstile.md §9.1, §9.4, §9.5).
 *
 * ## What a press does
 *
 * It creates a command the bridge at the club collects by long-polling, then this polls the
 * command until it settles. A command is good for **10 seconds** and never runs later, so
 * every outcome is final and named: «Açıldı ✓», the bridge's own failure message,
 * «Köprüye ulaşılamadı» (expired, or the bridge was offline — the backend refuses at once
 * rather than queueing), or «Sonuç gelmedi» (collected, never answered: look at the
 * turnstile). Buttons are disabled while a command is in flight.
 *
 * ## «Kapat» is not a lock
 *
 * It returns the turnstile to normal — locked, opening on a valid QR or a desk command —
 * and ends a hold-open (§15 #9). Nothing here can hold a turnstile shut against people
 * inside.
 *
 * ## The page stays open all shift
 *
 * Status every 10 s; the log every 30 s and after each command; and `router.refresh()`
 * every few minutes so the middleware refreshes the session cookies (§9.5). An action that
 * finds the session gone sends the browser to /login.
 */

const STATUS_POLL_MS = 10_000;
const LOG_POLL_MS = 30_000;
const SESSION_REFRESH_MS = 4 * 60_000;
const COMMAND_POLL_MS = 300;
/** 10 s expiry + 5 s grace + a margin: by then the backend has named the outcome. */
const COMMAND_GIVE_UP_MS = 17_000;
const FINAL: GateCommandStatus[] = ["DONE", "FAILED", "EXPIRED", "NO_RESULT"];

type Subject =
  | { kind: "none" }
  | { kind: "spa"; booking: GateSpaBooking }
  | { kind: "person"; person: GatePerson };

type Feedback = { tone: "good" | "crit" | "warn" | "busy"; text: string };

const timeFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });
const hhmm = (iso: string | null) => (iso ? timeFmt.format(new Date(iso)) : "");
const shortTime = (t: string) => t.slice(0, 5);

function toLogin(): never {
  window.location.href = "/login?next=/gate";
  throw new Error("redirecting to login");
}

export function TurnstileDesk({
  initialStatus,
  initialLog,
  spaBookings,
}: {
  initialStatus: GateStatus;
  initialLog: GateCommandLogItem[];
  spaBookings: GateSpaBooking[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [statusStale, setStatusStale] = useState(false);
  const [log, setLog] = useState(initialLog);
  // Null until mounted: an age computed from the clock on the server and again in the
  // browser never matches, and React refuses the hydration.
  const [now, setNow] = useState<number | null>(null);

  const [subject, setSubject] = useState<Subject>({ kind: "none" });
  const [reason, setReason] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GatePerson[]>([]);

  const [inFlight, setInFlight] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});

  // ── polling ──────────────────────────────────────────────────────────────────────

  const refreshStatus = useCallback(async () => {
    const r = await gateStatusAction();
    if (r.kind === "unauthorized") toLogin();
    if (r.kind === "ok") {
      setStatus(r.data);
      setStatusStale(false);
    } else {
      setStatusStale(true);
    }
  }, []);

  const refreshLog = useCallback(async () => {
    const r = await gateLogAction();
    if (r.kind === "unauthorized") toLogin();
    if (r.kind === "ok") setLog(r.data);
  }, []);

  useEffect(() => {
    const s = setInterval(refreshStatus, STATUS_POLL_MS);
    const l = setInterval(refreshLog, LOG_POLL_MS);
    const r = setInterval(() => router.refresh(), SESSION_REFRESH_MS);
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => [s, l, r, t].forEach(clearInterval);
  }, [refreshStatus, refreshLog, router]);

  // «Kim için?» search, debounced.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const r = await gatePeopleAction(term);
      if (r.kind === "unauthorized") toLogin();
      if (r.kind === "ok") setResults(r.data);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  // ── a press ──────────────────────────────────────────────────────────────────────

  const latestSubject = useRef(subject);
  latestSubject.current = subject;

  async function press(t: GateTurnstile, action: GateAction, direction?: TurnstileDirection) {
    const key = t.name;
    const s = latestSubject.current;
    const attach = action === "OPEN_ONCE";
    setInFlight(key);
    setFeedback((f) => ({ ...f, [key]: { tone: "busy", text: "Gönderiliyor…" } }));
    try {
      const created = await createGateCommandAction({
        turnstile: t.name,
        action,
        direction,
        subjectUserId: attach && s.kind === "person" ? s.person.userId : undefined,
        reservationId: attach && s.kind === "spa" ? s.booking.reservationId : undefined,
        reason: attach && s.kind === "none" && reason.trim() ? reason.trim() : undefined,
      });
      if (created.kind === "unauthorized") toLogin();
      if (created.kind === "offline") {
        setFeedback((f) => ({ ...f, [key]: { tone: "crit", text: "Köprüye ulaşılamadı — turnikeyi elle açın" } }));
        refreshStatus();
        return;
      }
      if (created.kind === "error") {
        setFeedback((f) => ({ ...f, [key]: { tone: "crit", text: created.message } }));
        return;
      }

      const deadline = Date.now() + COMMAND_GIVE_UP_MS;
      let final: { status: GateCommandStatus; resultMessage: string | null } = { status: "NO_RESULT", resultMessage: null };
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, COMMAND_POLL_MS));
        const c = await gateCommandAction(created.id);
        if (c.kind === "unauthorized") toLogin();
        if (c.kind === "ok" && FINAL.includes(c.status)) {
          final = c;
          break;
        }
      }
      setFeedback((f) => ({ ...f, [key]: outcome(action, final.status, final.resultMessage) }));
      // The person was for this one passage; the next press starts with nobody attached.
      if (attach && final.status === "DONE") {
        setSubject({ kind: "none" });
        setReason("");
      }
      refreshStatus();
      refreshLog();
    } finally {
      setInFlight(null);
    }
  }

  // ── render ───────────────────────────────────────────────────────────────────────

  const ageSec =
    status.lastSeenAt && now !== null ? Math.max(0, Math.round((now - Date.parse(status.lastSeenAt)) / 1000)) : null;
  const ageText = ageSec === null ? "" : ` — son sinyal ${ageSec} sn önce`;
  const online = status.bridgeOnline && !statusStale;

  return (
    <>
      <div
        className={`${styles.statusLine} ${
          !status.bridgeOnline ? styles.statusOff : statusStale || (ageSec ?? 0) > 60 ? styles.statusWarn : styles.statusOn
        }`}
        role="status"
      >
        {!status.bridgeOnline ? (
          <>
            <strong>Turnike köprüsü çevrimdışı — turnikeleri elle açın.</strong>
            {status.lastSeenAt ? ` Son sinyal ${hhmm(status.lastSeenAt)}.` : " Köprüden henüz hiç sinyal gelmedi."}
          </>
        ) : statusStale ? (
          <>Durum alınamıyor — son bilinen: çevrimiçi{ageText}.</>
        ) : (
          <>
            Turnike köprüsü çevrimiçi{ageText}
            {status.version ? <span className={styles.version}> · köprü {status.version}</span> : null}
          </>
        )}
      </div>

      <section className={styles.picker} aria-label="Kim için?">
        <h2 className={styles.cardTitle}>Kim için?</h2>
        <p className={styles.cardSub}>
          İsteğe bağlı, yalnızca «aç» düğmeleri için. Kişi seçilirse geçişi kaydedilir ve raporlarda «geldi» görünür.
        </p>

        <div className={styles.chosen}>
          {subject.kind === "none" ? (
            <span className={ui.faint}>Kişi seçilmedi</span>
          ) : (
            <>
              <strong>{subject.kind === "spa" ? subject.booking.fullName : subject.person.fullName}</strong>
              <span className={ui.faint}>
                {subject.kind === "spa"
                  ? ` · ${subject.booking.facilityName} ${shortTime(subject.booking.startTime)}`
                  : ` · ${roleShort(subject.person.role)}`}
              </span>
              <button type="button" className={`${ui.button} ${ui.buttonGhost} ${styles.small}`} onClick={() => setSubject({ kind: "none" })}>
                Kaldır
              </button>
            </>
          )}
        </div>

        {spaBookings.length > 0 && (
          <div className={styles.spaList}>
            <p className={styles.label}>Bugünkü spa rezervasyonları</p>
            <div className={styles.chips}>
              {spaBookings.map((b) => (
                <button
                  key={b.reservationId}
                  type="button"
                  className={`${styles.chip} ${subject.kind === "spa" && subject.booking.reservationId === b.reservationId ? styles.chipOn : ""}`}
                  onClick={() => setSubject({ kind: "spa", booking: b })}
                >
                  {shortTime(b.startTime)} · {b.fullName}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.searchRow}>
          <input
            className={ui.search}
            type="search"
            placeholder="Başka biri: ad soyad veya telefon"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Kişi ara"
          />
          {results.length > 0 && (
            <ul className={styles.results}>
              {results.map((p) => (
                <li key={p.userId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSubject({ kind: "person", person: p });
                      setQuery("");
                      setResults([]);
                    }}
                  >
                    {p.fullName} <span className={ui.faint}>· {roleShort(p.role)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {subject.kind === "none" && (
          <input
            className={`${ui.search} ${styles.reason}`}
            type="text"
            maxLength={200}
            placeholder="Kişi seçmeden açıyorsanız kısa bir not (ör. kargo)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Not"
          />
        )}
      </section>

      <div className={styles.turnstiles}>
        {(status.turnstiles.length > 0 ? status.turnstiles : PLACEHOLDER).map((t) => {
          const busy = inFlight !== null;
          const usable = online && status.turnstiles.length > 0;
          const held = t.doorStatus === 1;
          const fb = feedback[t.name];
          return (
            <section key={t.name} className={styles.turnstile}>
              <header className={styles.tHead}>
                <h2 className={styles.tName}>Turnike {t.name.replace(/^T/, "")}</h2>
                {!usable ? (
                  <Badge tone="crit">Bağlantı yok</Badge>
                ) : held ? (
                  <Badge tone="accent">Açık tutuluyor{t.holdOpenSince ? ` · ${hhmm(t.holdOpenSince)} itibarıyla` : ""}</Badge>
                ) : (
                  <Badge tone="good">Normal</Badge>
                )}
              </header>
              {usable && (!t.entryOnline || !t.exitOnline) && (
                <p className={styles.sideDown}>
                  {!t.entryOnline && !t.exitOnline
                    ? "İki tarafla da bağlantı yok."
                    : !t.entryOnline
                      ? "Giriş tarafıyla bağlantı yok."
                      : "Çıkış tarafıyla bağlantı yok."}
                </p>
              )}
              <div className={styles.buttons}>
                <button type="button" className={ui.button} disabled={busy || !usable || !t.entryOnline} onClick={() => press(t, "OPEN_ONCE", "ENTRY")}>
                  Giriş için aç
                </button>
                <button type="button" className={ui.button} disabled={busy || !usable || !t.exitOnline} onClick={() => press(t, "OPEN_ONCE", "EXIT")}>
                  Çıkış için aç
                </button>
                <button type="button" className={`${ui.button} ${ui.buttonGhost}`} disabled={busy || !usable} onClick={() => press(t, "HOLD_OPEN")}>
                  Açık tut
                </button>
                <button type="button" className={`${ui.button} ${ui.buttonGhost}`} disabled={busy || !usable} onClick={() => press(t, "RELEASE")}>
                  Kapat
                </button>
              </div>
              {fb && (
                <p className={`${styles.feedback} ${styles[`fb_${fb.tone}`]}`} role="status">
                  {fb.text}
                </p>
              )}
            </section>
          );
        })}
      </div>
      <p className={styles.footNote}>
        «Açık tut» turnikeyi serbest bırakır ve en geç 15 dakika sonra kendiliğinden normale döner. «Kapat» turnikeyi
        normale döndürür (kilitli; geçerli QR ya da buradan açma ile açılır) — içeridekileri kilitlemez.
      </p>

      <section className={styles.logCard}>
        <h2 className={styles.cardTitle}>Bugünkü işlemler</h2>
        {log.length === 0 ? (
          <EmptyState title="Bugün turnike işlemi yok" />
        ) : (
          <TableWrap>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Saat</th>
                  <th>Turnike</th>
                  <th>İşlem</th>
                  <th>Kim için</th>
                  <th>Kim açtı</th>
                  <th>Sonuç</th>
                </tr>
              </thead>
              <tbody>
                {log.map((c) => (
                  <tr key={c.id}>
                    <td className={ui.nowrap}>{hhmm(c.createdAt)}</td>
                    <td>{c.turnstile}</td>
                    <td>{actionLabel(c.action, c.direction)}</td>
                    <td>
                      {c.subjectName ? (
                        <>
                          {c.subjectName}
                          {c.subjectRole && c.subjectRole !== "MEMBER" ? <span className={ui.faint}> · {roleShort(c.subjectRole)}</span> : null}
                          {c.passRecorded ? <span className={ui.faint}> · geçiş kaydedildi</span> : null}
                        </>
                      ) : c.reason ? (
                        <span className={ui.faint}>{c.reason}</span>
                      ) : (
                        <span className={ui.faint}>—</span>
                      )}
                    </td>
                    <td>{c.requestedByName ?? <span className={ui.faint}>—</span>}</td>
                    <td>
                      <StatusBadge status={c.status} message={c.resultMessage} />
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

/** Shown before the bridge has ever reported its turnstiles: the two the club has. */
const PLACEHOLDER: GateTurnstile[] = [
  { name: "T1", entryOnline: false, exitOnline: false, doorStatus: null, holdOpenSince: null },
  { name: "T2", entryOnline: false, exitOnline: false, doorStatus: null, holdOpenSince: null },
];

function outcome(action: GateAction, status: GateCommandStatus, message: string | null): Feedback {
  switch (status) {
    case "DONE":
      return {
        tone: "good",
        text: action === "HOLD_OPEN" ? "Açık tutuluyor ✓" : action === "RELEASE" ? "Normale döndü ✓" : "Açıldı ✓",
      };
    case "FAILED":
      return { tone: "crit", text: `Olmadı: ${message ?? "köprü hata bildirdi"} — turnikeyi elle açın` };
    case "EXPIRED":
      return { tone: "crit", text: "Köprüye ulaşılamadı — turnikeyi elle açın" };
    default:
      return { tone: "warn", text: "Sonuç gelmedi — turnikeye bakın" };
  }
}

function StatusBadge({ status, message }: { status: GateCommandStatus; message: string | null }) {
  switch (status) {
    case "DONE":
      return <Badge tone="good">Tamam</Badge>;
    case "FAILED":
      return <Badge tone="crit">{message ? `Olmadı: ${message}` : "Olmadı"}</Badge>;
    case "EXPIRED":
      return <Badge tone="crit">Köprüye ulaşmadı</Badge>;
    case "NO_RESULT":
      return <Badge tone="accent">Sonuç gelmedi</Badge>;
    default:
      return <Badge tone="neutral">Bekleniyor</Badge>;
  }
}

function actionLabel(action: GateAction, direction: TurnstileDirection | null): string {
  if (action === "OPEN_ONCE") return direction === "EXIT" ? "Çıkış için açıldı" : "Giriş için açıldı";
  if (action === "HOLD_OPEN") return "Açık tut";
  return "Kapat (normale dön)";
}

function roleShort(role: string): string {
  switch (role) {
    case "GUEST": return "Misafir";
    case "TRAINER": return "Antrenör";
    case "EMPLOYEE": return "Çalışan";
    case "ADMIN": return "Yönetici";
    case "MEMBER": return "Üye";
    default: return role;
  }
}
