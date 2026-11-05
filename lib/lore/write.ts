import { and, asc, desc, eq, gte, isNotNull, isNull, lt, ne } from "drizzle-orm";
import { slugify, uniqueSlug } from "@/lib/characters/slug";
import { loreEntries, loreRevisions, series, users, type LoreDraft } from "@/lib/db/schema";
import { REVISION_WINDOW_MS, type Database, type Transaction } from "@/lib/scenes/save-scene";
import { linkKey } from "./links";
import { retentionCutoff } from "@/lib/structure/result";
import { PLACEHOLDER_BODY, type LoreCategory } from "./categories";

export type LoreSaveResult =
  | { status: "saved"; version: number }
  | { status: "conflict"; version: number }
  | { status: "title_taken"; title: string }
  | { status: "not_found" };

const draftOf = ({ title, category, summary, body, coverKey, tags, aliases }: LoreDraft): LoreDraft => ({
  title,
  category,
  summary,
  body,
  coverKey,
  tags,
  aliases,
});

const sameDraft = (a: LoreDraft, b: LoreDraft) => JSON.stringify(draftOf(a)) === JSON.stringify(draftOf(b));

async function isTitleTaken(tx: Transaction, seriesId: string, title: string, exceptId?: string) {
  const rows = await tx
    .select({ title: loreEntries.title })
    .from(loreEntries)
    .where(
      and(
        eq(loreEntries.seriesId, seriesId),
        isNull(loreEntries.deletedAt),
        exceptId ? ne(loreEntries.id, exceptId) : undefined,
      ),
    );
  return rows.some((row) => linkKey(row.title) === linkKey(title));
}

export async function createEntry(
  db: Database,
  input: { title: string; category: LoreCategory; userId: string | null; body?: string },
) {
  const { title, category, userId, body = PLACEHOLDER_BODY } = input;

  return db.transaction(async (tx) => {
    const [owner] = await tx.select({ id: series.id }).from(series).orderBy(asc(series.title)).limit(1);
    if (!owner) return { status: "no_series" as const };
    if (await isTitleTaken(tx, owner.id, title)) return { status: "title_taken" as const, title };

    const taken = await tx.select({ slug: loreEntries.slug }).from(loreEntries);
    const slug = uniqueSlug(slugify(title) || "entry", taken.map((row) => row.slug));

    const [created] = await tx
      .insert(loreEntries)
      .values({ seriesId: owner.id, title, slug, category, body, createdBy: userId, updatedBy: userId })
      .returning({ id: loreEntries.id, slug: loreEntries.slug });

    return { status: "created" as const, ...created };
  });
}

async function lockEntry(tx: Transaction, id: string) {
  const [entry] = await tx
    .select()
    .from(loreEntries)
    .where(and(eq(loreEntries.id, id), isNull(loreEntries.deletedAt)))
    .for("update");
  return entry ?? null;
}

type LockedEntry = NonNullable<Awaited<ReturnType<typeof lockEntry>>>;

/** The same rule as scenes: one person's edits within the window share a row. */
async function keepRevision(tx: Transaction, current: LockedEntry, seal: boolean) {
  const content = draftOf(current);
  const { id, updatedBy, updatedAt } = current;

  const [latest] = await tx
    .select()
    .from(loreRevisions)
    .where(eq(loreRevisions.loreId, id))
    .orderBy(desc(loreRevisions.savedAt), desc(loreRevisions.id))
    .limit(1);

  const canMerge =
    !seal &&
    latest &&
    !latest.sealed &&
    updatedBy !== null &&
    latest.savedBy === updatedBy &&
    updatedAt.getTime() - latest.savedAt.getTime() < REVISION_WINDOW_MS;

  if (canMerge) {
    await tx.update(loreRevisions).set({ content }).where(eq(loreRevisions.id, latest.id));
  } else {
    await tx.insert(loreRevisions).values({ loreId: id, content, sealed: seal, savedBy: updatedBy, savedAt: updatedAt });
  }
}

async function writeVersion(tx: Transaction, current: LockedEntry, draft: LoreDraft, userId: string, seal = false) {
  await keepRevision(tx, current, seal);

  const version = current.version + 1;
  await tx
    .update(loreEntries)
    .set({ ...draftOf(draft), version, updatedBy: userId, updatedAt: new Date() })
    .where(eq(loreEntries.id, current.id));
  return version;
}

