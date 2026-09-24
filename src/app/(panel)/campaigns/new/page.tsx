import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { canWriteCampaigns } from "@/lib/roles";
import { readSession } from "@/lib/session";
import type { SegmentList } from "@/lib/types";
import { CampaignEditor } from "../CampaignEditor";

export const metadata = { title: "Yeni kampanya · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * A new campaign, always as a draft.
 *
 * The segment list is fetched here rather than in the editor so the select arrives
 * populated instead of the screen rendering an empty dropdown and then filling it.
 */
export default async function NewCampaignPage() {
  const [segmentsResult, session] = await Promise.all([
    apiRequest<SegmentList>("/api/v1/crm/segments"),
    readSession(),
  ]);
  if (segmentsResult.kind === "unauthorized") redirect("/login");

  const header = (
    <PageHeader
      title="Yeni kampanya"
      subtitle={
        <>
          <Link href="/campaigns">Kampanyalar</Link> › Yeni kampanya
        </>
      }
    />
  );

  // Checked before the form is drawn rather than after it is submitted. The backend
  // answers 403 either way; a SALES user filling in a campaign and being refused on save
  // would be the panel's fault, not theirs.
  if (!canWriteCampaigns(session?.user.role)) {
    return (
      <PageBody>
        {header}
        <Card>
          <EmptyState title="Kampanya oluşturma yetkiniz yok">
            Kampanyaları yönetici ve pazarlama rolleri oluşturur. Mevcut kampanyaları
            görüntüleyebilirsiniz.
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  if (segmentsResult.kind !== "ok") {
    return (
      <PageBody>
        {header}
        <Card>
          <EmptyState title="Segment listesi yüklenemedi">{segmentsResult.message}</EmptyState>
        </Card>
      </PageBody>
    );
  }

  const segments = segmentsResult.data.segments;

  return (
    <PageBody>
      {header}
      <Card>
        {segments.length === 0 ? (
          // A campaign with no audience cannot be sent, and the backend says so at send
          // time. Saying it here instead is the difference between an empty dropdown and
          // an explanation.
          <EmptyState title="Önce bir segment tanımlayın">
            Bir kampanya bir segmente gider. <Link href="/segments/new">Segment oluşturun</Link>,
            sonra buraya dönün.
          </EmptyState>
        ) : (
          <CampaignEditor campaign={null} segments={segments} />
        )}
      </Card>
    </PageBody>
  );
}
