import { score } from "@/lib/labels";
import type { SurveyQuestionStat } from "@/lib/types";
import styles from "./feedback.module.css";

/**
 * One bar per RATING question, out of 5 — the overview's «Memnuniyet anketi» card and the
 * survey's own screen. A question nobody has scored draws an empty track, never a full one.
 */
export function ScoreList({ stats }: { stats: SurveyQuestionStat[] }) {
  return (
    <ul className={styles.scores}>
      {stats.map((s) => (
        <li key={s.id}>
          <span className={styles.scoreName} title={s.label}>{s.label}</span>
          <span className={styles.track}>
            {s.average !== null && <span className={styles.fill} style={{ width: `${(s.average / 5) * 100}%` }} />}
          </span>
          <span className={styles.scoreValue}>
            {score(s.average)}
            <span className={styles.scoreCount}>{s.count} yanıt</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
