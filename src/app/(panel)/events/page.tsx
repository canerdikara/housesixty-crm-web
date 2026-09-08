import { PageBody, PageHeader, Placeholder } from "@/components/Page";

export const metadata = { title: "Etkinlikler · House Sixty CRM" };

export default function Page() {
  return (
    <PageBody>
      <PageHeader title="Etkinlikler" subtitle="Topluluk etkinlikleri ve katılım" />
      <Placeholder phase="Aşama 4">Community Talks ve benzeri spor dışı etkinlikler için davet, yanıt takibi ve katılım kaydı.</Placeholder>
    </PageBody>
  );
}
