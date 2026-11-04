export type Conflict = { status: "conflict" };
export type NotFound = { status: "not_found" };

export const conflict: Conflict = { status: "conflict" };
export const notFound: NotFound = { status: "not_found" };

export const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const retentionCutoff = (now = new Date()) => new Date(now.getTime() - RETENTION_DAYS * DAY_MS);

/** Whole days left before a deleted row is gone for good, never below one while listed. */
export const daysLeft = (deletedAt: Date, now: Date) =>
  Math.max(1, RETENTION_DAYS - Math.floor((now.getTime() - deletedAt.getTime()) / DAY_MS));
