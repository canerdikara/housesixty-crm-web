import type { TurnstileDirection } from "./types";

/**
 * The supplier's four QR readers (V60). The backend stores only the number; this names it.
 *
 * ⚠️ Placeholder numbering — the same as the backend's `GATE_READERS` default — until the
 * supplier confirms theirs. Change both together.
 */
export const READERS: { n: number; label: string; direction: TurnstileDirection }[] = [
  { n: 1, label: "Turnike 1 · giriş", direction: "ENTRY" },
  { n: 2, label: "Turnike 1 · çıkış", direction: "EXIT" },
  { n: 3, label: "Turnike 2 · giriş", direction: "ENTRY" },
  { n: 4, label: "Turnike 2 · çıkış", direction: "EXIT" },
];

export function readerLabel(n: number): string {
  return READERS.find((r) => r.n === n)?.label ?? `Okuyucu ${n}`;
}
