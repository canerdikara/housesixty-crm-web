import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { canManageFeedback } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { SurveyDetail } from "@/lib/types";
import { SurveyForm } from "../../../SurveyForm";

export const metadata = { title: "Anketi düzenle · House Sixty CRM" };
export const dynamic = "force-dynamic";

export default async function EditSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, result] = await Promise.all([readSession(), apiRequest<SurveyDetail>(`/api/v1/crm/surveys/${id}`)]);
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind === "error" && result.status === 404) notFound();

  const title = result.kind === "ok" ? result.data.title : "Anket";
  const header = (
    <PageHeader
      title="Anketi düzenle"
      subtitle={<><Link href="/feedback">Geri Bildirim</Link> › <Link href={`/feedback/surveys/${id}`}>{title}</Link> › Düzenle</>}
    />
  );
  if (!canManageFeedback(session?.user.role)) {
    return <PageBody>{header}<Card><EmptyState title="Anket düzenleme yetkiniz yok" /></Card></PageBody>;
  }
  if (result.kind !== "ok") {
    return <PageBody>{header}<Card><EmptyState title="Anket yüklenemedi">{result.message}</EmptyState></Card></PageBody>;
  }
  return (
    <PageBody>
      {header}
      <Card><SurveyForm survey={result.data} /></Card>
    </PageBody>
  );
}
