import { PageBody, PageHeader, Placeholder } from "@/components/Page";

export const metadata = { title: "Depo ve Stok · House Sixty CRM" };

export default function Page() {
  return (
    <PageBody>
      <PageHeader title="Depo ve Stok" subtitle="Stok kalemleri ve hareketler" />
      <Placeholder phase="Ayrı kapsam">Depo modülü beş fazın dışında, ayrı olarak fiyatlandırıldı. Başlamadan önce POS entegrasyonu, tedarikçi kapsamı, sayım süreci ve maliyet takibi konularının netleşmesi gerekiyor.</Placeholder>
    </PageBody>
  );
}
