import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import type { SegmentField, SegmentPreview } from "@/lib/types";
import { SegmentBuilder } from "../SegmentBuilder";

export const metadata = { title: "Yeni segment · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * «Segment Oluşturucu», empty — mockup screen 10.
 *
 * The field catalogue and the opening preview are fetched here rather than in the
 * builder, so the screen arrives with its first count already drawn instead of
 * rendering an empty panel and then filling it in.
 */
export default async function NewSegmentPage() {
  const [fieldsResult, previewResult] = await Promise.all([
    apiRequest<SegmentField[]>("/api/v1/crm/segments/fields"),
    apiRequest<SegmentPreview>("/api/v1/crm/segments/preview", {
      method: "POST",
      body: { rules: [] },
    }),
  ]);
  if (fieldsResult.kind === "unauthorized") redirect("/login");

  if (fieldsResult.kind !== "ok") {
    return (
      <PageBody>
        <PageHeader title="Segment Oluşturucu" subtitle="Segmentler › Yeni segment" />
        <Card>
          <EmptyState
            title={
              fieldsResult.kind === "forbidden"
                ? "Bu ekranı görüntüleme yetkiniz yok"
                : "Kriter listesi yüklenemedi"
            }
          >
            {fieldsResult.message}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader title="Segment Oluşturucu" subtitle="Segmentler › Yeni segment" />
      <SegmentBuilder
        fields={fieldsResult.data}
        initialPreview={previewResult.kind === "ok" ? previewResult.data : null}
      />
    </PageBody>
  );
}
