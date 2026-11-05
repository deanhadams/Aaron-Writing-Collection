"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { SaveIndicator, useSaveStatus } from "@/components/editor/save-indicator";
import { useLeaveGuard } from "@/components/editor/use-leave-guard";
import { DeleteDialog } from "@/components/structure/episode-dialogs";
import { characterStyle } from "@/components/characters/character-card";
import { ACCEPTED_TYPES } from "@/lib/characters/upload";
import type { LoreDraft } from "@/lib/db/schema";
import { createSaveQueue, type SaveQueue } from "@/lib/editor/save-queue";
import { LORE_CATEGORIES } from "@/lib/lore/categories";
import { fetchEntry, removeEntry, sendEntry, uploadLoreImage } from "@/lib/lore/client";
import { applyFormat, completeLink, insertImage, parseList, type Edit, type Format } from "@/lib/lore/format";
import { buildLinkLookup, linkKey, openLinkAt } from "@/lib/lore/links";
import { LoreConflict, LoreHistory } from "./lore-history";
import { LoreMarkdown } from "./lore-markdown";

type Targets = Parameters<typeof buildLinkLookup>[0];

const MENU_SIZE = 8;

const TOOLBAR: { format: Format; label: string; text: string }[] = [
  { format: "h2", label: "Heading", text: "H2" },
  { format: "h3", label: "Subheading", text: "H3" },
  { format: "bold", label: "Bold", text: "B" },
  { format: "italic", label: "Italic", text: "I" },
  { format: "list", label: "List", text: "• List" },
  { format: "quote", label: "Quote", text: "“ ”" },
  { format: "table", label: "Table", text: "Table" },
  { format: "link", label: "Link", text: "Link" },
];

/** Plain and outside React, like the scene editor's: saves outlive a hidden route. */
function createSession(id: string, draft: LoreDraft, version: number) {
  let current = draft;
  const queue = createSaveQueue<LoreDraft>({ getDoc: () => current, version, send: (sent, at) => sendEntry(id, sent, at) });
  return {
    queue,
    getDoc: () => current,
    setDoc: (next: LoreDraft) => {
      current = next;
    },
  };
}

type Suggestion = { name: string; kind: "character" | "lore"; color: string | null };

function suggestions({ characters, entries }: Targets, typed: string): Suggestion[] {
  const key = linkKey(typed);
  const all: Suggestion[] = [
    ...entries.map(({ title }) => ({ name: title, kind: "lore" as const, color: null })),
    ...characters.map(({ name, color }) => ({ name, kind: "character" as const, color })),
  ];
  return all.filter(({ name }) => linkKey(name).includes(key)).slice(0, MENU_SIZE);
}

function ConflictGate({ queue, onReload }: { queue: SaveQueue; onReload: () => Promise<boolean> }) {
  return useSaveStatus(queue) === "conflict" ? <LoreConflict onReload={onReload} /> : null;
}

