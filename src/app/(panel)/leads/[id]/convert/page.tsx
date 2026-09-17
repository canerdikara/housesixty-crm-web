import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { ui } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { readSession } from "@/lib/session";
import type { LeadDetail, MembershipTier } from "@/lib/types";
import { ConvertForm } from "./ConvertForm";

/**
 * «Üyeye Dönüştür» — the desk form.
 *
 * Its own page rather than a disclosure on the lead screen, because this is the one
 * moment in the pipeline where an admin sits with the person in front of them and works
 * through a list: emergency contact, payment, identity document, car, contract. That
 * does not belong in a box below a timeline.
 */
export default async function ConvertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await readSession();
  if (!session) redirect("/login");

  const lead = await apiRequest<LeadDetail>(`/api/v1/crm/leads/${id}`);
  if (lead.kind === "unauthorized") redirect("/login");
  if (lead.kind !== "ok") notFound();

  // Already converted: there is nothing to do here, and the form would create a second
  // membership on an account that has one.
  if (lead.data.convertedUserId) {
    redirect(`/members/${lead.data.convertedUserId}`);
  }

  /*
   * Only an ADMIN may record onboarding details or assign a membership — the backend
   * refuses the blocks outright for anyone else (LeadController). The form therefore
   * shows a salesperson the plain conversion rather than fields whose save would 403.
   */
  const isAdmin = session.user.role === "ADMIN";

  /*
   * Tiers come from the admin endpoint, which is ADMIN-only — so this is not fetched
   * at all for anyone else, and a failure is not fatal: the form degrades to a
   * conversion without a membership rather than refusing to render.
   */
  let tiers: MembershipTier[] = [];
  if (isAdmin) {
    const res = await apiRequest<MembershipTier[]>("/api/v1/admin/membership-tiers");
    if (res.kind === "ok") tiers = res.data;
  }

  return (
    <PageBody>
      <PageHeader
        title="Üyeye Dönüştür"
        subtitle={
          <>
            <Link href="/leads">Adaylar</Link> ›{" "}
            <Link href={`/leads/${id}`}>{lead.data.fullName}</Link> › Dönüştür
          </>
        }
        actions={
          <Link className={`${ui.button} ${ui.buttonGhost}`} href={`/leads/${id}`}>
            Vazgeç
          </Link>
        }
      />
      <Card>
        <ConvertForm lead={lead.data} tiers={tiers} isAdmin={isAdmin} />
      </Card>
    </PageBody>
  );
}
