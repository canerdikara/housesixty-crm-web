import Link from "next/link";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState } from "@/components/ui";
import { canManageEvents } from "@/lib/roles";
import { readSession } from "@/lib/session";
import { EventForm } from "../EventForm";

export const metadata = { title: "Yeni etkinlik · House Sixty CRM" };
export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const session = await readSession();
  const header = (
    <PageHeader
      title="Yeni etkinlik"
      subtitle={<><Link href="/events">Etkinlikler</Link> › Yeni etkinlik</>}
    />
  );
  // Checked before the form is drawn, so reception is not invited to fill one in.
  if (!canManageEvents(session?.user.role)) {
    return (
      <PageBody>
        {header}
        <Card><EmptyState title="Etkinlik oluşturma yetkiniz yok" /></Card>
      </PageBody>
    );
  }
  return (
    <PageBody>
      {header}
      <Card><EventForm /></Card>
    </PageBody>
  );
}
