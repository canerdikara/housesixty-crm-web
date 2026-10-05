import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { canManageEvents } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { EventDetail } from "@/lib/types";
import { EventForm } from "../../EventForm";

export const metadata = { title: "Etkinliği düzenle · House Sixty CRM" };
export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, session] = await Promise.all([
    apiRequest<EventDetail>(`/api/v1/crm/events/${id}`),
    readSession(),
  ]);
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind === "error" && result.status === 404) notFound();

  const title = result.kind === "ok" ? result.data.title : "Etkinlik";
  const header = (
    <PageHeader
      title="Etkinliği düzenle"
      subtitle={<><Link href="/events">Etkinlikler</Link> › <Link href={`/events/${id}`}>{title}</Link> › Düzenle</>}
    />
  );
  if (result.kind !== "ok" || !canManageEvents(session?.user.role)) {
    return (
      <PageBody>
        {header}
        <Card>
          <EmptyState title={result.kind === "ok" ? "Etkinlik düzenleme yetkiniz yok" : "Etkinlik yüklenemedi"}>
            {result.kind === "ok" ? null : result.message}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }
  return (
    <PageBody>
      {header}
      <Card><EventForm event={result.data} /></Card>
    </PageBody>
  );
}
