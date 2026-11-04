"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { matchesSearch, sortCards, type CardSort } from "@/lib/characters/stats";
import { plural } from "@/lib/format";
import { CharacterCard, type CardData } from "./character-card";
import { CreateCardDialog } from "./create-card-dialog";

const SORTS: { value: CardSort; label: string }[] = [
  { value: "lines", label: "Most lines" },
  { value: "name", label: "Name" },
  { value: "first", label: "First appearance" },
];

export function Gallery({
  cards,
  noCard,
}: {
  cards: CardData[];
  noCard: { name: string; lines: number }[];
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CardSort>("lines");
  const [creating, setCreating] = useState<string | null>(null);

  const visible = useMemo(
    () => sortCards(cards.filter((card) => matchesSearch(card, query)), sort),
    [cards, query, sort],
  );

  return (
    <>
      <div className="gallery-tools">
        <label className="min-w-full flex-1 sm:min-w-48">
          <span className="sr-only">Search characters</span>
          <input
            type="search"
            value={query}
            placeholder="Search by name, role or gift"
            className="field w-full"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted">
          Sort by
          <select value={sort} className="field" onChange={(event) => setSort(event.target.value as CardSort)}>
            {SORTS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary text-sm" onClick={() => setCreating("")}>
          New character
        </button>
      </div>

      <p role="status" className="mb-4 text-sm text-muted">
        {plural(visible.length, "character")}
      </p>

      {visible.length === 0 ? (
        <EmptyState title={cards.length ? "Nobody by that name" : "No characters yet"}>
          {cards.length ? "Try a different search." : "Import a script or create the first card."}
        </EmptyState>
      ) : (
        <ul className="char-grid">
          {visible.map((card, index) => (
            <CharacterCard key={card.id} card={card} index={index} />
          ))}
        </ul>
      )}

      {noCard.length > 0 && (
        <section aria-labelledby="no-card-title" className="mt-12">
          <h2 id="no-card-title" className="text-2xl font-semibold">
            No card yet
          </h2>
          <p className="mt-1 text-sm text-muted">Speakers used in scripts who have no character card.</p>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {noCard.map(({ name, lines }) => (
              <li key={name} className="glass flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{name}</span>
                  <span className="text-xs text-muted">{plural(lines, "line")}</span>
                </span>
                <button
                  type="button"
                  className="btn-ghost shrink-0 text-sm"
                  aria-label={`Create card for ${name}`}
                  onClick={() => setCreating(name)}
                >
                  Create card
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {creating !== null && <CreateCardDialog name={creating} onClose={() => setCreating(null)} />}
    </>
  );
}