export async function saveEntry(
  db: Database,
  input: { id: string; version: number; userId: string; draft: LoreDraft },
): Promise<LoreSaveResult> {
  const { id, version, userId, draft } = input;

  return db.transaction(async (tx) => {
    const current = await lockEntry(tx, id);
    if (!current) return { status: "not_found" };

    if (current.version !== version) {
      // A retry after a lost response: this save already landed.
      const isOwnRetry = current.updatedBy === userId && sameDraft(current, draft);
      return { status: isOwnRetry ? "saved" : "conflict", version: current.version };
    }

    if (await isTitleTaken(tx, current.seriesId, draft.title, id)) return { status: "title_taken", title: draft.title };
    if (sameDraft(current, draft)) return { status: "saved", version };

    return { status: "saved", version: await writeVersion(tx, current, draft, userId) };
  });
}

/** Saves an old version as a new one, so what it replaces goes into history first. */
export async function restoreLoreRevision(
  db: Database,
  input: { id: string; revisionId: string; version: number; userId: string },
) {
  const { id, revisionId, version, userId } = input;

  return db.transaction(async (tx) => {
    const current = await lockEntry(tx, id);
    if (!current) return { status: "not_found" as const };
    if (current.version !== version) return { status: "conflict" as const, version: current.version };

    const [revision] = await tx
      .select({ content: loreRevisions.content })
      .from(loreRevisions)
      .where(and(eq(loreRevisions.id, revisionId), eq(loreRevisions.loreId, id)));
    if (!revision) return { status: "not_found" as const };

    const saved = await writeVersion(tx, current, revision.content, userId, true);
    return { status: "saved" as const, version: saved, draft: revision.content };
  });
}

/** Keeps the version, like scenes: nothing about the entry itself has changed. */
export async function deleteEntry(db: Database, { id, version, userId }: { id: string; version: number; userId: string }) {
  return db.transaction(async (tx) => {
    const current = await lockEntry(tx, id);
    if (!current) return { status: "not_found" as const };
    if (current.version !== version) return { status: "conflict" as const, version: current.version };

    await tx.update(loreEntries).set({ deletedAt: new Date(), deletedBy: userId }).where(eq(loreEntries.id, id));
    // Runs with each delete, so nothing needs a scheduled job.
    await tx.delete(loreEntries).where(lt(loreEntries.deletedAt, retentionCutoff()));
    return { status: "ok" as const };
  });
}

export async function restoreEntry(db: Database, { id, version }: { id: string; version: number }) {
  return db.transaction(async (tx) => {
    const [entry] = await tx.select().from(loreEntries).where(eq(loreEntries.id, id)).for("update");
    if (!entry) return { status: "not_found" as const };
    if (!entry.deletedAt || entry.version !== version) return { status: "conflict" as const, version: entry.version };
    if (entry.deletedAt < retentionCutoff()) return { status: "not_found" as const };
    if (await isTitleTaken(tx, entry.seriesId, entry.title)) return { status: "title_taken" as const, title: entry.title };

    await tx.update(loreEntries).set({ deletedAt: null, deletedBy: null }).where(eq(loreEntries.id, id));
    return { status: "ok" as const, slug: entry.slug };
  });
}

export async function listDeletedEntries(db: Database, now = new Date()) {
  return db
    .select({
      id: loreEntries.id,
      title: loreEntries.title,
      version: loreEntries.version,
      deletedAt: loreEntries.deletedAt,
      deletedBy: users.name,
    })
    .from(loreEntries)
    .leftJoin(users, eq(loreEntries.deletedBy, users.id))
    .where(and(isNotNull(loreEntries.deletedAt), gte(loreEntries.deletedAt, retentionCutoff(now))))
    .orderBy(desc(loreEntries.deletedAt));
}

const HISTORY_LIMIT = 50;

export async function listLoreRevisions(db: Database, id: string) {
  return db
    .select({
      id: loreRevisions.id,
      content: loreRevisions.content,
      sealed: loreRevisions.sealed,
      savedAt: loreRevisions.savedAt,
      savedBy: users.name,
    })
    .from(loreRevisions)
    .leftJoin(users, eq(loreRevisions.savedBy, users.id))
    .where(eq(loreRevisions.loreId, id))
    .orderBy(desc(loreRevisions.savedAt), desc(loreRevisions.id))
    .limit(HISTORY_LIMIT);
}

