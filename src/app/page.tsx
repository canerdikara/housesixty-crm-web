import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { roleLabel, initialsOf } from "@/lib/roles";
import { apiRequest } from "@/lib/api";
import { logoutAction } from "./login/actions";

type Me = { id: string; email: string; fullName: string; role: string };

/**
 * Placeholder landing.
 *
 * The real Genel Bakış dashboard (mockup screen 2) is phase 1 work and needs
 * `GET /crm/dashboard`, which does not exist yet. This page exists so the login flow
 * has a verified destination — it proves the session round-trips and that the role
 * came through — and it will be replaced wholesale by the panel shell.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await readSession();

  // The middleware already bounces anonymous visitors, but it only checks that the
  // cookies exist. A session whose user cookie would not parse reaches here as null,
  // and rendering a "signed in as undefined" shell would be worse than a redirect.
  if (!session) redirect("/login");

  const { user } = session;

  /*
   * A live call to the backend, not just a cookie read.
   *
   * The session cookies alone prove nothing about the backend — they would still
   * render this page happily if the API were down or the token had been revoked. This
   * exercises the real path every future screen will use, which also means it is what
   * drives the refresh-and-replay branch in apiRequest: when the fifteen-minute access
   * token expires, this call 401s, the refresh happens, and the request is replayed
   * before the page ever renders.
   *
   * `unauthorized` here means the refresh itself failed, so the session is genuinely
   * dead and the only correct move is the login page. Anything else is reported inline
   * rather than redirecting — a backend that is merely unreachable must not look like
   * being signed out.
   */
  const me = await apiRequest<Me>("/api/v1/users/me");
  if (me.kind === "unauthorized") redirect("/login");

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh", padding: 24 }}>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 32,
          maxWidth: 460,
          width: "100%",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "var(--accent-ink)",
              display: "grid",
              placeItems: "center",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {initialsOf(user.fullName)}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{user.fullName}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {roleLabel(user.role)}
            </div>
          </div>
        </div>

        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Genel Bakış</h1>
        <p style={{ color: "var(--text-muted)", margin: "0 0 20px" }}>
          Panel altyapısı hazır. Gösterge paneli ve diğer ekranlar sıradaki aşamada
          eklenecek.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 24,
            padding: "9px 12px",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            background: me.kind === "ok" ? "var(--good-bg)" : "var(--crit-bg)",
            border: `1px solid ${me.kind === "ok" ? "var(--good)" : "var(--crit)"}`,
            color: me.kind === "ok" ? "var(--good)" : "var(--crit)",
          }}
        >
          {/* Status carried by an icon and a word, never by colour alone. */}
          <span aria-hidden="true">{me.kind === "ok" ? "●" : "▲"}</span>
          <span>
            {me.kind === "ok"
              ? `Sunucu bağlantısı doğrulandı — ${me.data.email}`
              : me.kind === "forbidden"
                ? `Yetki hatası: ${me.message}`
                : `Sunucuya bağlanılamadı: ${me.message}`}
          </span>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            style={{
              padding: "9px 16px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            Çıkış yap
          </button>
        </form>
      </div>
    </main>
  );
}
