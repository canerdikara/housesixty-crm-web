import { PageBody, PageHeader, Placeholder } from "@/components/Page";

export const metadata = { title: "Ayarlar · House Sixty CRM" };

export default function Page() {
  return (
    <PageBody>
      <PageHeader title="Ayarlar" subtitle="Panel kullanıcıları, yetkiler ve KVKK kayıtları" />
      <Placeholder phase="Aşama 1">Panel kullanıcıları ve rolleri, rol yetki matrisi ve değiştirilemez KVKK rıza kayıtları.</Placeholder>
    </PageBody>
  );
}
