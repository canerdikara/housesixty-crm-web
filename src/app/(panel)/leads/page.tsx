import { PageBody, PageHeader, Placeholder } from "@/components/Page";

export const metadata = { title: "Adaylar · House Sixty CRM" };

export default function Page() {
  return (
    <PageBody>
      <PageHeader title="Adaylar" subtitle="Aday listesi ve satış hunisi" />
      <Placeholder phase="Aşama 1">Aday listesi, satış hunisi ve aday detayı bu aşamada gelecek. Web sitesi formundan gelen adaylar şu anda arka planda kaydediliyor.</Placeholder>
    </PageBody>
  );
}
