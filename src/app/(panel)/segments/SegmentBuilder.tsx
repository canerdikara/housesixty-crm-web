"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formStyles as f } from "@/components/Form";
import { ui } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import {
  segmentFieldLabel,
  segmentOperatorLabel,
  segmentValueLabel,
} from "@/lib/labels";
import type { SegmentField, SegmentListItem, SegmentPreview, SegmentRule } from "@/lib/types";
import { previewSegmentAction, saveSegmentAction } from "./actions";
import styles from "./segments.module.css";

/**
 * «Segment Oluşturucu» — mockup screen 10, for both a new segment and an existing one.
 *
 * The one client component on this screen, and it has to be: the preview updates as the
 * rules are edited, which is the whole point of the design. It still never touches the
 * API — every call goes through a server action, so the bearer token stays in its
 * httpOnly cookie.
 *
 * **The field catalogue comes from the server**, in [fields]. The builder cannot offer a
 * field, an operator or a value that `SegmentQueryBuilder`'s whitelist does not accept,
 * because it does not know any others exist.
 */
export function SegmentBuilder({
  fields,
  existing,
  initialPreview,
}: {
  fields: SegmentField[];
  existing?: SegmentListItem;
  initialPreview: SegmentPreview | null;
}) {
  const router = useRouter();

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isDynamic, setIsDynamic] = useState(existing?.isDynamic ?? true);
  const [rules, setRules] = useState<SegmentRule[]>(existing?.rules ?? []);

  const [preview, setPreview] = useState<SegmentPreview | null>(initialPreview);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /*
   * The live preview, debounced.
   *
   * Every keystroke in a number box is a rule change, and each one is a COUNT over the
   * membership — so the request is held for [DEBOUNCE_MS] and the timer restarted while
   * somebody is still typing. The backend caps the work as well (twenty rules, a
   * ten-row sample); this is the half that stops it being asked in the first place.
   *
   * `first` skips the call on mount: the server already rendered a preview for the
   * rules we started with, and re-fetching it would flash the number for no reason.
   */
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    /*
     * A rule mid-edit is not an error worth reporting.
     *
     * Clearing a number box to retype it leaves `value` empty, which the backend rejects
     * with a bean-validation message — in English, naming the wire field
     * ("rules[0].value: A rule needs a value"), beside a big Turkish number. It is also a
     * round trip that cannot succeed. Caught here instead, with a sentence in the
     * panel's own language; the backend still validates everything, this only spares it
     * the requests that are certain to fail.
     */
    const incomplete = rules.some((r) => !r.value.trim() || !r.op || !r.field);
    if (incomplete) {
      setPreviewError("Tamamlanmamış kriter var — değer girin.");
      return;
    }

    const timer = setTimeout(() => {
      startPreview(async () => {
        const result = await previewSegmentAction(rules);
        if (result.kind === "ok") {
          setPreview(result.preview);
          setPreviewError(null);
        } else {
          // The last good count stays on screen beside the message. A half-typed rule is
          // invalid for a keystroke or two and blanking the panel each time would make
          // the number flicker in and out while somebody is simply still typing.
          setPreviewError(result.message);
        }
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rules]);

  function addRule() {
    const field = fields[0];
    if (field) setRules([...rules, defaultRule(field)]);
  }

  function removeRule(index: number) {
    setRules(rules.filter((_, i) => i !== index));
  }

  /** Changing the field resets the operator and value — the old ones belonged to it. */
  function changeField(index: number, fieldName: string) {
    const field = fields.find((x) => x.field === fieldName);
    if (!field) return;
    setRules(rules.map((r, i) => (i === index ? defaultRule(field) : r)));
  }

  function patchRule(index: number, patch: Partial<SegmentRule>) {
    setRules(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!name.trim()) {
      setSaveError("Segmente bir ad verin.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await saveSegmentAction({
      id: existing?.id,
      name: name.trim(),
      description: description.trim() || undefined,
      isDynamic,
      rules,
    });
    setSaving(false);
    if ("error" in result) {
      setSaveError(result.error);
      return;
    }
    router.push("/segments");
    router.refresh();
  }

  return (
    <div className={styles.builder}>
      <div className={styles.builderMain}>
        {/* ── Definition ───────────────────────────────────────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Segment tanımı</h2>

          <div className={f.field} style={{ marginTop: 14 }}>
            <label className={`${f.label} ${f.required}`} htmlFor="s-name">Segment adı</label>
            <input
              id="s-name"
              className={f.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoFocus
              placeholder="Uzaklaşan padel oyuncuları"
            />
          </div>

          <div className={f.field}>
            <label className={f.label} htmlFor="s-desc">Açıklama</label>
            <input
              id="s-desc"
              className={f.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className={f.field}>
            <span className={f.label}>Tip</span>
            {existing ? (
              // Fixed at creation. Flipping it would either freeze a live segment or
              // throw away a frozen list, and neither belongs behind an edit form.
              <p className={styles.typeFixed}>
                {isDynamic ? "Dinamik" : "Statik"}
                <span className={styles.typeFixedNote}>
                  {isDynamic
                    ? "Kriterler her görüntülemede yeniden çalışır."
                    : "Üye listesi dondurulmuş. Yeniden çizmek için «Yeniden çalıştır»."}
                </span>
              </p>
            ) : (
              <div className={styles.typeToggle}>
                <button
                  type="button"
                  className={`${styles.typeButton} ${isDynamic ? styles.typeButtonOn : ""}`}
                  onClick={() => setIsDynamic(true)}
                  aria-pressed={isDynamic}
                >
                  Dinamik
                </button>
                <button
                  type="button"
                  className={`${styles.typeButton} ${!isDynamic ? styles.typeButtonOn : ""}`}
                  onClick={() => setIsDynamic(false)}
                  aria-pressed={!isDynamic}
                >
                  Statik
                </button>
              </div>
            )}
            {/* Only while choosing. Once fixed, `typeFixedNote` above says the same thing. */}
            {!existing && (
              <p className={styles.help}>
                {isDynamic
                  ? "Kriterlere uyan üyeler her zaman güncel. Gecelik olarak da yeniden sayılır."
                  : "Üye listesi kaydedildiği anda dondurulur; sonradan katılanlar girmez."}
              </p>
            )}
          </div>
        </section>

        {/* ── Rules ────────────────────────────────────────────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Kriterler</h2>
          <p className={styles.cardSub}>Tüm kriterler birlikte uygulanır</p>

          <div className={styles.rules}>
            {rules.map((rule, i) => {
              const field = fields.find((x) => x.field === rule.field);
              // A negating operator turns the row's conjunction into "and not", which is
              // how the mockup draws it — derived from the operator, never stored.
              const negated = rule.op === "excludes" || rule.op === "ne";
              return (
                <div key={i} className={styles.rule}>
                  <span className={`${styles.conj} ${negated ? styles.conjNot : ""}`}>
                    {negated ? "VE DEĞİL" : "VE"}
                  </span>

                  <select
                    className={styles.ruleField}
                    value={rule.field}
                    onChange={(e) => changeField(i, e.target.value)}
                    aria-label="Kriter alanı"
                  >
                    {fields.map((x) => (
                      <option key={x.field} value={x.field}>
                        {segmentFieldLabel(x.field)}
                      </option>
                    ))}
                  </select>

                  <select
                    className={styles.ruleOp}
                    value={rule.op}
                    onChange={(e) => patchRule(i, { op: e.target.value })}
                    aria-label="İşleç"
                  >
                    {(field?.operators ?? []).map((op) => (
                      <option key={op} value={op}>
                        {segmentOperatorLabel(op)}
                      </option>
                    ))}
                  </select>

                  {field && field.kind === "NUMBER" ? (
                    <input
                      className={styles.ruleValue}
                      type="number"
                      inputMode="numeric"
                      value={rule.value}
                      onChange={(e) => patchRule(i, { value: e.target.value })}
                      aria-label="Değer"
                    />
                  ) : (
                    <select
                      className={styles.ruleValue}
                      value={rule.value}
                      onChange={(e) => patchRule(i, { value: e.target.value })}
                      aria-label="Değer"
                    >
                      {(field?.values ?? []).map((v) => (
                        <option key={v} value={v}>
                          {segmentValueLabel(v)}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    className={styles.ruleRemove}
                    onClick={() => removeRule(i)}
                    aria-label={`${segmentFieldLabel(rule.field)} kriterini kaldır`}
                  >
                    ×
                  </button>
                </div>
              );
            })}

            <button type="button" className={styles.addRule} onClick={addRule}>
              + Kriter ekle
            </button>
          </div>

          {rules.length === 0 && (
            <p className={styles.help} style={{ marginTop: 12 }}>
              Kriter eklenmezse segment tüm aktif üyeleri kapsar.
            </p>
          )}
        </section>
      </div>

      {/* ── Preview ────────────────────────────────────────────────────────── */}
      <div className={styles.builderSide}>
        <section className={styles.card}>
          <div className={styles.previewHead}>
            <h2 className={styles.cardTitle}>Önizleme</h2>
            <p className={styles.cardSub}>
              {previewing ? "Hesaplanıyor…" : "Kriterler değiştikçe anlık güncellenir"}
            </p>
          </div>

          {preview ? (
            <>
              <p className={styles.previewCount}>
                {preview.matched}
                <span className={styles.previewCountUnit}>üye eşleşiyor</span>
              </p>
              <p className={styles.previewShare}>
                {/* Null share is an empty club, not nought per cent. */}
                {preview.share === null
                  ? `${preview.totalMembers} aktif üye`
                  : `${preview.totalMembers} aktif üyenin %${preview.share}'i`}
              </p>

              <TierChart counts={preview.byMembershipType} />
            </>
          ) : (
            <p className={styles.help}>Önizleme yüklenemedi.</p>
          )}

          {previewError && (
            <p className={styles.previewError} role="status">
              <span aria-hidden="true">▲</span>
              <span>{previewError}</span>
            </p>
          )}
        </section>

        {preview && preview.sample.length > 0 && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Örnek üyeler</h2>
            <p className={styles.cardSub}>İlk {preview.sample.length} kayıt</p>
            <table className={styles.sampleTable}>
              <thead>
                <tr>
                  <th>Üye</th>
                  <th>Üyelik</th>
                  <th>Son ziyaret</th>
                  <th>Bitiş</th>
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((m) => (
                  <tr key={m.userId}>
                    <td className={styles.sampleName}>
                      <Link href={`/members/${m.userId}`}>{m.fullName}</Link>
                    </td>
                    <td>{m.membershipType ?? "—"}</td>
                    <td>
                      {/* Null is "never came", which is worse than a big number. */}
                      {m.daysSinceLastVisit === null ? "hiç" : `${m.daysSinceLastVisit} gün`}
                    </td>
                    <td>{formatDate(m.membershipEnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      {/* ── Save ───────────────────────────────────────────────────────────── */}
      <div className={styles.builderFoot}>
        {saveError && (
          <p className={styles.saveError} role="alert">
            <span aria-hidden="true">▲</span>
            <span>{saveError}</span>
          </p>
        )}
        <Link className={`${ui.button} ${ui.buttonGhost}`} href="/segments">
          Vazgeç
        </Link>
        <button type="button" className={ui.button} onClick={save} disabled={saving}>
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}

/**
 * Matched members by membership tier — the preview's bar chart.
 *
 * Built from whatever tiers came back, not from the three the mockup draws: V23
 * collapsed production to Kurucu Üye and Üye, and a chart with a hardcoded third column
 * would draw an empty bar for a tier that no longer exists.
 */
function TierChart({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  /*
   * A one-column chart is not a chart.
   *
   * Production has two tiers, and most segments match members of only one — which drew a
   * single bar labelled "Üye" reading 4, directly beneath a large 4. The breakdown is
   * worth showing when it breaks something down.
   */
  if (entries.length < 2) return null;
  const max = entries.reduce((m, [, n]) => Math.max(m, n), 0);

  return (
    <div className={styles.tierChart}>
      {entries.map(([tier, n]) => (
        <div key={tier} className={styles.tierCol}>
          <span className={styles.tierValue}>{n}</span>
          <span
            className={styles.tierBar}
            style={{ height: `${Math.max(4, (n / max) * 100)}%` }}
            title={`${tier || "Üyeliksiz"}: ${n}`}
          />
          <span className={styles.tierLabel}>{tier || "Üyeliksiz"}</span>
        </div>
      ))}
    </div>
  );
}

/** A new rule, valid from the moment it appears — the preview fires on every change. */
function defaultRule(field: SegmentField): SegmentRule {
  return {
    field: field.field,
    op: field.operators[0] ?? "eq",
    value: field.kind === "NUMBER" ? "0" : (field.values?.[0] ?? ""),
  };
}

/** Long enough to cover typing a two-digit number, short enough to feel live. */
const DEBOUNCE_MS = 400;
