import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { EmptyState } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import type { SegmentDetail, SegmentField } from "@/lib/types";
import { SegmentActions } from "../SegmentActions";
import { SegmentBuilder } from "../SegmentBuilder";

export const metadata = { title: "Segment · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * An existing segment, in the same builder that created it.
 *
 * One screen rather than a read-only detail plus a separate edit form: a segment *is*
 * its rules, and the preview beside them is what makes a rule change comprehensible.
 * Splitting them would mean looking at the criteria on one screen and finding out what
 * they match on another.
 */
export default async function SegmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detailResult, fieldsResult] = await Promise.all([
    apiRequest<SegmentDetail>(`/api/v1/crm/segments/${id}`),
    apiRequest<SegmentField[]>("/api/v1/crm/segments/fields"),
  ]);
  if (detailResult.kind === "unauthorized") redirect("/login");

  if (detailResult.kind !== "ok" || fieldsResult.kind !== "ok") {
    // Narrowed to the failing one. Taking the union of both results would leave the
    // successful branch's `ok` shape in the type, which has no message to render.
    const failed = detailResult.kind !== "ok" ? detailResult : (fieldsResult as Exclude<typeof fieldsResult, { kind: "ok" }>);
    return (
      <PageBody>
        <PageHeader
          title="Segment"
          subtitle={<Link href="/segments">Segmentler</Link>}
        />
        <Card>
          <EmptyState
            title={
              failed.kind === "forbidden"
                ? "Bu ekranı görüntüleme yetkiniz yok"
                : "Segment yüklenemedi"
            }
          >
            {"message" in failed ? failed.message : ""}
          </EmptyState>
        </Card>
      </PageBody>
    );
  }

  const { segment, preview } = detailResult.data;

  return (
    <PageBody>
      <PageHeader
        title={segment.name}
        subtitle={
          <>
            <Link href="/segments">Segmentler</Link> › {segment.isDynamic ? "Dinamik" : "Statik"}
          </>
        }
        actions={<SegmentActions id={segment.id} isDynamic={segment.isDynamic} />}
      />
      <SegmentBuilder fields={fieldsResult.data} existing={segment} initialPreview={preview} />
    </PageBody>
  );
}
