"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeHref, type NavItem } from "@/lib/nav";
import { initialsOf, roleLabel } from "@/lib/roles";
import { logoutAction } from "@/app/login/actions";
import styles from "./sidebar.module.css";

/**
 * The left navigation.
 *
 * A client component only because it needs `usePathname()` to mark the current page.
 * Everything it renders is computed on the server and handed down as props — the
 * filtered nav list and the user block — so no role logic and no session data crosses
 * into the bundle beyond the name and role already on screen.
 */
export function Sidebar({
  items,
  user,
}: {
  items: NavItem[];
  user: { fullName: string; role: string };
}) {
  const pathname = usePathname();
  const active = activeHref(pathname, items);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Image
          className={styles.logo}
          src="/logo-white.png"
          alt="House Sixty"
          width={210}
          height={217}
          priority
        />
        <span className={styles.brandSub}>CRM</span>
      </div>

      {/*
        A real <nav> with a label. There is only one landmark of this type today, but
        the label is what a screen reader's landmark list shows, and "navigation" on
        its own tells a user nothing once a second one appears.
      */}
      <nav className={styles.nav} aria-label="Ana menü">
        <ul className={styles.list}>
          {items.map((item) => {
            const isActive = item.href === active;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.link} ${isActive ? styles.active : ""}`}
                  // The accessible statement of "you are here". The bullet and the
                  // background are the visual half of the same fact.
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className={styles.dot} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.user}>
        <div className={styles.avatar} aria-hidden="true">
          {initialsOf(user.fullName)}
        </div>
        <div className={styles.userText}>
          <div className={styles.userName} title={user.fullName}>
            {user.fullName}
          </div>
          <div className={styles.userRole}>{roleLabel(user.role)}</div>
        </div>

        {/*
          A form posting to a server action, not a link. Signing out changes state, and
          a GET that logs you out is something a prefetcher or a link scanner can fire
          on your behalf.
        */}
        <form action={logoutAction}>
          <button type="submit" className={styles.logout} aria-label="Çıkış yap" title="Çıkış yap">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </form>
      </div>
    </aside>
  );
}
