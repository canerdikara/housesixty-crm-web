import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar } from "@/components/Calendar";
import { ActionForm, Disclosure, SubmitButton } from "@/components/Form";
// Directly, not `formStyles` from Form.tsx — that module is "use client", and a server
// component importing a plain value from one gets a reference, not the class map.
import f from "@/components/forms.module.css";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState, TableWrap, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDate, izmirToday } from "@/lib/dates";
import { readSession } from "@/lib/session";
import type { Employee, EmployeeDay, EmployeeDayView, EmployeeMonth, EmployeeScan } from "@/lib/types";
import { createEmployeeAction } from "./actions";
import { ActiveToggle } from "./EmployeeControls";
import styles from "./employees.module.css";

export const metadata = { title: "Çalışan takibi · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * «Çalışan takibi» — employees' turnstile entries and exits (new scope, 2026-10-05).
 *
 * Two views over the same scans: the **month grid** (employees down, days across, hours
 * and first-in/last-out per cell, a total per person, CSV for payroll), and the **day
 * timeline** one click away (every scan of every employee on a chosen day, drawn on an
 * 06:00–24:00 axis). ADMIN only — see the nav entry.
 *
 * Hours are counted by the backend from paired ENTRY → EXIT scans; a day that ends with
 * no exit is flagged and contributes nothing, rather than having a finish time guessed.
 * The screen says so, because somebody will otherwise read a short day as a short shift.
 */
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const today = izmirToday();
  const view = one("view") === "day" ? "day" : "month";
  const month = /^\d{4}-\d{2}$/.test(one("month")) ? one("month") : today.slice(0, 7);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(one("date")) && one("date") <= today ? one("date") : today;

  const session = await readSession();
  if (session?.user.role !== "ADMIN") {
    return (
      <PageBody>
        <PageHeader title="Çalışan takibi" />
        <Card><EmptyState title="Bu ekranı yalnızca yöneticiler görebilir" /></Card>
      </PageBody>
    );
  }

  const [data, employees] = await Promise.all([
    view === "month"
      ? apiRequest<EmployeeMonth>(`/api/v1/crm/employees/attendance?month=${month}`)
      : apiRequest<EmployeeDayView>(`/api/v1/crm/employees/attendance/day?date=${date}`),
    apiRequest<Employee[]>("/api/v1/crm/employees"),
  ]);
  if (data.kind === "unauthorized") redirect("/login");

  const tabs = (
    <div className={styles.toolbar}>
      <Link className={`${ui.button} ${view === "month" ? "" : ui.buttonGhost}`} href={`/employees?view=month&month=${view === "day" ? date.slice(0, 7) : month}`}>
        Aylık tablo
      </Link>
      <Link className={`${ui.button} ${view === "day" ? "" : ui.buttonGhost}`} href={`/employees?view=day&date=${view === "day" ? date : today}`}>
        Günlük
      </Link>
      {view === "month" && (
        <a className={`${ui.button} ${ui.buttonGhost}`} href={`/employees/export?month=${month}`}>CSV indir</a>
      )}
    </div>
  );

  return (
    <PageBody>
      <PageHeader
        title="Çalışan takibi"
        subtitle="Turnike giriş ve çıkışları · saatler giriş–çıkış eşleşmesinden hesaplanır"
        actions={tabs}
      />

      {data.kind !== "ok" ? (
        <Card><EmptyState title="Kayıtlar yüklenemedi">{data.message}</EmptyState></Card>
      ) : "employees" in data.data && view === "month" ? (
        <MonthGrid m={data.data as EmployeeMonth} />
      ) : (
        <DayView d={data.data as EmployeeDayView} />
      )}

      <EmployeesCard list={employees.kind === "ok" ? employees.data : []} error={employees.kind === "ok" ? null : "message" in employees ? employees.message : "Oturum süresi doldu"} />
    </PageBody>
  );
}

// ── Shared ──────────────────────────────────────────────────────────────────

