/**
 * The optimistic list behind the season and episode pages. A plain object
 * outside React, like the editor's store: a request outlives a hidden route.
 *
 * What the server has confirmed is kept apart from what is still in flight, and
 * the screen shows the two combined, so a refused change simply drops out
 * without disturbing others. Requests run one at a time, each with the version
 * the one before it returned.
 */

export type Outcome<T> =
  | { kind: "ok"; data: T }
  | { kind: "conflict" }
  | { kind: "signed_out" }
  | { kind: "failed"; message: string };

export type Snapshot<T> = { items: T[]; version: number };

type Context<T> = { version: number; item: (id: string) => T | undefined };

type Run<T, R> = {
  /** Shown straight away, and undone if the server refuses. */
  change?: (items: T[]) => T[];
  request: (context: Context<T>) => Promise<Outcome<R>>;
  /** Folds what the server returned into the list, such as a new version. */
  settle?: (items: T[], data: R) => T[];
  /** The list's new version, when this changed it. */
  versionOf?: (data: R) => number;
};

const same = <T>(items: T[]) => items;

export function createBoard<T extends { id: string }>(initial: Snapshot<T>) {
  let confirmed = initial.items;
  let version = initial.version;
  let pending: { change: (items: T[]) => T[] }[] = [];
  let visible = confirmed;
  let tail: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();

  const publish = () => {
    visible = pending.reduce((items, { change }) => change(items), confirmed);
    listeners.forEach((listener) => listener());
  };

  return {
    getItems: () => visible,
    getVersion: () => version,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    /** Takes in a fresh page, unless it is older than the list or work is in flight. */
    adopt(server: Snapshot<T>) {
      if (pending.length > 0 || server.version < version) return;
      confirmed = server.items;
      version = server.version;
      publish();
    },

    run<R>({ change = same, request, settle, versionOf }: Run<T, R>): Promise<Outcome<R>> {
      const entry = { change };
      pending = [...pending, entry];
      publish();

      const finished = tail.then(async () => {
        const context = { version, item: (id: string) => confirmed.find((item) => item.id === id) };
        const outcome = await request(context).catch(
          (): Outcome<R> => ({ kind: "failed", message: "Could not reach the server" }),
        );

        pending = pending.filter((item) => item !== entry);
        if (outcome.kind === "ok") {
          const applied = change(confirmed);
          confirmed = settle ? settle(applied, outcome.data) : applied;
          version = versionOf?.(outcome.data) ?? version;
        }
        publish();
        return outcome;
      });

      tail = finished;
      return finished;
    },
  };
}
