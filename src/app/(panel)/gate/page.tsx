import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { izmirToday } from "@/lib/dates";
import { canControlGate } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { GateCommandLogItem, GateSpaBooking, GateStatus, ReservationCalendar } from "@/lib/types";
import { TurnstileDesk } from "./TurnstileDesk";

export const metadata = { title: "Turnikeler · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * «Turnikeler» — the desk opens, holds open and releases the two turnstiles (turnstile.md §9).
 *
 * Mainly for spa guests, who have no QR. The command goes to the gate bridge at the club,
 * which long-polls the backend for it; a command not collected within 10 seconds is never
 * executed, and while the bridge is offline the desk is told at once to open by hand.
 *
 * ADMIN and RECEPTION. ⚠️ The sidebar shows it to ADMIN only until the bridge is installed
 * (§9.5) — a page that can only ever say "offline" would teach the desk to ignore it.
 *
 * Today's spa bookings are offered first in «Kim için?», so attaching the guest — which
 * records their arrival — is the easy path rather than the extra step.
 */
export default async function GatePage() {
  const session = await readSession();
  if (!session) redirect("/login");

  if (!canControlGate(session.user.role)) {
    return (
      <PageBody>
        <PageHeader title="Turnikeler" />
        <Card>
          <EmptyState title="Bu ekranı görüntüleme yetkiniz yok">
            Turnikeleri yalnızca yönetici ve resepsiyon açabilir.
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const today = izmirToday();
  const [status, log, spa] = await Promise.all([
    apiRequest<GateStatus>("/api/v1/crm/gate/status"),
    apiRequest<GateCommandLogItem[]>("/api/v1/crm/gate/commands"),
    apiRequest<ReservationCalendar>(`/api/v1/crm/reservations/calendar?date=${today}&facilityType=SPA`),
  ]);
  if (status.kind === "unauthorized" || log.kind === "unauthorized") redirect("/login");

  if (status.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Turnikeler" />
        <Card>
          <EmptyState title="Turnike durumu yüklenemedi">{status.message}</EmptyState>
        </Card>
      </PageBody>
    );
  }

  // A spa calendar that fails to load costs the shortcut, not the page: the person search
  // still finds the guest.
  const spaBookings: GateSpaBooking[] =
    spa.kind === "ok"
      ? spa.data.facilities.flatMap((f) =>
          f.slots
            .filter((s) => s.reservation && ["PENDING", "CONFIRMED"].includes(s.reservation.status))
            .map((s) => ({
              reservationId: s.reservation!.id,
              userId: s.reservation!.userId,
              fullName: s.reservation!.fullName,
              facilityName: f.name,
              startTime: s.startTime,
              endTime: s.endTime,
            })),
        ).sort((a, b) => a.startTime.localeCompare(b.startTime))
      : [];

  return (
    <PageBody>
      <PageHeader
        title="Turnikeler"
        subtitle="Misafirler ve telefonu yanında olmayanlar için turnikeyi buradan açın"
      />
      <TurnstileDesk
        initialStatus={status.data}
        initialLog={log.kind === "ok" ? log.data : []}
        spaBookings={spaBookings}
      />
    </PageBody>
  );
}