const TZ = "Europe/Istanbul";
const hhmm = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso)) : "—";
const hours = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
/** Minutes past İzmir midnight. */
const minuteOfDay = (iso: string) => {
  const [h, m] = hhmm(iso).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

// ── Month grid ──────────────────────────────────────────────────────────────

function MonthGrid({ m }: { m: EmployeeMonth }) {
  const [y, mo] = m.month.split("-").map(Number) as [number, number];
  const daysIn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const dates = Array.from({ length: daysIn }, (_, i) => `${m.month}-${String(i + 1).padStart(2, "0")}`);
  const step = (delta: number) => {
    const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const next = step(1);
  const monthName = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, mo - 1, 15)));
  const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

  return (
    <Card>
      <div className={styles.toolbar} style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h2 className={styles.cardTitle}>Aylık tablo</h2>
          <p className={styles.cardSub} style={{ marginBottom: 0 }}>Bir güne tıklayın: o günün bütün okutmaları</p>
        </div>
        <div className={styles.stepper}>
          <Link href={`/employees?view=month&month=${step(-1)}`} aria-label="Önceki ay">‹</Link>
          <span className={styles.monthName}>{monthName}</span>
          {next <= m.today.slice(0, 7)
            ? <Link href={`/employees?view=month&month=${next}`} aria-label="Sonraki ay">›</Link>
            : <span className={styles.stepperOff} aria-hidden="true">›</span>}
        </div>
      </div>

      {m.employees.length === 0 ? (
        <EmptyState title="Henüz çalışan yok">Aşağıdaki «Çalışan ekle» ile ilk çalışanı ekleyin.</EmptyState>
      ) : (
        <>
          <div className={styles.gridWrap}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th className={styles.nameCol}>Çalışan</th>
                  {dates.map((d) => (
                    <th key={d} className={[0, 6].includes(weekday(d)) ? styles.weekend : ""}>
                      {Number(d.slice(8))}
                    </th>
                  ))}
                  <th className={styles.totalCol}>Toplam</th>
                </tr>
              </thead>
              <tbody>
                {m.employees.map((e) => {
                  const byDate = new Map(e.days.map((d) => [d.date, d]));
                  return (
                    <tr key={e.userId}>
                      <td className={styles.nameCol}>
                        {e.fullName}
                        {!e.isActive && <span className={styles.inactive}>devre dışı</span>}
                      </td>
                      {dates.map((d) => (
                        <MonthCell key={d} date={d} day={byDate.get(d)} today={m.today}
                          weekend={[0, 6].includes(weekday(d))} />
                      ))}
                      <td className={styles.totalCol}>
                        <div className={styles.totalHours}>{hours(e.totalMinutes)}</div>
                        <div className={styles.totalSub}>
                          {e.daysPresent} gün{e.openDays > 0 ? ` · ${e.openDays} çıkışsız` : ""}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.legend}>
            <span><span className={styles.swatch} />sa:dk · ilk giriş–son çıkış</span>
            <span><span className={`${styles.swatch} ${styles.cellOpen}`} />çıkış okutulmamış — süreye eklenmez</span>
            <span><span className={`${styles.swatch} ${styles.cellHere}`} />şu an içeride</span>
          </div>
        </>
      )}
    </Card>
  );
}

function MonthCell({ date, day, today, weekend }: { date: string; day?: EmployeeDay; today: string; weekend: boolean }) {
  if (!day) return <td className={`${styles.cell} ${weekend ? styles.weekend : ""}`} />;
  const here = day.openEntry && date === today;
  const cls = day.openEntry ? (here ? styles.cellHere : styles.cellOpen) : weekend ? styles.weekend : "";
  return (
    <td className={`${styles.cell} ${cls}`}>
      <Link className={styles.cellLink} href={`/employees?view=day&date=${date}`}
        title={`${formatDate(date)} · ${day.scanCount} okutma`}>
        <div className={styles.cellHours}>{day.workedMinutes > 0 ? hours(day.workedMinutes) : "—"}</div>
        <div className={styles.cellTimes}>{hhmm(day.firstEntry)}</div>
        {day.openEntry
          ? <div className={here ? styles.cellHereLabel : styles.cellOpenLabel}>{here ? "içeride" : "çıkış yok"}</div>
          : <div className={styles.cellTimes}>{hhmm(day.lastExit)}</div>}
      </Link>
    </td>
  );
}

// ── Day timeline ────────────────────────────────────────────────────────────

const AXIS_FROM = 6 * 60;
const AXIS_TO = 24 * 60;
const pct = (min: number) => `${((Math.min(Math.max(min, AXIS_FROM), AXIS_TO) - AXIS_FROM) / (AXIS_TO - AXIS_FROM)) * 100}%`;

/** The same pairing the backend counts hours with, so the bars and the numbers agree. */
function stretches(scans: EmployeeScan[]): { from: number; to: number | null }[] {
  const out: { from: number; to: number | null }[] = [];
  let open: number | null = null;
  for (const s of [...scans].sort((a, b) => a.at.localeCompare(b.at))) {
    const t = minuteOfDay(s.at);
    if (s.direction === "EXIT") {
      if (open !== null) { out.push({ from: open, to: t }); open = null; }
    } else if (open === null) {
      open = t;
    }
  }
  if (open !== null) out.push({ from: open, to: null });
  return out;
}

function DayView({ d }: { d: EmployeeDayView }) {
  const isToday = d.date === d.today;
  const nowMin = minuteOfDay(new Date().toISOString());
  const present = d.employees.filter((e) => e.scans.length > 0);
  const absent = d.employees.filter((e) => e.scans.length === 0);

  return (
    <div className={styles.dayLayout}>
      <Card>
        <h2 className={styles.cardTitle}>Gün seçin</h2>
        <p className={styles.cardSub}>Gelecek günler seçilemez</p>
        <Calendar selected={d.date} today={d.today} hrefFor={(x) => `/employees?view=day&date=${x}`} maxDate={d.today} />
      </Card>

      <Card>
        <h2 className={styles.cardTitle}>
          {new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long", timeZone: "UTC" })
            .format(new Date(`${d.date}T12:00:00Z`))}
        </h2>
        <p className={styles.cardSub}>
          {present.length} çalışan okuttu{absent.length > 0 ? ` · ${absent.length} kayıt yok` : ""} · 06:00–24:00
        </p>

        {present.length === 0 ? (
          <EmptyState title="Bu gün okutma yok" />
        ) : (
          <>
            <div className={styles.axis} aria-hidden="true">
              {/* The last label is right-aligned on its tick, or it hangs off the card. */}
              {[6, 9, 12, 15, 18, 21, 24].map((h) => (
                <span key={h} style={{ left: pct(h * 60), transform: h === 24 ? "translateX(-100%)" : undefined }}>
                  {String(h % 24).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {present.map((e) => (
              <div key={e.userId} className={styles.lane}>
                <div className={styles.laneName}>
                  {e.fullName}
                  {e.summary && (
                    <span className={styles.laneSub}>
                      {e.summary.workedMinutes > 0 ? `${hours(e.summary.workedMinutes)} sa` : "—"}
                      {e.summary.openEntry ? (isToday ? " · içeride" : " · çıkış yok") : ""}
                    </span>
                  )}
                </div>
                <div>
                  <span className={styles.track}>
                    {stretches(e.scans).map((s, i) => {
                      // An open stretch runs to now on today, and to the axis end otherwise,
                      // drawn faded: it is time nobody can vouch for, and it adds no hours.
                      const end = s.to ?? (isToday ? nowMin : AXIS_TO);
                      return (
                        <span key={i}
                          className={`${styles.stretch} ${s.to === null && !isToday ? styles.stretchOpen : ""}`}
                          style={{ left: pct(s.from), width: `calc(${pct(end)} - ${pct(s.from)})` }} />
                      );
                    })}
                    {e.scans.map((s, i) => (
                      <span key={`t${i}`} className={`${styles.tick} ${s.direction === "EXIT" ? styles.tickOut : styles.tickIn}`}
                        style={{ left: pct(minuteOfDay(s.at)) }} title={`${hhmm(s.at)} ${s.direction === "EXIT" ? "çıkış" : "giriş"}`} />
                    ))}
                  </span>
                  <ul className={styles.scanList}>
                    {e.scans.map((s, i) => (
                      <li key={i} className={s.direction === "EXIT" ? styles.scanOut : styles.scanIn}>
                        {s.direction === "EXIT" ? "↑ Çıkış" : "↓ Giriş"} {hhmm(s.at)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </>
        )}

        {absent.length > 0 && (
          <p className={styles.cardSub} style={{ marginTop: 14 }}>
            Okutması olmayan: {absent.map((e) => e.fullName).join(", ")}
          </p>
        )}
      </Card>
    </div>
  );
}

// ── Employees ───────────────────────────────────────────────────────────────

function EmployeesCard({ list, error }: { list: Employee[]; error: string | null }) {
  return (
    <Card>
      <h2 className={styles.cardTitle}>Çalışanlar</h2>
      <p className={styles.cardSub}>
        Çalışan hesabı yalnızca üye uygulamasındaki QR&apos;ı açar: rezervasyon, ders ya da turnuva yapamaz;
        yönetici uygulamasına ve panele giremez. Yönetici uygulamasından da eklenebilir.
      </p>

      {error ? (
        <EmptyState title="Çalışan listesi yüklenemedi">{error}</EmptyState>
      ) : list.length > 0 && (
        <TableWrap>
          <table className={ui.table}>
            <thead>
              <tr><th>Ad soyad</th><th>E-posta</th><th>Telefon</th><th>Durum</th><th /></tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.userId}>
                  <td>{e.fullName}</td>
                  <td className={ui.muted}>{e.email}</td>
                  <td className={ui.nowrap}>{e.phone ?? "—"}</td>
                  <td>{e.isActive ? "Etkin" : <span className={ui.faint}>Devre dışı</span>}</td>
                  <td className={styles.num}><ActiveToggle userId={e.userId} isActive={e.isActive} name={e.fullName} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Disclosure label="Çalışan ekle">
        <ActionForm action={createEmployeeAction}>
          <div className={f.row}>
            <div className={f.field}>
              <label className={`${f.label} ${f.required}`} htmlFor="emp-name">Ad soyad</label>
              <input id="emp-name" name="fullName" className={f.input} required maxLength={120} />
            </div>
            <div className={f.field}>
              <label className={`${f.label} ${f.required}`} htmlFor="emp-phone">Telefon</label>
              <input id="emp-phone" name="phone" className={f.input} required inputMode="tel" placeholder="05xx xxx xx xx" />
            </div>
          </div>
          <div className={f.field}>
            <label className={`${f.label} ${f.required}`} htmlFor="emp-mail">E-posta</label>
            <input id="emp-mail" name="email" type="email" className={f.input} required />
            <p className={f.hint}>Şifre sorulmaz: çalışan üye uygulamasına ilk girişinde kendisi belirler.</p>
          </div>
          <div className={f.actions}><SubmitButton>Çalışanı ekle</SubmitButton></div>
        </ActionForm>
      </Disclosure>
    </Card>
  );
}