export function LoreEditor({
  id,
  slug,
  version,
  draft: initial,
  targets,
}: {
  id: string;
  slug: string;
  version: number;
  draft: LoreDraft;
  targets: Targets;
}) {
  const router = useRouter();
  const [{ getDoc, setDoc, queue }] = useState(() => createSession(id, initial, version));
  const [draft, setDraft] = useState(initial);
  const [view, setView] = useState<"write" | "preview">("write");
  const [link, setLink] = useState<{ start: number; caret: number; typed: string } | null>(null);
  const [active, setActive] = useState(0);
  const [dialog, setDialog] = useState<"history" | "delete" | null>(null);
  const [upload, setUpload] = useState<{ percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const preview = useDeferredValue(draft.body);
  const lookup = useMemo(() => buildLinkLookup(targets), [targets]);
  const menu = link ? suggestions(targets, link.typed) : [];

  useLeaveGuard(queue);

  useEffect(() => {
    const handleOnline = () => queue.retry();
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
      void queue.flush();
    };
  }, [queue]);

  const change = (fields: Partial<LoreDraft>) => {
    const next = { ...getDoc(), ...fields };
    setDoc(next);
    setDraft(next);
    queue.change();
  };

  const replaceAll = (next: LoreDraft) => {
    setDoc(next);
    setDraft(next);
  };

  const applyEdit = ({ text, start, end }: Edit) => {
    change({ body: text });
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(start, end);
    });
  };

  const selection = (): Edit => {
    const { value = "", selectionStart = 0, selectionEnd = 0 } = area.current ?? {};
    return { text: value, start: selectionStart, end: selectionEnd };
  };

  const onBody = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { value, selectionStart } = event.target;
    change({ body: value });
    const open = openLinkAt(value, selectionStart);
    setLink(open && { ...open, caret: selectionStart });
    setActive(0);
  };

  const choose = (name: string) => {
    if (!link) return;
    applyEdit(completeLink(draft.body, link.start, link.caret, name));
    setLink(null);
  };

  const onBodyKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (menu.length === 0) return;

    if (event.key === "ArrowDown") setActive((index) => (index + 1) % menu.length);
    else if (event.key === "ArrowUp") setActive((index) => (index - 1 + menu.length) % menu.length);
    else if (event.key === "Enter" || event.key === "Tab") choose(menu[active].name);
    else if (event.key === "Escape") setLink(null);
    else return;
    event.preventDefault();
  };

  const uploadImage = async (file: File | undefined, attach: (key: string, url: string) => void) => {
    if (!file) return;
    setError(null);
    setUpload({ percent: 0 });
    try {
      const { key, publicUrl } = await uploadLoreImage(id, file, (percent) => setUpload({ percent }));
      attach(key, publicUrl ?? "");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Upload failed");
    } finally {
      setUpload(null);
    }
  };

  const reload = async () => {
    const latest = await fetchEntry(id);
    if (!latest) return false;

    const { version: newest, ...fields } = latest;
    replaceAll(fields);
    queue.adopt(newest);
    return true;
  };

  const remove = async () => {
    try {
      await queue.flush();
      await removeEntry(id, queue.getVersion());
      router.push("/lore");
      router.refresh();
      return null;
    } catch (problem) {
      return problem instanceof Error ? problem.message : "Could not delete";
    }
  };

  return (
    <>
      <div className="editor-toolbar">
        <div className="editor-mode lore-tabs" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "write"} onClick={() => setView("write")}>
            Write
          </button>
          <button type="button" aria-pressed={view === "preview"} onClick={() => setView("preview")}>
            Preview
          </button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <SaveIndicator queue={queue} />
          <button type="button" className="btn-ghost text-sm" onClick={() => setDialog("history")}>
            History
          </button>
          <a href={`/lore/${slug}`} className="btn-ghost text-sm">
            Done
          </a>
        </div>
      </div>

      <section aria-label="Entry details" className="glass lore-fields">
        <label className="block">
          <span className="eyebrow text-muted">Title</span>
          <input value={draft.title} required className="field" onChange={(event) => change({ title: event.target.value })} />
        </label>
        <label className="block">
          <span className="eyebrow text-muted">Category</span>
          <select value={draft.category ?? "Other"} className="field" onChange={(event) => change({ category: event.target.value })}>
            {LORE_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className="block lore-field-wide">
          <span className="eyebrow text-muted">Summary</span>
          <input value={draft.summary ?? ""} className="field" onChange={(event) => change({ summary: event.target.value || null })} />
        </label>
        <label className="block">
          <span className="eyebrow text-muted">Tags, with commas</span>
          <input defaultValue={draft.tags.join(", ")} className="field" onChange={(event) => change({ tags: parseList(event.target.value) })} />
        </label>
        <label className="block">
          <span className="eyebrow text-muted">Other names, with commas</span>
          <input defaultValue={draft.aliases.join(", ")} className="field" onChange={(event) => change({ aliases: parseList(event.target.value) })} />
        </label>
        <div className="lore-field-wide flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <label className="btn-ghost cursor-pointer">
            {draft.coverKey ? "Replace cover image" : "Add a cover image"}
            <input
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="sr-only"
              onChange={(event) => uploadImage(event.target.files?.[0], (key) => change({ coverKey: key }))}
            />
          </label>
          {draft.coverKey && (
            <button type="button" className="btn-ghost" onClick={() => change({ coverKey: null })}>
              Remove cover
            </button>
          )}
          {upload && <span className="text-muted">Uploading {upload.percent}%</span>}
          {error && (
            <span role="alert" className="font-medium text-status-idea">
              {error}
            </span>
          )}
        </div>
      </section>

      <div className="lore-split" data-view={view}>
        <div className="glass lore-write">
          <div className="lore-toolbar" role="toolbar" aria-label="Formatting">
            {TOOLBAR.map(({ format, label, text }) => (
              <button key={format} type="button" aria-label={label} onClick={() => applyEdit(applyFormat(selection(), format))}>
                {text}
              </button>
            ))}
            <label className="lore-toolbar-file">
              Image
              <input
                type="file"
                aria-label="Insert an image"
                accept={ACCEPTED_TYPES.join(",")}
                className="sr-only"
                onChange={(event) => {
                  const at = selection();
                  void uploadImage(event.target.files?.[0], (_key, url) => applyEdit(insertImage(at, url)));
                }}
              />
            </label>
          </div>

          <div className="relative">
            <textarea
              ref={area}
              value={draft.body}
              aria-label="Entry text, in markdown"
              aria-autocomplete="list"
              aria-expanded={menu.length > 0}
              aria-controls={menu.length > 0 ? "lore-link-menu" : undefined}
              role="combobox"
              className="lore-textarea"
              spellCheck
              onChange={onBody}
              onKeyDown={onBodyKey}
              onBlur={() => setLink(null)}
            />
            {menu.length > 0 && (
              <ul id="lore-link-menu" role="listbox" aria-label="Link to" className="editor-menu lore-link-menu">
                {menu.map(({ name, kind, color }, index) => (
                  <li
                    key={`${kind}-${name}`}
                    role="option"
                    aria-selected={index === active}
                    className="editor-menu-item"
                    style={kind === "character" ? characterStyle(color) : undefined}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(name);
                    }}
                  >
                    <span className="truncate">{name}</span>
                    <span className="ml-auto text-xs text-muted">{kind === "lore" ? "Lore" : "Character"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">Type [[ to link a character or lore entry.</p>
        </div>

        <div className="glass lore-preview" aria-label="Preview">
          <LoreMarkdown body={preview} lookup={lookup} />
        </div>
      </div>

      <div className="mt-6">
        <button type="button" className="btn-ghost text-sm" onClick={() => setDialog("delete")}>
          Delete this entry
        </button>
      </div>

      <ConflictGate queue={queue} onReload={reload} />
      {dialog === "history" && <LoreHistory id={id} queue={queue} onRestored={replaceAll} onClose={() => setDialog(null)} />}
      {dialog === "delete" && (
        <DeleteDialog title={`Delete ${draft.title}?`} onConfirm={remove} onClose={() => setDialog(null)}>
          <p>You can restore it from Recently deleted, in the lore menu, for 30 days.</p>
        </DeleteDialog>
      )}
    </>
  );
}
