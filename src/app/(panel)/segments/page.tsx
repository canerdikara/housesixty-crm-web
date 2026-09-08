import { PageBody, PageHeader, Placeholder } from "@/components/Page";

export const metadata = { title: "Segmentler · House Sixty CRM" };

export default function Page() {
  return (
    <PageBody>
      <PageHeader title="Segmentler" subtitle="Kayıtlı segmentler ve segment oluşturucu" />
      <Placeholder phase="Aşama 3">Kriterlere göre canlı üye listesi üreten segmentler ve her kural değişikliğinde önizleme veren oluşturucu.</Placeholder>
    </PageBody>
  );
}
