import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { readSession } from "@/lib/session";
import { navFor } from "@/lib/nav";
import { canAccessPanel } from "@/lib/roles";
import styles from "@/components/sidebar.module.css";

/**
 * The panel shell: sidebar plus page area.
 *
 * Everything inside `(panel)` is signed-in. `/login` sits outside the group, which is
 * why it renders full-bleed without a sidebar rather than needing to opt out of one.
 *
 * The nav list is filtered **here**, on the server, and the result handed to the
 * client component as a prop. Doing the role filtering inside `Sidebar` would ship the
 * whole permission table to the browser — not a leak of anything secret, but it would
 * put a copy of the matrix somewhere it can drift out of step with §6.
 */
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();

  // Middleware already turns anonymous visitors away, but it only checks that the
  // cookies exist. This catches the rest: a session whose user cookie will not parse,
  // and — the case that matters — a role that lost panel access after signing in.
  // Without it a demoted account keeps a working shell until its cookie expires.
  if (!session || !canAccessPanel(session.user.role)) redirect("/login");

  const items = navFor(session.user.role, process.env.CRM_FEATURE_WAREHOUSE === "true");

  return (
    <>
      <Sidebar items={items} user={session.user} />
      <div className={styles.main}>{children}</div>
    </>
  );
}
