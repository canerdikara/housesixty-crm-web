import { PageBody, PageHeader, Placeholder } from "@/components/Page";

export const metadata = { title: "Geri Bildirim · House Sixty CRM" };

export default function Page() {
  return (
    <PageBody>
      <PageHeader title="Geri Bildirim" subtitle="Memnuniyet anketleri ve üye talepleri" />
      <Placeholder phase="Aşama 4">Genel memnuniyet anketi, talep ve şikayet kaydı. Antrenör değerlendirmeleri ayrı bir modül olarak kalacak.</Placeholder>
    </PageBody>
  );
}
