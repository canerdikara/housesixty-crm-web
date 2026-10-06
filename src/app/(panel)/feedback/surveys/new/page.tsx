import Link from "next/link";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState } from "@/components/ui";
import { canManageFeedback } from "@/lib/roles";
import { readSession } from "@/lib/session";
import { SurveyForm } from "../../SurveyForm";

export const metadata = { title: "Yeni anket · House Sixty CRM" };
export const dynamic = "force-dynamic";

export default async function NewSurveyPage() {
  const session = await readSession();
  const header = (
    <PageHeader title="Yeni anket" subtitle={<><Link href="/feedback">Geri Bildirim</Link> › Yeni anket</>} />
  );
  if (!canManageFeedback(session?.user.role)) {
    return (
      <PageBody>
        {header}
        <Card><EmptyState title="Anket oluşturma yetkiniz yok" /></Card>
      </PageBody>
    );
  }
  return (
    <PageBody>
      {header}
      <Card><SurveyForm /></Card>
    </PageBody>
  );
}
