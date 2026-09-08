import { PageBody, PageHeader, Placeholder } from "@/components/Page";

export const metadata = { title: "Üyeler · House Sixty CRM" };

export default function Page() {
  return (
    <PageBody>
      <PageHeader title="Üyeler" subtitle="Üye listesi ve 360 profili" />
      <Placeholder phase="Aşama 2">Üye listesi ve tek ekranda üye 360 görünümü — profil, üyelik geçmişi, tesis kullanımı, tercihler ve etkileşimler.</Placeholder>
    </PageBody>
  );
}
