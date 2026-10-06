import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { Calendar } from "@/components/Calendar";
import { EmptyState, FilterChip, ChipRow, ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDate, izmirToday } from "@/lib/dates";
import { readSession } from "@/lib/session";
import { ROLE } from "@/lib/roles";
import type { FacilityType, ReservationCalendar } from "@/lib/types";
import { CalendarGrid } from "./CalendarGrid";
import styles from "./reservations.module.css";

export const metadata = { title: "Rezervasyonlar · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * «Rezervasyonlar» — a day of courts, and the desk's ability to work them.
 *
 * ## New scope
 *
 * There is no mockup for this screen and CRM.md never specified it. The club asked for one
 * place to see a day's padel and spa bookings and to add or cancel on a member's behalf.
 *
 * ## Why a grid and not a list
 *
 * The question a front desk asks is "what is free at six", and a list answers it only by
 * being read end to end. Courts are columns, hours are rows, and a free cell is a button.
 * The club runs four padel courts and two spa rooms on twelve slots a day, so a whole day
 * of either fits on one screen without scrolling — which is the property that makes the
 * grid worth its extra markup.
 *
 * ## Padel and spa are separate screens
 *
 * `facilityType` is a chip, not a column group. Four courts and two rooms have different
 * shapes, different prices and different people looking at them, and putting six columns
 * of two kinds side by side makes both harder to read than either alone.
 */
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; type?: string; slot?: string }>;
}) {
  const params = await searchParams;

  // İzmir's today, never the server's and never the viewer's. The backend runs UTC on
  // Beanstalk, so between midnight and 03:00 local a bare `new Date()` opens on yesterday.
  const today = izmirToday();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : today;

  const type: FacilityType = params.type === "SPA" ? "SPA" : "PADEL_COURT";

  const [result, session] = await Promise.all([
    apiRequest<ReservationCalendar>(
      `/api/v1/crm/reservations/calendar?date=${date}&facilityType=${type}`
    ),
    readSession(),
  ]);
  if (result.kind === "unauthorized") redirect("/login");

  /*
   * Presentation only — the backend refuses a booking from any other role with a 403.
   * Hiding the controls spares a marketing user a grid of buttons that all fail; it is
   * not the control, and a hand-edited cookie changes what is drawn and nothing else.
   */
  const canWrite = session?.user.role === ROLE.ADMIN || session?.user.role === ROLE.RECEPTION;

  const hrefFor = (d: string) => `/reservations?date=${d}&type=${type}`;
  const typeHref = (t: FacilityType) => `/reservations?date=${date}&type=${t}`;

  const isToday = date === today;
  const isPast = date < today;

  return (
    <PageBody>
      <PageHeader
        title="Rezervasyonlar"
        subtitle={
          result.kind === "ok"
            ? `${formatDate(date)}${isToday ? " · bugün" : ""} — ${result.data.bookedCount} dolu, ${result.data.availableCount} boş`
            : formatDate(date)
        }
        actions={
          !isToday ? (
            <a className={`${ui.button} ${ui.buttonGhost}`} href={hrefFor(today)}>
              Bugüne dön
            </a>
          ) : null
        }
      />

      <ChipRow>
        <FilterChip href={typeHref("PADEL_COURT")} active={type === "PADEL_COURT"}>
          Padel
        </FilterChip>
        <FilterChip href={typeHref("SPA")} active={type === "SPA"}>
          Spa
        </FilterChip>
      </ChipRow>

      <div>
        <Card>
          {result.kind === "forbidden" ? (
            <EmptyState title="Bu ekranı görüntüleme yetkiniz yok">{result.message}</EmptyState>
          ) : result.kind === "error" ? (
            <EmptyState title="Takvim yüklenemedi">{result.message}</EmptyState>
          ) : (
            <CalendarGrid
              calendar={result.data}
              dateLabel={formatDate(date)}
              canWrite={canWrite}
              /* A court in the past cannot be booked — the backend refuses it — so the
                 empty cells are drawn as empty rather than as buttons that 400. */
              readOnly={isPast}
              /* A day with no slots still draws the grid component: its empty state keeps
                 the month picker beside it and offers «Rezervasyon ekle» (2026-10-06). It
                 used to be a bare message — no way to change the day, no way to book. */
              initialSlotId={/^[0-9a-f-]{36}$/.test(params.slot ?? "") ? params.slot : undefined}
              aside={
                <Calendar
                  selected={date}
                  today={today}
                  hrefFor={hrefFor}
                  /* No bounds, unlike «Günlük rapor». Yesterday's courts are worth looking
                     at and tomorrow's are the entire point of a booking screen. */
                />
              }
            />
          )}
        </Card>
      </div>
    </PageBody>
  );
}
