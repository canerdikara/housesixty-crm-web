/**
 * Shared between the booking form and the server action that receives it.
 *
 * Its own module rather than an export from `actions.ts`: that file is `"use server"`, and
 * every export from a server-action module must be an async function. A plain string
 * constant there type-checks and then fails the production build.
 */

/**
 * What a seat select carries when the desk marks it «Açık».
 *
 * Not a real user id and it must never collide with one — the backend takes `isOpen` as a
 * separate boolean, so the action translates this value rather than forwarding it.
 */
export const OPEN_SEAT = "__OPEN__";

/** Seats two to four. Seat one is the owner and is picked separately. */
export const GUEST_SEATS = [2, 3, 4] as const;
