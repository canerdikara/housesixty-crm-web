import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Giriş · House Sixty CRM",
};

/**
 * Never prerendered. The page reads `searchParams`, and more importantly a cached
 * login page is the kind of thing that gets served to the wrong person by an
 * intermediary.
 */
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.brand}>
          {/*
            alt="" and aria-hidden: the mark is decorative here because the wordmark
            right below it says "House Sixty" in real text. Giving both an accessible
            name would make a screen reader announce the brand twice.
          */}
          <Image
            className={styles.emblem}
            src="/emblem.png"
            alt=""
            aria-hidden="true"
            width={210}
            height={187}
            priority
          />
          <div className={styles.wordmark}>House Sixty</div>
          <span className={styles.subtitle}>CRM Paneli</span>
        </div>

        <LoginForm next={next ?? "/"} />

        <p className={styles.notice}>
          Bu panele erişim kayıt altına alınır. Üye verileri KVKK kapsamındadır ve
          yetkiniz dışındaki alanlar görüntülenemez.
        </p>
      </div>
    </main>
  );
}
