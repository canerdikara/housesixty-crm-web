"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { entryPointLabel } from "@/lib/labels";
import type { EntryPoint, TurnstileDirection, TurnstileResult } from "@/lib/types";
import { validateScanAction } from "./actions";
import styles from "./turnstile.module.css";

/**
 * A turnstile, simulated with whatever camera the machine has.
 *
 * Reads the QR the member app draws — a standard code whose content is the raw token —
 * and POSTs it to `/access/qr/validate` exactly as the real gate will. It is a **test
 * tool**, which is why it is not in the sidebar and why the page above it says so.
 *
 * ## Four things here are not obvious
 *
 * **1. A token is single-use, and the camera sees it thirty times.** The first POST marks
 * it used; every subsequent one gets «Invalid or already used token» back. Without
 * [seen], one successful scan would flash green and then immediately red, over and over,
 * for as long as the code stayed in frame. Tokens already sent are remembered and
 * skipped.
 *
 * **2. A token lives 60 seconds.** So [seen] is not a leak — an entry older than the
 * token's own lifetime can never be presented again, and the set is pruned on that basis
 * rather than growing for the life of the tab.
 *
 * **3. `BarcodeDetector` is not in Safari**, and the failure mode is a camera that runs
 * and detects nothing — which looks like a broken scanner rather than an unsupported
 * browser. It is checked up front and says so.
 *
 * **4. `getUserMedia` needs a secure context.** `crm.housesixty.com` is HTTPS and
 * `localhost` counts as secure, so this works in both places — but not over plain HTTP
 * to a dev machine's LAN address, which is the one way somebody will try it and find a
 * permission error with no explanation.
 */

/** How long a decoded token is remembered, in ms. Its own TTL plus a margin. */
const TOKEN_TTL_MS = 75_000;
/** Between detection attempts. 10/s is far faster than a person presents a phone. */
const SCAN_INTERVAL_MS = 100;
/** How long a verdict stays on screen before scanning resumes. */
const VERDICT_MS = 2_500;

type Status =
  | { kind: "idle" }
  | { kind: "unsupported"; reason: string }
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "error"; reason: string };

