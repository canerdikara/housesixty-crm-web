import { Badge, EmptyState, TableWrap, ui } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { reportAreaLabel, shortTime } from "@/lib/labels";
import type { ReportAreaCount, ReportPerson } from "@/lib/types";
import styles from "./reports.module.css";

/**
 * The pieces «Anlık rapor» and «Günlük rapor» share.
 *
 * Both screens answer the same question about different moments, so the area breakdown
 * and the people table are written once. Server components — no state, nothing in the
 * client bundle.
 */

/**
 * Two numbers per area, side by side, and **never summed**.
 *
 * «Rezervasyonlu» is an expectation and «Turnikeden» is an arrival. Adding them would
 * double-count everybody who did both; averaging them would produce a number true of
 * neither. The gap between them is the useful part, and it is what the people table
 * below spells out person by person.
 */
export function AreaBreakdown({
  areas,
  turnstileEverUsed,
}: {
  areas: ReportAreaCount[];
  turnstileEverUsed: boolean;
}) {
  return (
    <div className={styles.areas}>
      {areas.map((a) => (
        <div key={a.area} className={styles.area}>
          <p className={styles.areaName}>{reportAreaLabel(a.area)}</p>
          <p className={styles.areaTotal}>{a.total}</p>
          <div className={styles.areaSplit}>
            <span>
              <span className={styles.areaNum}>{a.booked}</span> rezervasyonlu
            </span>
            <span>
              {/* An em dash, not a nought, while the turnstile has never written a row.
                  Zero would say "nobody scanned in"; the truth is "nothing is scanning". */}
              <span className={styles.areaNum}>{turnstileEverUsed ? a.checkedIn : "—"}</span>{" "}
              turnikeden
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The turnstile explanation, shown only while it has never recorded anything.
 *
 * The same judgement the dashboard's at-risk table makes about the same missing data:
 * say what is missing in words rather than drawing a convincing empty chart. It
 * disappears on its own the first time somebody scans in.
 */
export function TurnstileNotice({ used }: { used: boolean }) {
  if (used) return null;
  return (
    <p className={styles.notice}>
      <strong>Turnikeden henüz hiç geçiş kaydedilmedi.</strong> «Turnikeden» sütunları bu
      yüzden boş — kimsenin gelmediği anlamına gelmez. Kapı okuyucusu kayıt yazmaya
      başladığında bu satır kendiliğinden kaybolur ve sayılar dolar.
    </p>
  );
}

/**
 * One row per person, whichever way they appear.
 *
 * `showTimes` is off on the live screen: an arrival time is worth a column on a report
 * about a whole day and noise on one about this minute, where everybody listed is here
 * now.
 */
export function PeopleTable({
  people,
  turnstileEverUsed,
  showTimes = false,
  emptyTitle,
  emptyText,
}: {
  people: ReportPerson[];
  turnstileEverUsed: boolean;
  showTimes?: boolean;
  emptyTitle: string;
  emptyText: string;
}) {
  if (people.length === 0) {
    return <EmptyState title={emptyTitle}>{emptyText}</EmptyState>;
  }

  return (
    <TableWrap>
      <table className={ui.table}>
        <thead>
          <tr>
            <th>Kişi</th>
            <th>Alan</th>
            <th>Rezervasyon</th>
            <th>Durum</th>
            {showTimes && <th>Giriş</th>}
            {showTimes && <th>Çıkış</th>}
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.userId}>
              <td>
                <a className={ui.rowLink} href={`/members/${p.userId}`}>
                  {p.fullName}
                </a>
                {/* Staff and guests are in the building too, and a headcount that quietly
                    dropped the trainer taking the class would be wrong by one every hour.
                    The role is shown so the number is readable rather than surprising. */}
                {p.role !== "MEMBER" && <span className={styles.role}>{roleShort(p.role)}</span>}
              </td>
              <td>{reportAreaLabel(p.area)}</td>
              <td className={styles.bookingCell}>
                {p.bookings.length > 0 ? (
                  <>
                    <span>{p.bookings.join(" · ")}</span>
                    {p.slotStart && (
                      <span className={styles.slot}>
                        {shortTime(p.slotStart)}–{shortTime(p.slotEnd)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className={ui.faint}>—</span>
                )}
              </td>
              <td>
                <PresenceBadge person={p} turnstileEverUsed={turnstileEverUsed} />
              </td>
              {showTimes && (
                <td className={ui.nowrap}>
                  {p.enteredAt ? formatDateTime(p.enteredAt) : <span className={ui.faint}>—</span>}
                </td>
              )}
              {showTimes && (
                <td className={ui.nowrap}>
                  {p.leftAt ? formatDateTime(p.leftAt) : <span className={ui.faint}>—</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

/**
 * The four combinations of booked × checkedIn, each named for what the club would do.
 *
 * ⚠️ «Gelmedi» is **not** coloured as a failure while the turnstile has never recorded
 * anything: every single person would be a no-show, and a table of red rows caused by a
 * missing cable teaches whoever reads it daily to ignore the column. It stays neutral,
 * and the notice above the table says why.
 */
function PresenceBadge({
  person,
  turnstileEverUsed,
}: {
  person: ReportPerson;
  turnstileEverUsed: boolean;
}) {
  if (person.booked && person.checkedIn) return <Badge tone="good">Geldi</Badge>;
  if (person.checkedIn) return <Badge tone="accent">Rezervasyonsuz</Badge>;
  if (!turnstileEverUsed) return <Badge tone="neutral">Bekleniyor</Badge>;
  return <Badge tone="crit">Gelmedi</Badge>;
}

function roleShort(role: string): string {
  switch (role) {
    case "ADMIN": return "Yönetici";
    case "TRAINER": return "Antrenör";
    case "GUEST": return "Misafir";
    default: return role;
  }
}
