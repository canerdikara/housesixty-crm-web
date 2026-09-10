/**
 * The result of a server action, as a form can render it.
 *
 * Lives here rather than beside one screen's actions because every write in the panel
 * returns this shape and `components/Form.tsx` needs the type. It started in
 * `leads/actions.ts`, which meant the shared form primitives imported from a specific
 * screen — fine with one screen, wrong the moment there are two.
 *
 * Actions return this instead of throwing. A thrown error in a server action becomes a
 * generic error page and loses the message the backend took the trouble to write, and
 * those messages are the useful part here ("End date cannot be before the start date",
 * "A reason is required when marking a lead as lost").
 */
export type FormState = {
  error?: string;
  ok?: string;
};