export function TurnstileScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  // Token -> the moment it was sent. Not state: writing it must not re-render, and the
  // scan loop needs to read the newest value rather than the one from its closure.
  const seenRef = useRef<Map<string, number>>(new Map());
  const busyRef = useRef(false);

  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [entryPoint, setEntryPoint] = useState<EntryPoint>("MAIN_GATE");
  const [direction, setDirection] = useState<TurnstileDirection>("ENTRY");
  const [verdict, setVerdict] = useState<TurnstileResult | null>(null);
  const [log, setLog] = useState<{ at: string; name: string; ok: boolean; dir: string }[]>([]);

  // The selects change under the scan loop, so it reads them from a ref rather than
  // from a stale closure — otherwise switching to EXIT mid-session keeps sending ENTRY.
  const settingsRef = useRef({ entryPoint, direction });
  useEffect(() => {
    settingsRef.current = { entryPoint, direction };
  }, [entryPoint, direction]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus({ kind: "idle" });
  }, []);

  const start = useCallback(async () => {
    // Checked before asking for the camera, so an unsupported browser is told what is
    // wrong instead of being asked for a permission it cannot use.
    const Detector = (globalThis as any).BarcodeDetector;
    if (!Detector) {
      setStatus({
        kind: "unsupported",
        reason:
          "Bu tarayıcı BarcodeDetector desteklemiyor. Chrome, Edge veya Android Chrome kullanın — Safari bu API'yi desteklemez.",
      });
      return;
    }
    try {
      const formats: string[] = await Detector.getSupportedFormats();
      if (!formats.includes("qr_code")) {
        setStatus({ kind: "unsupported", reason: "Bu tarayıcı QR formatını okuyamıyor." });
        return;
      }
      detectorRef.current = new Detector({ formats: ["qr_code"] });
    } catch {
      setStatus({ kind: "unsupported", reason: "Barkod okuyucu başlatılamadı." });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus({
        kind: "unsupported",
        // The single most likely cause, named — a dev machine reached over plain HTTP.
        reason: "Kameraya erişilemiyor. Sayfanın HTTPS üzerinden açılması gerekir.",
      });
      return;
    }

    setStatus({ kind: "starting" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Ignored by a laptop, which has only one camera, and correct on a phone.
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus({ kind: "scanning" });
    } catch (err) {
      setStatus({
        kind: "error",
        reason:
          err instanceof Error && err.name === "NotAllowedError"
            ? "Kamera izni verilmedi."
            : "Kamera açılamadı.",
      });
    }
  }, []);

  // Stop the camera when the component goes away. Without this the light stays on and
  // the track stays held until the tab is closed.
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (status.kind !== "scanning") return;

    let cancelled = false;
    const timer = setInterval(async () => {
      if (cancelled || busyRef.current) return;
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2) return;

      let codes: { rawValue: string }[] = [];
      try {
        codes = await detector.detect(video);
      } catch {
        // A transient decode failure is normal — a blurred frame, a half-covered code.
        return;
      }
      const raw = codes[0]?.rawValue?.trim();
      if (!raw) return;

      const now = Date.now();
      // Prune, then check. See note 1: without this, every success is chased by a
      // failure for as long as the phone stays in frame.
      for (const [t, at] of seenRef.current) {
        if (now - at > TOKEN_TTL_MS) seenRef.current.delete(t);
      }
      if (seenRef.current.has(raw)) return;
      seenRef.current.set(raw, now);

      busyRef.current = true;
      const { entryPoint: ep, direction: dir } = settingsRef.current;
      const result = await validateScanAction({ token: raw, entryPoint: ep, direction: dir });
      if (cancelled) return;

      setVerdict(result);
      setLog((prev) =>
        [
          {
            at: new Intl.DateTimeFormat("tr-TR", {
              timeZone: "Europe/Istanbul",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }).format(new Date()),
            name: result.memberName ?? "—",
            ok: result.valid,
            dir: dir === "ENTRY" ? "Giriş" : "Çıkış",
          },
          ...prev,
        ].slice(0, 12)
      );

      // Hold the verdict, then go back to scanning. A real gate does the same thing with
      // a light, and without the pause the result is gone before anybody reads it.
      setTimeout(() => {
        if (!cancelled) {
          setVerdict(null);
          busyRef.current = false;
        }
      }, VERDICT_MS);
    }, SCAN_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status.kind]);

  return (
    <div className={styles.layout}>
      <div>
        <div className={styles.controls}>
          <label className={styles.control}>
            <span className={styles.controlLabel}>Okuyucu</span>
            <select
              className={styles.select}
              value={entryPoint}
              onChange={(e) => setEntryPoint(e.target.value as EntryPoint)}
            >
              {(["MAIN_GATE", "SPA_ENTRANCE", "GYM_ENTRANCE"] as const).map((p) => (
                <option key={p} value={p}>
                  {entryPointLabel(p)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.control}>
            <span className={styles.controlLabel}>Yön</span>
            <select
              className={styles.select}
              value={direction}
              onChange={(e) => setDirection(e.target.value as TurnstileDirection)}
            >
              <option value="ENTRY">Giriş</option>
              <option value="EXIT">Çıkış</option>
            </select>
          </label>

          {status.kind === "scanning" ? (
            <button type="button" className={styles.stopButton} onClick={stop}>
              Durdur
            </button>
          ) : (
            <button type="button" className={styles.startButton} onClick={start}>
              Kamerayı başlat
            </button>
          )}
        </div>

        <div className={`${styles.stage} ${verdict ? (verdict.valid ? styles.stageOk : styles.stageBad) : ""}`}>
          {/* Always mounted: attaching a stream to a <video> that does not exist yet is
              the classic way this fails, and re-mounting it mid-session drops the feed. */}
          <video ref={videoRef} className={styles.video} muted playsInline />

          {status.kind === "idle" && (
            <div className={styles.overlay}>
              <p className={styles.overlayTitle}>Kamera kapalı</p>
              <p className={styles.overlayText}>
                Üyenin uygulamadaki QR kodunu okutmak için kamerayı başlatın.
              </p>
            </div>
          )}
          {status.kind === "starting" && (
            <div className={styles.overlay}>
              <p className={styles.overlayTitle}>Kamera açılıyor…</p>
            </div>
          )}
          {(status.kind === "unsupported" || status.kind === "error") && (
            <div className={styles.overlay}>
              <p className={styles.overlayTitle}>Okuyucu çalıştırılamadı</p>
              <p className={styles.overlayText}>{status.reason}</p>
            </div>
          )}

          {verdict && (
            <div className={styles.verdict}>
              <p className={styles.verdictMark}>{verdict.valid ? "✓" : "✕"}</p>
              <p className={styles.verdictName}>
                {verdict.valid ? (verdict.memberName ?? "Geçiş kabul edildi") : "Geçiş reddedildi"}
              </p>
              {/* The backend's own English string, verbatim. This is a stand-in for a
                  gate, and the exact text a real integrator receives is the useful part. */}
              <p className={styles.verdictMessage}>{verdict.message}</p>
            </div>
          )}
        </div>

        {status.kind === "scanning" && !verdict && (
          <p className={styles.hint}>
            Okutuluyor — {entryPointLabel(entryPoint)} ·{" "}
            {direction === "ENTRY" ? "Giriş" : "Çıkış"}. QR kodu kameraya gösterin.
          </p>
        )}
      </div>

      <aside className={styles.logCard}>
        <h2 className={styles.logTitle}>Bu oturumda okutulanlar</h2>
        {log.length === 0 ? (
          <p className={styles.logEmpty}>Henüz okutma yapılmadı.</p>
        ) : (
          <ul className={styles.log}>
            {log.map((row, i) => (
              <li key={`${row.at}-${i}`} className={styles.logRow}>
                <span className={styles.logTime}>{row.at}</span>
                <span className={styles.logName}>{row.name}</span>
                <span className={row.ok ? styles.logOk : styles.logBad}>
                  {row.ok ? row.dir : "Ret"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.logNote}>
          Bu liste yalnızca bu sekmede tutulur. Kalıcı kayıt «Anlık rapor» ve «Günlük
          rapor» ekranlarındadır.
        </p>
      </aside>
    </div>
  );
}
