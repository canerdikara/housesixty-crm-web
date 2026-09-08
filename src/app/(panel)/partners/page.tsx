import { PageBody, PageHeader, Placeholder } from "@/components/Page";

export const metadata = { title: "Partnerler · House Sixty CRM" };

export default function Page() {
  return (
    <PageBody>
      <PageHeader title="Partnerler" subtitle="Marka iş birlikleri ve aktivasyonlar" />
      <Placeholder phase="Aşama 4">Partner kartı, iletişim kişileri, aktivasyonlar ve iş birliği sonuçları.</Placeholder>
    </PageBody>
  );
}
