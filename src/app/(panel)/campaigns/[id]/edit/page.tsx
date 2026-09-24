import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { canWriteCampaigns } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { CampaignDetail, SegmentList } from "@/lib/types";
import { CampaignEditor } from "../../CampaignEditor";

export const metadata = { title: "Kampanyayı düzenle · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * Editing a draft or a scheduled campaign.
 *
 * Its own route rather than an inline editor on the detail screen, because the detail
 * screen is a *result* screen — it reads as the record of what was sent, and putting an
 * editable copy of the body on it would blur that. A sent campaign has no edit route at
 * all: the backend answers 409 and this screen says so before anybody types.
 */
export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [campaignResult, segmentsResult, session] = await Promise.all([
    apiRequest<CampaignDetail>(`/api/v1/crm/campaigns/${id}`),
    apiRequest<SegmentList>("/api/v1/crm/segments"),
    readSession(),
  ]);
  if (campaignResult.kind === "unauthorized") redirect("/login");
  if (campaignResult.kind === "error" && campaignResult.status === 404) notFound();

  const header = (title: string) => (
    <PageHeader
      title={title}
      subtitle={
        <>
          <Link href="/campaigns">Kampanyalar</Link>
          {campaignResult.kind === "ok" && (
            <>
              {" › "}
              <Link href={`/campaigns/${id}`}>{campaignResult.data.campaign.name}</Link>
            </>
          )}
          {" › Düzenle"}
        </>
      }
    />
  );

  if (campaignResult.kind !== "ok" || segmentsResult.kind !== "ok") {
    const message =
      campaignResult.kind !== "ok" ? campaignResult.message : (segmentsResult as { message: string }).message;
    return (
      <PageBody>
        {header("Kampanyayı düzenle")}
        <Card>
          <EmptyState title="Yüklenemedi">{message}</EmptyState>
        </Card>
      </PageBody>
    );
  }

  const detail = campaignResult.data;
  const editable = detail.campaign.status === "DRAFT" || detail.campaign.status === "SCHEDULED";

  if (!canWriteCampaigns(session?.user.role) || !editable) {
    return (
      <PageBody>
        {header("Kampanyayı düzenle")}
        <Card>
          <EmptyState
            title={editable ? "Düzenleme yetkiniz yok" : "Gönderilmiş kampanya düzenlenemez"}
          >
            {editable ? (
              "Kampanyaları yönetici ve pazarlama rolleri düzenler."
            ) : (
              <>
                Gönderilen içerik, kulübün ne gönderdiğinin kaydıdır ve değiştirilemez.{" "}
                <Link href={`/campaigns/${id}`}>Sonuç ekranına dönün</Link>.
              </>
            )}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  return (
    <PageBody>
      {header("Kampanyayı düzenle")}
      <Card>
        <CampaignEditor campaign={detail} segments={segmentsResult.data.segments} />
      </Card>
    </PageBody>
  );
}
