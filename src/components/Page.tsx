import styles from "./page.module.css";

/**
 * The shared frame for a panel screen.
 *
 * Server components — no state, no handlers — so they add nothing to the client
 * bundle. Every one of the eighteen mockups has this same title / subtitle / actions
 * header, and building it once is what keeps them aligned.
 */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        {/*
          One <h1> per screen, and this is it. The panel's heading order has to stay
          navigable: cards below use <h2>, never a size-picked tag.
        */}
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className={styles.page}>{children}</div>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <section className={styles.card}>{children}</section>;
}

/**
 * A screen that is designed but not yet built.
 *
 * Names the phase it belongs to on purpose. Someone clicking around the panel should
 * be able to tell "not written yet" from "written and broken" without asking, and
 * "yakında" tells them neither.
 */
export function Placeholder({ phase, children }: { phase: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className={styles.placeholder}>
        <span className={styles.placeholderPhase}>{phase}</span>
        <p className={styles.placeholderText}>{children}</p>
      </div>
    </Card>
  );
}
