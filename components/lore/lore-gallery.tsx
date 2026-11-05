"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ActionMenu, MenuItem } from "@/components/structure/action-menu";
import { FormDialog, TextField, type Submit } from "@/components/structure/form-dialog";
import { useModal } from "@/components/ui/use-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { plural } from "@/lib/format";
import { LORE_CATEGORIES, loreCategory } from "@/lib/lore/categories";
import { bringBackEntry, createLoreEntry, fetchDeletedEntries, type DeletedEntry } from "@/lib/lore/client";
import type { LoreCardData } from "@/lib/lore/read";
import { daysLeft } from "@/lib/structure/result";
import { LoreCover } from "./lore-cover";

export type GalleryCard = LoreCardData & { coverUrl: string | null };

function Card({ entry, index }: { entry: GalleryCard; index: number }) {
  return (
    <li className="rise" style={{ "--i": Math.min(index, 12) } as CSSProperties}>
      <Link href={`/lore/${entry.slug}`} className="glass glass-link lore-card">
        <LoreCover category={entry.category} url={entry.coverUrl} className="lore-card-cover" />
        <span className="lore-card-body">
          <span className="block truncate font-heading text-lg font-semibold">{entry.title}</span>
          <span className="lore-card-summary">{entry.summary || "No summary yet"}</span>
          {entry.editor && <span className="block text-xs text-muted">Edited by {entry.editor}</span>}
        </span>
      </Link>
    </li>
  );
}

function NewEntryDialog({ title, onClose }: { title: string; onClose: () => void }) {
  const router = useRouter();

  const submit: Submit = async (data) => {
    try {
      const { slug } = await createLoreEntry(String(data.get("title")), String(data.get("category")));
      router.push(`/lore/${slug}/edit`);
      return null;
    } catch (problem) {
      return problem instanceof Error ? problem.message : "Could not create the entry";
    }
  };

  return (
    <FormDialog title="New lore entry" submitLabel="Create entry" busyLabel="Creating…" onSubmit={submit} onClose={onClose}>
      <TextField label="Title" name="title" required autoFocus defaultValue={title} />
      <label className="block">
        <span className="eyebrow text-muted">Category</span>
        <select name="category" defaultValue="World" className="field w-full">
          {LORE_CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </label>
    </FormDialog>
  );
}

function DeletedDialog({ onClose, onRestored }: { onClose: () => void; onRestored: () => void }) {
  const dialog = useModal();
  const [entries, setEntries] = useState<DeletedEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    void fetchDeletedEntries().then(setEntries);
  }, []);

  const restore = async ({ id, version }: DeletedEntry) => {
    setError(null);
    try {
      await bringBackEntry(id, version);
      setEntries((list) => list?.filter((entry) => entry.id !== id) ?? null);
      onRestored();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not restore");
    }
  };

  return (
    <dialog ref={dialog} aria-labelledby="lore-deleted-title" className="editor-dialog" onClose={onClose}>
      <h2 id="lore-deleted-title" className="text-xl font-semibold">
        Recently deleted
      </h2>
      <p className="mt-1 text-sm text-muted">Entries stay here for 30 days.</p>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-status-idea">
          {error}
        </p>
      )}

      <div aria-live="polite" className="deleted-list mt-3">
        {entries === null && <p className="text-sm text-muted">Loading…</p>}
        {entries?.length === 0 && <p className="text-sm text-muted">Nothing here.</p>}
        <ul>
          {entries?.map((entry) => (
            <li key={entry.id} className="deleted-row">
              <span className="min-w-0">
                <span className="block truncate font-medium">{entry.title}</span>
                <span className="block text-xs text-muted">
                  {[entry.deletedBy && `Deleted by ${entry.deletedBy}`, `${plural(daysLeft(new Date(entry.deletedAt), now), "day")} left`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <button type="button" className="btn-ghost shrink-0 text-sm" aria-label={`Restore ${entry.title}`} onClick={() => restore(entry)}>
                Restore
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <button type="button" className="btn-ghost text-sm" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}

const matches = (entry: GalleryCard, query: string) =>
  [entry.title, entry.summary, entry.category, ...entry.tags].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase());

export function LoreGallery({ entries }: { entries: GalleryCard[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"new" | "deleted" | null>(params.has("new") ? "new" : null);

  const tags = useMemo(() => [...new Set(entries.flatMap((entry) => entry.tags))].sort(), [entries]);
  const visible = entries.filter((entry) => matches(entry, query) && (!tag || entry.tags.includes(tag)));

  return (
    <>
      <div className="lore-tools">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Filter lore</span>
          <input type="search" value={query} placeholder="Filter by title, summary or tag" className="field" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button type="button" className="btn-primary text-sm" onClick={() => setDialog("new")}>
          New entry
        </button>
        <ActionMenu label="Lore menu" text="Lore menu">
          <MenuItem onSelect={() => setDialog("deleted")}>Recently deleted</MenuItem>
        </ActionMenu>
      </div>

      {tags.length > 0 && (
        <div className="search-chips mt-3" role="group" aria-label="Filter by tag">
          {tags.map((name) => (
            <button key={name} type="button" className="char-chip char-chip-quiet" aria-pressed={tag === name} onClick={() => setTag(tag === name ? null : name)}>
              {name}
            </button>
          ))}
        </div>
      )}

      <p role="status" className="mt-4 text-sm text-muted">
        {plural(visible.length, "entry").replace("entrys", "entries")}
      </p>

      {visible.length === 0 ? (
        <EmptyState title={entries.length ? "Nothing matches" : "No lore yet"}>
          {entries.length ? "Try a different filter." : "Create the first entry."}
        </EmptyState>
      ) : (
        LORE_CATEGORIES.map((category) => {
          const group = visible.filter((entry) => loreCategory(entry.category) === category);
          return group.length > 0 ? (
            <section key={category} aria-labelledby={`lore-${category}`} className="mt-8">
              <h2 id={`lore-${category}`} className="text-2xl font-semibold">
                {category}
              </h2>
              <ul className="lore-grid mt-3">
                {group.map((entry, index) => (
                  <Card key={entry.id} entry={entry} index={index} />
                ))}
              </ul>
            </section>
          ) : null;
        })
      )}

      {dialog === "new" && <NewEntryDialog title="" onClose={() => setDialog(null)} />}
      {dialog === "deleted" && <DeletedDialog onClose={() => setDialog(null)} onRestored={() => router.refresh()} />}
    </>
  );
}
