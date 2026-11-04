/** Pure helpers shared by the server and the optimistic UI, so both number things alike. */

export type Status = "idea" | "drafting" | "done";

export const moveItem = <T>(items: T[], from: number, to: number) => {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const sameMembers = (a: string[], b: string[]) => {
  const members = new Set(a);
  return a.length === b.length && new Set(b).size === b.length && b.every((id) => members.has(id));
};

/**
 * Hands the season's numbers out again in the new order, lowest first. The set
 * of numbers stays the same, so a gap stays where it was in the numbering.
 */
export function renumber<T extends { id: string; number: number }>(items: T[], ids: string[]) {
  const numbers = items.map(({ number }) => number).sort((a, b) => a - b);
  const byId = new Map(items.map((item) => [item.id, item]));
  // A row deleted while this reorder waited for its turn is simply skipped.
  return ids.filter((id) => byId.has(id)).map((id, index) => ({ ...byId.get(id)!, number: numbers[index] }));
}

/** The lowest number after those in use. */
export const nextNumber = (numbers: number[]) => Math.max(0, ...numbers) + 1;

export const firstUnfinished = <T extends { status: Status }>(episodes: T[]) =>
  episodes.find(({ status }) => status !== "done") ?? null;
