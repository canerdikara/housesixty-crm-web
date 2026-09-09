import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Avatar, Badge, EmptyState, Tag, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { daysSince, daysSinceLabel, dueLabel, formatDate, formatDateTime } from "@/lib/dates";
import {
  consentChannelLabel,
  interactionTypeLabel,
  interestLabel,
  leadSourceLabel,
  leadStatusLabel,
  leadStatusTone,
  LEAD_STATUS_ORDER,
} from "@/lib/labels";
import type { LeadDetail } from "@/lib/types";
import { AssignOwner, ChangeStatus, ConvertLead, LogInteraction, NextActionAndNotes } from "./LeadActions";
import styles from "./detail.module.css";

type PanelUser = { id: string; fullName: string; role: string };

export const dynamic = "force-dynamic";

/** The stage strip. LOST is excluded — it is not a step along the way. */
const STAGES = LEAD_STATUS_ORDER.filter((s) => s !== "LOST");

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowKey}>{k}</span>
      <span className={styles.rowValue}>{v ?? "—"}</span>
    </div>
  );
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0]!.slice(0, 2).toLocaleUpperCase("tr-TR");
  return (p[0]![0]! + p[p.length - 1]![0]!).toLocaleUpperCase("tr-TR");
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Both in parallel — the owner picker needs the staff list and neither depends on
  // the other, so serialising them would just add a round trip to every page load.
  const [result, usersResult] = await Promise.all([
    apiRequest<LeadDetail>(`/api/v1/crm/leads/${id}`),
    apiRequest<PanelUser[]>("/api/v1/crm/users"),
  ]);
  if (result.kind === "unauthorized") redirect("/login");
  // A failed staff list is not a failed page: the picker renders with only the
  // current owner and everything else on the screen still works.
  const users = usersResult.kind === "ok" ? usersResult.data : [];

  if (result.kind === "error" && result.status === 404) notFound();

  if (result.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Aday Detayı" subtitle="Adaylar" />
        <Card>
          <EmptyState
            title={result.kind === "forbidden" ? "Bu adayı görüntüleme yetkiniz yok" : "Aday yüklenemedi"}
          >
            {result.message}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const lead = result.data;
  const stageIndex = STAGES.indexOf(lead.status as (typeof STAGES)[number]);
  const contactInteractions = lead.interactions.filter((i) => i.type !== "SYSTEM");
  const visitCount = lead.interactions.filter((i) => i.type === "VISIT").length;
  const ageDays = daysSince(lead.createdAt) ?? 0;

  // Newest first from the API, and consent is append-only, so the first row for a
  // channel is its current state. Anything older is history, not the answer.
  const currentConsent = new Map<string, (typeof lead.consents)[number]>();
  for (const c of lead.consents) {
    if (!currentConsent.has(c.channel)) currentConsent.set(c.channel, c);
  }
  const granted = [...currentConsent.values()].filter((c) => c.state === "GRANTED");

  return (
    <PageBody>
      <PageHeader
        title="Aday Detayı"
        subtitle={
          <>
            <Link href="/leads">Adaylar</Link> › {lead.fullName}
          </>
        }
        actions={
          <Link className={`${ui.button} ${ui.buttonGhost}`} href="/leads">
            Listeye dön
          </Link>
        }
      />

      <div className={styles.hero}>
        <div className={styles.heroAvatar} aria-hidden="true">{initials(lead.fullName)}</div>

        <div className={styles.heroMain}>
          <h2 className={styles.heroName}>{lead.fullName}</h2>
          <p className={styles.heroMeta}>
            {leadSourceLabel(lead.source)} · {formatDate(lead.createdAt)}
            {lead.ownerName ? ` · Sorumlu: ${lead.ownerName}` : " · Sorumlu atanmadı"}
          </p>
          <div className={styles.heroTags}>
            <Badge tone={leadStatusTone(lead.status)}>{leadStatusLabel(lead.status)}</Badge>
            <Tag muted>{ageDays} gündür hunide</Tag>
            {lead.interestedIn && <Tag>{interestLabel(lead.interestedIn)}</Tag>}
            {lead.status === "LOST" && lead.lostReason && <Tag muted>{lead.lostReason}</Tag>}
          </div>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.stat}>
            <div className={styles.statValue}>{contactInteractions.length}</div>
            <div className={styles.statLabel}>etkileşim</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{visitCount}</div>
            <div className={styles.statLabel}>ziyaret</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{daysSinceLabel(lead.lastContactAt)}</div>
            <div className={styles.statLabel}>son temas</div>
          </div>
        </div>
      </div>

      <div className={styles.columns}>
        {/* ── Left: profile and consent ─────────────────────────────────── */}
        <div className={styles.stack}>
          <Card>
            <h2 className={styles.cardTitle}>İletişim ve profil</h2>
            <p className={styles.cardSub}>Adayın verdiği bilgiler</p>
            <div className={styles.rows}>
              <Row k="Telefon" v={lead.phone ? <span className="tnum">{lead.phone}</span> : "—"} />
              <Row k="E-posta" v={lead.email ?? "—"} />
              <Row k="Doğum yılı" v={lead.birthYear ?? "—"} />
              <Row k="Meslek" v={lead.occupation ?? "—"} />
              <Row k="Şirket" v={lead.company ?? "—"} />
              <Row k="Şehir" v={lead.city ?? "—"} />
              <Row k="Kaynak" v={leadSourceLabel(lead.source)} />
              <Row k="Sorumlu" v={lead.ownerName ?? "—"} />
            </div>
          </Card>

          <Card>
            <h2 className={styles.cardTitle}>KVKK rızası</h2>
            <p className={styles.cardSub}>Değiştirilemez kayıt</p>
            {lead.consents.length === 0 ? (
              <p className={ui.muted} style={{ margin: 0, fontSize: 13 }}>
                Bu aday için rıza kaydı yok.
              </p>
            ) : (
              <div className={styles.rows}>
                <Row k="Metin sürümü" v={lead.consents[0]!.textVersion} />
                <Row
                  k="Açık rıza"
                  v={`${granted.length > 0 ? "Verildi" : "Yok"} · ${formatDate(lead.consents[0]!.recordedAt)}`}
                />
                <Row
                  k="İletişim kanalı"
                  v={
                    granted.length > 0
                      ? granted.map((c) => consentChannelLabel(c.channel)).join(", ")
                      : "—"
                  }
                />
                {/*
                  Stated plainly rather than implied by the absence of an edit button.
                  A withdrawal is a new row; this record is evidence and cannot be
                  rewritten, and whoever is looking at it should know that.
                */}
                <Row k="Kayıt" v="Değiştirilemez" />
              </div>
            )}
          </Card>
        </div>

        {/* ── Middle: the timeline ──────────────────────────────────────── */}
        <div className={styles.stack}>
          <Card>
            <h2 className={styles.cardTitle}>Süreç</h2>
            <p className={styles.cardSub}>Etkileşim geçmişi</p>

            <div className={styles.stages}>
              {STAGES.map((s, i) => {
                // "Reached" rather than "is": a lead at PROPOSAL_SENT has been through
                // the earlier stages, and the strip should read as a journey.
                const done = stageIndex >= 0 && i <= stageIndex;
                return (
                  <div key={s}>
                    <div className={`${styles.stageBar} ${done ? styles.stageBarDone : ""}`} />
                    <div className={`${styles.stageLabel} ${done ? styles.stageLabelDone : ""}`}>
                      {leadStatusLabel(s)}
                    </div>
                  </div>
                );
              })}
            </div>

            {lead.interactions.length === 0 ? (
              <p className={ui.muted} style={{ margin: 0, fontSize: 13 }}>
                Henüz etkileşim kaydı yok.
              </p>
            ) : (
              <div className={styles.timeline}>
                {lead.interactions.map((entry) => (
                  <article key={entry.id} className={styles.entry}>
                    <span
                      className={`${styles.entryType} ${entry.type === "SYSTEM" ? styles.entryTypeSystem : ""}`}
                    >
                      {interactionTypeLabel(entry.type)}
                    </span>
                    <div className={styles.entryMain}>
                      <div className={styles.entryWhen}>{formatDateTime(entry.occurredAt)}</div>
                      <p className={styles.entryNote}>{entry.note}</p>
                    </div>
                    <span className={styles.entryWho}>
                      <Avatar name={entry.createdByName} />
                    </span>
                  </article>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Right: the things you can actually do ─────────────────────── */}
        <div className={styles.stack}>
          <Card>
            <h2 className={styles.cardTitle}>Etkileşim ekle</h2>
            <p className={styles.cardSub}>Arama, ziyaret, not</p>
            <LogInteraction lead={lead} />
          </Card>

          <Card>
            <h2 className={styles.cardTitle}>Durum</h2>
            <p className={styles.cardSub}>Huni aşaması</p>
            <ChangeStatus lead={lead} />
          </Card>

          <Card>
            <h2 className={styles.cardTitle}>Sorumlu</h2>
            <p className={styles.cardSub}>Adayı takip eden kişi</p>
            <AssignOwner lead={lead} users={users} />
          </Card>

          <Card>
            <h2 className={styles.cardTitle}>Sonraki adım ve notlar</h2>
            <p className={styles.cardSub}>
              {lead.nextActionAt ? `Planlanan: ${formatDate(lead.nextActionAt)} · ${dueLabel(lead.nextActionAt)}` : "Planlanmış aksiyon yok"}
            </p>
            <NextActionAndNotes lead={lead} />
          </Card>

          <Card>
            <h2 className={styles.cardTitle}>Üyeye dönüştür</h2>
            <p className={styles.cardSub}>Huninin son adımı</p>
            <ConvertLead lead={lead} />
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
