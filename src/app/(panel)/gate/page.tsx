import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { izmirToday } from "@/lib/dates";
import { canControlGate } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { DeskVisit, GateSilence } from "@/lib/types";
import { DeskLog } from "./DeskLog";
import { SilenceWarning } from "./SilenceWarning";

export const metadata = { title: "Turnikeler · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * «Turnikeler» — the desk's hand-written turnstile log (V61, Can 2026-10-28).
 *
 * The supplier's turnstile is opened at the desk with a physical button; the CRM opens
 * nothing. The desk records here who it let through and when: members without their phone
 * (whose entry and exit then count in the reports like a scan) and guests by name.
 *
 * ADMIN and RECEPTION.
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
            Turnike kayıtlarını yalnızca yönetici ve resepsiyon görebilir.
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const today = izmirToday();
  const [open, day, silence] = await Promise.all([
    apiRequest<DeskVisit[]>("/api/v1/crm/gate/visits/open"),
    apiRequest<DeskVisit[]>(`/api/v1/crm/gate/visits?date=${today}`),
    apiRequest<GateSilence>("/api/v1/crm/gate/silence"),
  ]);
  if (open.kind === "unauthorized" || day.kind === "unauthorized") redirect("/login");

  if (open.kind !== "ok" || day.kind !== "ok") {
    const message = open.kind !== "ok" && "message" in open ? open.message : day.kind !== "ok" && "message" in day ? day.message : "";
    return (
      <PageBody>
        <PageHeader title="Turnikeler" />
        <Card>
          <EmptyState title="Turnike kayıtları yüklenemedi">{message}</EmptyState>
        </Card>
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader title="Turnikeler" subtitle="Resepsiyondan elle geçirilenlerin giriş ve çıkış kayıtları" />
      <SilenceWarning initial={silence.kind === "ok" ? silence.data : null} />
      <DeskLog initialOpen={open.data} initialDay={day.data} initialDate={today} />
    </PageBody>
  );
}
