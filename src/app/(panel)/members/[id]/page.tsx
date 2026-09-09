import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Avatar, Badge, EmptyState, Tag, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { daysSinceLabel, formatDate, formatDateTime } from "@/lib/dates";
import {
  consentChannelLabel,
  interactionTypeLabel,
  interestLabel,
  monthShortLabel,
  renewalStatusLabel,
  termStatusLabel,
} from "@/lib/labels";
import type { MemberDetail } from "@/lib/types";
import detail from "../../leads/[id]/detail.module.css";
import styles from "./member.module.css";

export const dynamic = "force-dynamic";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className={detail.row}>
      <span className={detail.rowKey}>{k}</span>
      <span className={detail.rowValue}>{v ?? "—"}</span>
    </div>
  );
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0]!.slice(0, 2).toLocaleUpperCase("tr-TR");
  return (p[0]![0]! + p[p.length - 1]![0]!).toLocaleUpperCase("tr-TR");
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await apiRequest<MemberDetail>(`/api/v1/crm/members/${id}`);
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind === "error" && result.status === 404) notFound();

  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Üye 360" subtitle="Üyeler" />
        <Card>
          <EmptyState
            title={result.kind === "forbidden" ? "Bu üyeyi görüntüleme yetkiniz yok" : "Üye yüklenemedi"}
          >
            {result.message}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const m = result.data;
  const u = m.usage;
  const peakMonth = u.visitsByMonth.reduce((max, x) => Math.max(max, x.count), 0);

  return (
    <PageBody>
      <PageHeader
        title="Üye 360"
        subtitle={
          <>
            <Link href="/members">Üyeler</Link> › {m.fullName}
          </>
        }
        actions={
          <Link className={`${ui.button} ${ui.buttonGhost}`} href="/members">
            Listeye dön
          </Link>
        }
      />

      <div className={detail.hero}>
        <div className={detail.heroAvatar} aria-hidden="true">{initials(m.fullName)}</div>
        <div className={detail.heroMain}>
          <h2 className={detail.heroName}>{m.fullName}</h2>
          <p className={detail.heroMeta}>
            {m.membershipType ?? "Üyelik kaydı yok"} · Üyelik başlangıcı{" "}
            {formatDate(m.membershipStart ?? m.joinedAt)}
            {m.profile?.city ? ` · ${m.profile.city}` : ""}
          </p>
          <div className={detail.heroTags}>
            <Badge tone={m.atRisk ? "crit" : "good"}>{m.atRisk ? "Riskli" : "Aktif"}</Badge>
            {m.membershipEnd && <Tag muted>Bitiş {formatDate(m.membershipEnd)}</Tag>}
            <Tag muted>Son ziyaret: {daysSinceLabel(u.lastVisitAt)}</Tag>
            {/*
              Only ever rendered for an admin — the API sends null to everyone else, so
              this is absent rather than blank for a salesperson. Boxed and worded, not
              a bare icon: it is special-category data and should look like it.
            */}
            {m.hasHealthIssues === true && <Tag>Sağlık notu var</Tag>}
          </div>
        </div>

        <div className={detail.heroStats}>
          <div className={detail.stat}>
            <div className={detail.statValue}>{u.visitCountTotal}</div>
            <div className={detail.statLabel}>ziyaret</div>
          </div>
          <div className={detail.stat}>
            <div className={detail.statValue}>{u.tournamentCount}</div>
            <div className={detail.statLabel}>turnuva</div>
          </div>
          <div className={detail.stat}>
            <div className={detail.statValue}>{u.lessonCount}</div>
            <div className={detail.statLabel}>ders</div>
          </div>
          <div className={detail.stat}>
            <div className={detail.statValue}>{u.guestCount}</div>
            <div className={detail.statLabel}>misafir</div>
          </div>
        </div>
      </div>

      <div className={styles.columns}>
        {/* ── Left: usage and preferences ───────────────────────────────── */}
        <div className={styles.stack}>
          <Card>
            <h2 className={styles.cardTitle}>Ziyaret sıklığı</h2>
            <p className={styles.cardSub}>Aylık ziyaret · son 6 ay</p>
            <div className={styles.chart}>
              {u.visitsByMonth.map((mo) => (
                <div key={mo.month} className={styles.chartCol}>
                  <span className={styles.chartValue}>{mo.count}</span>
                  <span
                    className={styles.chartBar}
                    style={{ height: peakMonth === 0 ? "2px" : `${(mo.count / peakMonth) * 100}%` }}
                    // The bar is decorative; the number above it and the label below
                    // already state the value, so a screen reader hears it once.
                    aria-hidden="true"
                  />
                  <span className={styles.chartLabel}>{monthShortLabel(mo.month)}</span>
                </div>
              ))}
            </div>
            <div className={styles.stats} style={{ marginTop: 18 }}>
              <div className={styles.stat}>
                <div className={styles.statValue}>{u.visitCount30d}</div>
                <div className={styles.statLabel}>30 gün</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{u.visitCount90d}</div>
                <div className={styles.statLabel}>90 gün</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{u.reservationCount}</div>
                <div className={styles.statLabel}>rezervasyon</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{u.visitCountTotal}</div>
                <div className={styles.statLabel}>toplam</div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className={styles.cardTitle}>Tercihler</h2>
            <p className={styles.cardSub}>Üyenin bildirdiği tercihler</p>
            {m.preferences.length === 0 ? (
              <p className={ui.muted} style={{ margin: 0, fontSize: 13 }}>
                Kayıtlı tercih yok.
              </p>
            ) : (
              <div className={detail.rows}>
                {m.preferences.map((p) => (
                  <Row key={p.key} k={p.key} v={p.value} />
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className={styles.cardTitle}>Üyelik geçmişi</h2>
            <p className={styles.cardSub}>Dönem kayıtları</p>
            {m.terms.length === 0 ? (
              <p className={ui.muted} style={{ margin: 0, fontSize: 13 }}>
                {/*
                  membership_terms is new and nothing writes to it yet. Said plainly so
                  an empty card reads as "not populated" rather than "this member has
                  no history", which would be a different and wrong claim.
                */}
                Dönem kaydı yok. Üyelik geçmişi bu ekrana yeni eklendi; mevcut üyelik
                bilgisi yukarıda görünüyor.
              </p>
            ) : (
              m.terms.map((t) => (
                <div key={t.id} className={styles.term}>
                  <div>
                    <div className={styles.termName}>{t.membershipType}</div>
                    <div className={styles.termDates}>
                      {formatDate(t.startDate)} — {formatDate(t.endDate)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Badge tone={t.status === "ACTIVE" ? "good" : "neutral"}>
                      {termStatusLabel(t.status)}
                    </Badge>
                    <Tag muted>{renewalStatusLabel(t.renewalStatus)}</Tag>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        {/* ── Middle: the timeline ──────────────────────────────────────── */}
        <div className={styles.stack}>
          <Card>
            <h2 className={styles.cardTitle}>İletişim geçmişi</h2>
            <p className={styles.cardSub}>
              Üye olmadan önceki görüşmeler dahil
            </p>
            {m.interactions.length === 0 ? (
              <p className={ui.muted} style={{ margin: 0, fontSize: 13 }}>
                Henüz etkileşim kaydı yok.
              </p>
            ) : (
              <div className={styles.timeline}>
                {m.interactions.map((e) => (
                  <article key={e.id} className={styles.entry}>
                    <span
                      className={`${styles.entryType} ${e.type === "SYSTEM" ? styles.entryTypeSystem : ""}`}
                    >
                      {interactionTypeLabel(e.type)}
                    </span>
                    <div className={styles.entryMain}>
                      <div className={styles.entryWhen}>{formatDateTime(e.occurredAt)}</div>
                      <p className={styles.entryNote}>{e.note}</p>
                    </div>
                    <span style={{ flex: "0 0 auto" }}>
                      <Avatar name={e.createdByName} />
                    </span>
                  </article>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Right: profile, interests, consent ────────────────────────── */}
        <div className={styles.stack}>
          <Card>
            <h2 className={styles.cardTitle}>Profil</h2>
            <p className={styles.cardSub}>İletişim ve kişisel bilgiler</p>
            <div className={detail.rows}>
              <Row k="E-posta" v={m.email} />
              <Row k="Telefon" v={m.phone ? <span className="tnum">{m.phone}</span> : "—"} />
              <Row k="Üyelik başlangıcı" v={formatDate(m.membershipStart ?? m.joinedAt)} />
              <Row k="Doğum tarihi" v={m.profile?.birthDate ? formatDate(m.profile.birthDate) : "—"} />
              <Row k="Meslek" v={m.profile?.occupation ?? "—"} />
              <Row k="Şirket" v={m.profile?.company ?? "—"} />
              <Row k="Şehir" v={m.profile?.city ?? "—"} />
              <Row k="Padel seviyesi" v={m.profile?.padelLevel ?? "—"} />
              <Row
                k="Tercih ettiği kanal"
                v={m.profile?.preferredChannel ? consentChannelLabel(m.profile.preferredChannel) : "—"}
              />
            </div>
            {m.hasHealthIssues === true && (
              <p className={styles.health}>
                <span aria-hidden="true">▲</span>
                <span>
                  <strong>Sağlık notu var.</strong> KVKK kapsamında özel nitelikli
                  kişisel veridir; yalnızca yöneticiler görebilir.
                </span>
              </p>
            )}
          </Card>

          <Card>
            <h2 className={styles.cardTitle}>İlgi alanları</h2>
            <p className={styles.cardSub}>Segmentleme için kullanılır</p>
            {m.interests.length === 0 ? (
              <p className={ui.muted} style={{ margin: 0, fontSize: 13 }}>
                Kayıtlı ilgi alanı yok.
              </p>
            ) : (
              <div className={styles.interests}>
                {m.interests.map((i) => (
                  <span
                    key={i.category}
                    className={
                      i.level >= 3 ? styles.interestL3 : i.level === 2 ? styles.interestL2 : styles.interestL1
                    }
                    // The level is opacity, which nobody can read — so it is also said
                    // in the tooltip, because colour or weight alone is never the
                    // carrier of a value.
                    title={`${interestLabel(i.category)} · seviye ${i.level}/3`}
                  >
                    <Tag>{interestLabel(i.category)}</Tag>
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className={styles.cardTitle}>KVKK rızası</h2>
            <p className={styles.cardSub}>Değiştirilemez kayıt</p>
            {m.consents.length === 0 ? (
              <p className={ui.muted} style={{ margin: 0, fontSize: 13 }}>
                Rıza kaydı yok.
              </p>
            ) : (
              <div className={detail.rows}>
                {m.consents.slice(0, 6).map((c) => (
                  <Row
                    key={c.id}
                    k={consentChannelLabel(c.channel)}
                    v={
                      <>
                        {c.state === "GRANTED" ? "Verildi" : "Geri çekildi"} ·{" "}
                        {formatDate(c.recordedAt)}
                      </>
                    }
                  />
                ))}
                <Row k="Kayıt" v="Değiştirilemez" />
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
