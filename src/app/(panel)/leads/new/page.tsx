import { PageBody, PageHeader, Card } from "@/components/Page";
import { NewLeadForm } from "./NewLeadForm";

export const metadata = { title: "Yeni aday · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * Which revision of the consent text staff are reading to people at the desk.
 *
 * Must match `KVKK_TEXT_VERSION` in the website's `src/lib/crm.ts`, so a lead typed in
 * by reception and one submitted through the site record the same document. Nothing
 * enforces that — bump both together, and bump them whenever the consent copy changes.
 * A consent record naming the wrong revision is worth nothing in an audit.
 */
const CONSENT_TEXT_VERSION = "v1.0";

export default function NewLeadPage() {
  return (
    <PageBody>
      <PageHeader title="Yeni aday" subtitle="Resepsiyon ve ziyaret kayıtları için manuel giriş" />
      <div style={{ maxWidth: 720 }}>
        <Card>
          <NewLeadForm consentTextVersion={CONSENT_TEXT_VERSION} />
        </Card>
      </div>
    </PageBody>
  );
}
