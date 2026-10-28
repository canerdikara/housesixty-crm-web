"use client";

import { useCallback, useEffect, useState } from "react";
import { readerLabel } from "@/lib/gate";
import { dismissGateAlertAction, gateAlertsAction } from "@/lib/gateAlertActions";
import type { GateAlert } from "@/lib/types";
import styles from "./gateAlerts.module.css";

/**
 * Turnstile warnings (V63) on top of every panel page, for ADMIN and RECEPTION.
 *
 * They stay until someone presses ✕, and the ✕ is shared: one person at the desk handles
 * a warning for everyone. Polled every 20 s; the layout keeps this mounted across
 * navigation, so a warning does not flicker away when somebody changes page.
 */

const POLL_MS = 20_000;
const timeFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "short" });
const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });

/** "14:05" today, "27 Eki 14:05" before. */
function when(iso: string): string {
  const d = new Date(iso);
  const t = timeFmt.format(d);
  return isoDay.format(d) === isoDay.format(new Date()) ? t : `${dayFmt.format(d)} ${t}`;
}

export function GateAlerts() {
  const [alerts, setAlerts] = useState<GateAlert[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const r = await gateAlertsAction();
    if (r) setAlerts(r);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function dismiss(id: string) {
    // Gone at once; if the server refused, it comes back on the next poll.
    setHidden((h) => new Set(h).add(id));
    const ok = await dismissGateAlertAction(id);
    if (!ok) {
      setHidden((h) => {
        const n = new Set(h);
        n.delete(id);
        return n;
      });
    }
  }

  const shown = alerts.filter((a) => !hidden.has(a.id));
  if (shown.length === 0) return null;

  return (
    <div className={styles.stack} role="region" aria-label="Turnike uyarıları">
      {shown.map((a) => (
        <div key={a.id} className={styles.alert} role="alert">
          <div className={styles.body}>
            {a.kind === "UNKNOWN_CODE" ? (
              <>
                <strong>Tanımsız kodla geçiş</strong> · {when(a.occurredAt)} · {readerLabel(a.reader)}
                <p className={styles.detail}>
                  Turnike geçerli bir kodla açıldı ama kod o an kimseye verilmemişti — büyük olasılıkla eski bir QR
                  ekran görüntüsü. Kim olduğu bilinmiyor.
                </p>
              </>
            ) : (
              <>
                <strong>{a.memberName ?? "Bir üye"} içerideyken tekrar giriş yaptı</strong> · {when(a.occurredAt)} ·{" "}
                {readerLabel(a.reader)}
                <p className={styles.detail}>
                  {a.previousEntryAt ? `Önceki giriş ${when(a.previousEntryAt)}, arada çıkış yok. ` : ""}
                  Kodu başka biri kullanmış olabilir (ya da kişi çıkarken okutmadı).
                </p>
              </>
            )}
          </div>
          <button type="button" className={styles.close} onClick={() => dismiss(a.id)} aria-label="Uyarıyı kapat" title="Kapat">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
