import { PageBody, PageHeader, Placeholder } from "@/components/Page";

export const metadata = { title: "Yenilemeler · House Sixty CRM" };

export default function Page() {
  return (
    <PageBody>
      <PageHeader title="Yenilemeler" subtitle="Üyelik bitişi yaklaşan üyeler" />
      <Placeholder phase="Aşama 3">Bitişe 30 gün kalan üyelikler, yenileme görüşmeleri ve yenileme oranı raporu.</Placeholder>
    </PageBody>
  );
}
