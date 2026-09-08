import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { apiRequest } from "@/lib/api";
import { readSession } from "@/lib/session";

type Me = { id: string; email: string; fullName: string; role: string };

export const metadata = { title: "Genel Bakış · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * Dashboard — currently a connection check, not the real screen.
 *
 * Mockup screen 2 (four stat tiles, facility usage, lead sources, active members over
 * time, at-risk members) needs `GET /crm/dashboard`, which is phase 4 work. Until then
 * this makes one authenticated call so the panel proves it can actually reach the
 * backend rather than just holding cookies that look valid.
 */
export default async function DashboardPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const me = await apiRequest<Me>("/api/v1/users/me");
  // Refused despite middleware having just ensured a fresh token: revoked, or the
  // account is gone. Anything else is reported in place — an unreachable backend must
  // not look like being signed out.
  if (me.kind === "unauthorized") redirect("/login");

  const ok = me.kind === "ok";

  return (
    <PageBody>
      <PageHeader
        title="Genel Bakış"
        subtitle={`Hoş geldiniz, ${session.user.fullName.split(" ")[0]}`}
      />

      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "9px 12px",
            marginBottom: 18,
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            background: ok ? "var(--good-bg)" : "var(--crit-bg)",
            border: `1px solid ${ok ? "var(--good)" : "var(--crit)"}`,
            color: ok ? "var(--good)" : "var(--crit)",
          }}
        >
          {/* Status carried by a mark and a word, never by colour alone. */}
          <span aria-hidden="true">{ok ? "●" : "▲"}</span>
          <span>
            {me.kind === "ok"
              ? `Sunucu bağlantısı doğrulandı — ${me.data.email}`
              : me.kind === "forbidden"
                ? `Yetki hatası: ${me.message}`
                : `Sunucuya bağlanılamadı: ${me.message}`}
          </span>
        </div>

        <h2 style={{ fontSize: 17, marginBottom: 8 }}>Gösterge paneli hazırlanıyor</h2>
        <p style={{ color: "var(--text-muted)", margin: 0, maxWidth: "58ch", lineHeight: 1.6 }}>
          Aktif üye sayısı, yeni adaylar, dönüşüm oranı ve yenilemesi yaklaşan üyelikler
          bu ekranda toplanacak. Sol menüdeki bölümler sırayla açılacak; her birinin
          hangi aşamada geleceği kendi sayfasında belirtiliyor.
        </p>
      </Card>
    </PageBody>
  );
}
