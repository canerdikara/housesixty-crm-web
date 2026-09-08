import { PageBody, PageHeader, Placeholder } from "@/components/Page";

export const metadata = { title: "Kampanyalar · House Sixty CRM" };

export default function Page() {
  return (
    <PageBody>
      <PageHeader title="Kampanyalar" subtitle="E-posta, WhatsApp ve SMS kampanyaları" />
      <Placeholder phase="Aşama 3">Segment seçimi, içerik hazırlama, gönderim ve sonuç ölçümü. E-posta mevcut Resend altyapısı üzerinden gidecek.</Placeholder>
    </PageBody>
  );
}
