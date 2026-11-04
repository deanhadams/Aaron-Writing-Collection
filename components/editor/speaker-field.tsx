"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { Beat } from "@/lib/db/schema";
import { splitSpeakers } from "@/lib/script/scene-summary";
import { useEditor, useFocusField, useRegisterField, type CastMember } from "./editor-context";

const MAX_SUGGESTIONS = 6;

const joinSpeakers = (names: string[]) => names.join(" & ");

function suggest(cast: CastMember[], query: string, taken: string[]) {
  const search = query.trim().toLowerCase();
  if (!search) return [];

  return cast
    .filter(({ name, fullName }) => {
      if (taken.includes(name.toUpperCase())) return false;
      const words = `${name} ${fullName ?? ""}`.toLowerCase().split(/\s+/);
      return (
        name.toLowerCase().startsWith(search) ||
        fullName?.toLowerCase().startsWith(search) ||
        words.some((word) => word.startsWith(search))
      );
    })
    .slice(0, MAX_SUGGESTIONS);
}

function SpeakerChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  const { castByName } = useEditor();
  const member = castByName.get(name.toUpperCase());

  return (
    <span
      className="speaker-chip"
      style={member?.color ? ({ "--char": member.color } as CSSProperties) : undefined}
    >
      {name}
      {!member && <span className="speaker-chip-tag">no card yet</span>}
      <button type="button" aria-label={`Remove speaker ${name}`} onClick={onRemove}>
        ×
      </button>
    </span>
  );
}

export function SpeakerField({ beat }: { beat: Beat }) {
  const { store, cast, castByName } = useEditor();
  const focus = useFocusField();
  const register = useRegisterField(beat.id, "speaker");
  const [query, setQueryState] = useState("");
  // Moving focus fires blur inside the same event, before React re-renders.
  const latestQuery = useRef("");
  const [active, setActive] = useState(0);
  const [isOpen, setOpen] = useState(false);
  const wasPrompted = useRef(false);

  const names = splitSpeakers(beat.character ?? "");
  const options = isOpen ? suggest(cast, query, names.map((name) => name.toUpperCase())) : [];
  const listId = `speakers-${beat.id}`;

  const setQuery = (next: string) => {
    latestQuery.current = next;
    setQueryState(next);
  };

  const setNames = (next: string[]) => {
    store.updateBeat(beat.id, { character: joinSpeakers(next) });
  };

  /** Adds a name. The first name typed on a carried-over speaker replaces it. */
  const commit = (raw: string) => {
    const typed = raw.trim();
    if (!typed) return;

    const exact = cast.find(
      ({ name, fullName }) =>
        name.toLowerCase() === typed.toLowerCase() || fullName?.toLowerCase() === typed.toLowerCase(),
    );
    const name = exact?.name ?? typed.toUpperCase();
    const current = splitSpeakers(store.getBeat(beat.id)?.character ?? "");
    const base = wasPrompted.current ? [] : current;

    wasPrompted.current = false;
    setQuery("");
    setActive(0);
    if (!base.some((item) => item.toUpperCase() === name.toUpperCase())) setNames([...base, name]);
  };

  const pick = (member: CastMember) => commit(member.name);

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (options.length === 0) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (options[active]) pick(options[active]);
      else commit(query);
      focus.text(beat.id);
    } else if (event.key === "Tab" && query.trim()) {
      if (options[active]) pick(options[active]);
      else commit(query);
    } else if (event.key === "&" || event.key === ",") {
      event.preventDefault();
      if (options[active]) pick(options[active]);
      else commit(query);
    } else if (event.key === "Backspace" && query === "" && names.length > 0) {
      event.preventDefault();
      setNames(names.slice(0, -1));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const typedIsNew =
    query.trim() !== "" && !castByName.has(query.trim().toUpperCase()) && options.length === 0;

  return (
    <div className="speaker-field">
      {names.map((name) => (
        <SpeakerChip
          key={name}
          name={name}
          onRemove={() => setNames(names.filter((item) => item !== name))}
        />
      ))}

      <div className="relative min-w-24 flex-1">
        <input
          ref={register}
          value={query}
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
          aria-label={names.length ? `Add a speaker alongside ${names.join(" and ")}` : "Speaker"}
          placeholder={names.length ? "and…" : "Speaker"}
          className="speaker-input"
          onFocus={(event) => {
            setOpen(true);
            wasPrompted.current = event.target.dataset.prompt === "true";
            delete event.target.dataset.prompt;
          }}
          onBlur={() => {
            commit(latestQuery.current);
            wasPrompted.current = false;
            setOpen(false);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={handleKey}
        />

        <ul
          id={listId}
          role="listbox"
          aria-label="Characters"
          className="editor-menu"
          hidden={options.length === 0 && !typedIsNew}
        >
          {options.map((member, index) => (
            <li
              key={member.name}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className="editor-menu-item"
              onMouseDown={(event) => {
                event.preventDefault();
                pick(member);
              }}
            >
              <span
                className="editor-menu-dot"
                style={member.color ? { background: member.color } : undefined}
              />
              {member.name}
              {member.fullName && <span className="text-muted"> {member.fullName}</span>}
            </li>
          ))}
          {typedIsNew && (
            <li role="option" aria-selected={false} className="editor-menu-item text-muted">
              New speaker, no card yet
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
