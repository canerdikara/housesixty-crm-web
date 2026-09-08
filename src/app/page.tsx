import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { roleLabel, initialsOf } from "@/lib/roles";
import { logoutAction } from "./login/actions";

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
        <p style={{ color: "var(--text-muted)", margin: "0 0 24px" }}>
          Panel altyapısı hazır. Gösterge paneli ve diğer ekranlar sıradaki aşamada
          eklenecek.
        </p>

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
