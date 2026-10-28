"use client";

import { useCallback, useEffect, useState } from "react";
import { dismissGateSilenceAction, gateSilenceAction } from "@/lib/gateAlertActions";
import type { GateSilence } from "@/lib/types";
import styles from "./gate.module.css";

/**
 * «No scans arriving» (V63), on «Turnikeler» only: members are drawing codes but the
 * supplier's system has reported nothing since — its link to us is down, so nobody's
 * entry or exit is being recorded (the turnstile itself still opens).
 *
 * ✕ hides it until the next report arrives; if the link drops again after that, it
 * comes back by itself. Checked every minute.
 */
const POLL_MS = 60_000;
const timeFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function SilenceWarning({ initial }: { initial: GateSilence | null }) {
  const [s, setS] = useState(initial);
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await gateSilenceAction();
    if (r) setS(r);
  }, []);

  useEffect(() => {
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!s || !s.active || hiddenKey === s.key) return null;

  async function dismiss(key: string) {
    setHiddenKey(key);
    if (!(await dismissGateSilenceAction(key))) setHiddenKey(null);
  }

  return (
    <div className={styles.silence} role="alert">
      <div className={styles.silenceBody}>
        <strong>Turnikeden kayıt gelmiyor</strong>
        <p>
          {s.lastScanAt ? `Son kayıt ${timeFmt.format(new Date(s.lastScanAt))}; ` : "Turnikeden henüz hiç kayıt gelmedi; "}
          o zamandan beri {s.codesSince} QR kodu verildi. Turnike açılıyor ama giriş ve çıkışlar kaydedilmiyor — tedarikçinin
          sistemiyle bağlantı kopmuş olabilir. Yöneticiye haber verin.
        </p>
      </div>
      <button type="button" className={styles.silenceClose} onClick={() => dismiss(s.key)} aria-label="Uyarıyı kapat" title="Kapat">
        ✕
      </button>
    </div>
  );
}
