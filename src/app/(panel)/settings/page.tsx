import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Badge, EmptyState, Pagination, TableWrap, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/dates";
import { consentChannelLabel } from "@/lib/labels";
import { ROLE, roleLabel } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { ConsentLogRow, IysExport, Paged, PanelUserDetail, RoleCandidate } from "@/lib/types";
import { RoleButton, RoleSelect } from "./SettingsControls";
import styles from "./settings.module.css";

export const metadata = { title: "Ayarlar · House Sixty CRM" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/**
 * «Ayarlar» — mockup screen 17. ADMIN only, at every endpoint.
 *
 * ## No «Kullanıcı ekle» here, on purpose
 *
 * Accounts are created in the admin app (user's decision, 2026-10-06). What the admin app
 * cannot do is give an account a *panel* role — its pickers stop at Üye / Antrenör /
 * Yönetici / Misafir / Çalışan — so «Panele kullanıcı ekle» finds an existing member
 * account and gives it Satış, Pazarlama, Resepsiyon or Yönetici. The person sets their
 * password through the member app's first sign-in, as every account does.
 *
 * ## The matrix is a statement, not a setting
 *
 * It describes what the backend enforces (`@PreAuthorize` on each controller) and the
 * club's later decisions. Changing a cell here changes nothing — keep it in step with
 * the controllers and `lib/roles.ts` / `lib/nav.ts` when either moves.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => String((Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "").trim();
  const uq = one("uq");
  const subject = one("subject");
  const cq = one("cq");
  const page = Math.max(0, Number.parseInt(one("page"), 10) || 0);
  const isoDay = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  const ifrom = isoDay(one("ifrom"));
  const ito = isoDay(one("ito"));
  const iParams = new URLSearchParams();
  if (ifrom) iParams.set("from", ifrom);
  if (ito) iParams.set("to", ito);

  const cParams = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
  if (subject) cParams.set("subject", subject);
  if (cq) cParams.set("q", cq);

  const [session, users, candidates, consents, iys] = await Promise.all([
    readSession(),
    apiRequest<PanelUserDetail[]>("/api/v1/crm/settings/users"),
    uq.length >= 2
      ? apiRequest<RoleCandidate[]>(`/api/v1/crm/settings/users/candidates?q=${encodeURIComponent(uq)}`)
      : Promise.resolve(null),
    apiRequest<Paged<ConsentLogRow>>(`/api/v1/crm/consents?${cParams}`),
    apiRequest<IysExport>(`/api/v1/crm/consents/iys-export${iParams.size ? `?${iParams}` : ""}`),
  ]);
  if (users.kind === "unauthorized" || consents.kind === "unauthorized") redirect("/login");

  const header = <PageHeader title="Ayarlar" subtitle="Kullanıcılar, yetkiler ve KVKK kayıtları" />;

  if (users.kind === "forbidden" || session?.user.role !== ROLE.ADMIN) {
    return (
      <PageBody>
        {header}
        <Card><EmptyState title="Bu ekran yalnızca yöneticiler içindir" /></Card>
      </PageBody>
    );
  }

  const me = session.user.id;
  const panelUsers = users.kind === "ok" ? users.data : [];
  const found = candidates?.kind === "ok" ? candidates.data : [];

  const consentHref = (p: number) => {
    const q = new URLSearchParams();
    if (subject) q.set("subject", subject);
    if (cq) q.set("cq", cq);
    if (p > 0) q.set("page", String(p));
    const s = q.toString();
    return `/settings${s ? `?${s}` : ""}#kvkk`;
  };

  return (
    <PageBody>
      {header}

      <div className={styles.row}>
        <div className={styles.stack}>
          <Card>
            <h2 className={styles.cardTitle}>Panel kullanıcıları</h2>
            <p className={styles.cardSub}>{panelUsers.length} aktif kullanıcı · rol değişince kişinin oturumu kapanır</p>
            {users.kind !== "ok" ? (
              <EmptyState title="Kullanıcılar yüklenemedi">{users.message}</EmptyState>
            ) : (
              <TableWrap>
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th>Ad</th>
                      <th>E-posta</th>
                      <th>Rol</th>
                      <th>Son giriş</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panelUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.fullName}</strong>
                          {u.id === me && <div className={styles.rowNote}>siz</div>}
                          {!u.activated && <div className={styles.rowNote}>henüz şifre belirlemedi</div>}
                        </td>
                        <td className={styles.email}>{u.email}</td>
                        <td>
                          {u.id === me ? (
                            <span className={`${styles.rolePill} ${u.role === ROLE.ADMIN ? styles.rolePillAdmin : ""}`}>{roleLabel(u.role)}</span>
                          ) : (
                            <span className={styles.rowActions}>
                              <RoleSelect id={u.id} role={u.role} name={u.fullName} />
                              <RoleButton id={u.id} name={u.fullName} role="MEMBER" label="Panelden çıkar"
                                confirmText={`${u.fullName} panelden çıkarılsın mı? Hesabı «Üye» olarak kalır ve açık oturumları hemen kapanır.`} />
                            </span>
                          )}
                        </td>
                        <td className={ui.nowrap}>{u.lastLoginAt ? lastLogin(u.lastLoginAt) : <span className={ui.faint}>—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          <Card>
            <h2 className={styles.cardTitle} id="ekle">Panele kullanıcı ekle</h2>
            <p className={styles.cardSub}>
              Hesap önce yönetici uygulamasından «Üye» olarak oluşturulur; burada ona panel rolü verilir. Kişi şifresini
              üye uygulamasındaki ilk girişte belirler, sonra panele aynı e-posta ve şifreyle girer.
            </p>
            <form method="GET" action="/settings#ekle" className={ui.filterForm}>
              <input className={ui.search} type="search" name="uq" defaultValue={uq}
                placeholder="İsim veya e-posta" aria-label="Hesap ara" />
              <button type="submit" className={`${ui.button} ${ui.buttonGhost}`}>Ara</button>
            </form>
            {uq.length >= 2 && (found.length === 0 ? (
              <p className={styles.cardSub} style={{ marginTop: 10 }}>
                «{uq}» ile eşleşen aktif üye hesabı yok. Antrenör, misafir ve çalışan hesapları buradan panele eklenemez.
              </p>
            ) : (
              <ul className={styles.results}>
                {found.map((c) => (
                  <li key={c.id}>
                    <span>{c.fullName} <span className={styles.resultMeta}>· {c.email}</span></span>
                    <RoleButton id={c.id} name={c.fullName} label="Panele ekle" pick
                      confirmText={`${c.fullName} panele eklensin mi? Seçilen role göre üye verilerine erişebilecek.`} />
                  </li>
                ))}
              </ul>
            ))}
          </Card>
        </div>

        <Card>
          <h2 className={styles.cardTitle}>Rol yetki matrisi</h2>
          <p className={styles.cardSub}>Sağlık notu ve gelir verisi yalnızca yöneticide · sunucu tarafında uygulanır</p>
          <TableWrap>
            <table className={`${ui.table} ${styles.matrix}`}>
              <thead>
                <tr>
                  <th>Alan</th>
                  <th>Yönetici</th>
                  <th>Satış</th>
                  <th>Pazarlama</th>
                  <th>Resepsiyon</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX.map(([area, ...cells]) => (
                  <tr key={area}>
                    <td>{area}</td>
                    {cells.map((c, i) => <td key={i}><Cell v={c} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      </div>

      <Card>
        <div className={styles.cardHead}>
          <div>
            <h2 className={styles.cardTitle} id="kvkk">KVKK rıza kayıtları</h2>
            <p className={styles.cardSub}>Değiştirilemez kayıt — geri çekme yeni satır olarak yazılır</p>
          </div>
          <span className={styles.appendOnly}>Append-only</span>
        </div>
        <form method="GET" action="/settings#kvkk" className={ui.filterForm} style={{ marginBottom: 12 }}>
          <select className={ui.select} name="subject" defaultValue={subject} aria-label="Kişi türü">
            <option value="">Aday ve üye</option>
            <option value="LEAD">Yalnızca aday</option>
            <option value="MEMBER">Yalnızca üye</option>
          </select>
          <input className={ui.search} type="search" name="cq" defaultValue={cq} placeholder="İsim" aria-label="İsim ara" />
          <button type="submit" className={`${ui.button} ${ui.buttonGhost}`}>Filtrele</button>
        </form>
        {consents.kind !== "ok" ? (
          <EmptyState title="Kayıtlar yüklenemedi">{consents.message}</EmptyState>
        ) : consents.data.content.length === 0 ? (
          <EmptyState title="Kayıt yok" />
        ) : (
          <>
            <TableWrap>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Kişi</th>
                    <th>Tip</th>
                    <th>Metin sürümü</th>
                    <th>Kanal</th>
                    <th>Durum</th>
                    <th>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {consents.data.content.map((r) => (
                    <tr key={`${r.subjectId}-${r.recordedAt}-${r.state}-${r.textVersion}`}>
                      <td>
                        <Link className={ui.rowLink} href={r.subjectType === "MEMBER" ? `/members/${r.subjectId}` : `/leads/${r.subjectId}`}>
                          {r.name}
                        </Link>
                      </td>
                      <td><span className={styles.tagPill}>{r.subjectType === "MEMBER" ? "Üye" : "Aday"}</span></td>
                      <td>Açık rıza · {r.textVersion}</td>
                      <td>{r.channels.map(consentChannelLabel).join(", ")}</td>
                      <td>
                        <Badge tone={r.state === "GRANTED" ? "good" : "crit"}>{r.state === "GRANTED" ? "Verildi" : "Geri çekildi"}</Badge>
                      </td>
                      <td className={ui.nowrap}>{formatDate(r.recordedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pagination
              page={consents.data.page}
              totalPages={consents.data.totalPages}
              totalElements={consents.data.totalElements}
              size={consents.data.size}
              hrefFor={consentHref}
              noun="kaydın"
            />
          </>
        )}
      </Card>

      {/* Its own card under the log, spaced like the rest — Card takes no margin itself. */}
      <div style={{ marginTop: 18 }}>
      <Card>
        <div className={styles.cardHead}>
          <div>
            <h2 className={styles.cardTitle} id="iys">İYS&apos;ye aktar</h2>
            <p className={styles.cardSub}>
              Pazarlama izinlerinin İYS&apos;deki biçimi: her adres ve tür (MESAJ · ARAMA · EPOSTA) için son durum.
              Dosyayı İYS portalındaki toplu izin yüklemeye verin; önce kontrol listesini okuyun.
            </p>
          </div>
        </div>
        <form method="GET" action="/settings#iys" className={ui.filterForm} style={{ marginBottom: 12 }}>
          <label className={styles.resultMeta} htmlFor="iys-from">İzin tarihi</label>
          <input id="iys-from" className={ui.select} type="date" name="ifrom" defaultValue={ifrom} aria-label="Başlangıç" />
          <span className={styles.resultMeta}>–</span>
          <input className={ui.select} type="date" name="ito" defaultValue={ito} aria-label="Bitiş" />
          <button type="submit" className={`${ui.button} ${ui.buttonGhost}`}>Göster</button>
        </form>
        {iys.kind !== "ok" ? (
          <EmptyState title="İYS dökümü hazırlanamadı">{iys.kind === "unauthorized" ? "" : iys.message}</EmptyState>
        ) : (
          <>
            <ul className={styles.iysList}>
              <li><strong>{iys.data.summary.rows}</strong> satır aktarılacak{ifrom || ito ? " (seçilen tarihlerde)" : ""}</li>
              {iys.data.summary.addressBackfilled > 0 && (
                <li className={styles.iysWarn}>{iys.data.summary.addressBackfilled} satırda adres, izin alındığında kaydedilmemiş — kişinin bugünkü adresi kullanıldı</li>
              )}
              {iys.data.summary.sourceAssumed > 0 && (
                <li className={styles.iysWarn}>{iys.data.summary.sourceAssumed} satır panelden girilmiş: kaynak «fiziksel ortam» varsayıldı; telefonla alındıysa düzeltin</li>
              )}
              {iys.data.rows.some((r) => !r.source) && (
                <li className={styles.iysWarn}>
                  <strong>{iys.data.rows.filter((r) => !r.source).length} satırın kaynağı belirlenemedi</strong> — yüklemeden önce kontrol listesinden doldurun
                </li>
              )}
              {iys.data.summary.sourceInferred > 0 && (
                <li className={styles.iysWarn}>{iys.data.summary.sourceInferred} satırın kaynağı kayıttan çıkarıldı</li>
              )}
            </ul>
            <p className={styles.cardSub} style={{ margin: "10px 0 6px" }}>Aktarılmayanlar:</p>
            <ul className={styles.iysList}>
              <li>{iys.data.summary.processingOnly} yalnızca KVKK işleme rızası (pazarlama izni değil)</li>
              <li>{iys.data.summary.ambiguousPhone} eski «Telefon» kaydı — pazarlama izni mi işleme rızası mı belli değil</li>
              <li>{iys.data.summary.whatsapp} WhatsApp kaydı — İYS&apos;de hangi türe girdiği hukuken netleşmedi</li>
              <li>{iys.data.summary.noAddress} kayıt — o tür için geçerli adres yok (e-posta ya da cep telefonu)</li>
            </ul>
            <div className={styles.rowActions} style={{ marginTop: 14 }}>
              <a className={ui.button} href={`/settings/iys-export?kind=iys${iParams.size ? `&${iParams}` : ""}`}>İYS dosyasını indir (.csv)</a>
              <a className={`${ui.button} ${ui.buttonGhost}`} href={`/settings/iys-export?kind=review${iParams.size ? `&${iParams}` : ""}`}>Kontrol listesini indir</a>
            </div>
            <p className={styles.rowNote} style={{ marginTop: 10 }}>
              ⚠️ Sütunlar İYS veri modeline göre hazırlandı; İYS portalının kendi yükleme şablonuyla karşılaştırın.
              İYS&apos;den gelen ret bildirimleri bu sisteme düşmez — kampanya göndermeden önce İYS kontrol edilmelidir.
            </p>
          </>
        )}
      </Card>
      </div>
    </PageBody>
  );
}

/** "Bugün 09:12", "Dün 17:22", else the date — the mockup's column. İzmir days. */
function lastLogin(iso: string): string {
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(d);
  const time = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(iso));
  const now = new Date();
  const then = day(new Date(iso));
  if (then === day(now)) return `Bugün ${time}`;
  if (then === day(new Date(now.getTime() - 86_400_000))) return `Dün ${time}`;
  return formatDateTime(iso);
}

type Access = "full" | "read" | "none" | string;

function Cell({ v }: { v: Access }) {
  if (v === "full") return <span className={styles.yes} aria-label="tam yetki">✓</span>;
  if (v === "none") return <span className={styles.no} aria-label="erişim yok">—</span>;
  return <span className={styles.read}>{v === "read" ? "görüntüle" : v}</span>;
}

/**
 * Area · ADMIN · SALES · MARKETING · RECEPTION — what the backend actually enforces today.
 * CRM.md §6 plus the later decisions: reception books at the desk (2026-09-29) and takes
 * event attendance (2026-10-05); Gelirler and Çalışan takibi are ADMIN only; reception
 * records feedback; the trainer ratings on Geri Bildirim are ADMIN only.
 */
const MATRIX: [string, Access, Access, Access, Access][] = [
  ["Adaylar", "full", "full", "full", "full"],
  ["Üyeler", "full", "full", "read", "read"],
  ["Sağlık notu", "full", "none", "none", "none"],
  ["Rezervasyonlar", "full", "read", "read", "full"],
  ["Yenilemeler", "full", "full", "read", "none"],
  ["Gelirler", "full", "none", "none", "none"],
  ["Çalışan takibi", "full", "none", "none", "none"],
  ["Segmentler", "full", "full", "full", "none"],
  ["Kampanyalar", "full", "read", "full", "none"],
  ["Etkinlikler", "full", "full", "full", "görüntüle + katılım"],
  ["Geri Bildirim", "full", "read", "read", "kayıt"],
  ["KVKK kayıtları", "read", "none", "none", "none"],
  ["Ayarlar", "full", "none", "none", "none"],
];
