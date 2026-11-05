"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addRecent, EXAMPLE_SEARCHES, loadRecent } from "@/lib/search/client";

const href = (query: string) => `/search?q=${encodeURIComponent(query)}`;

/** Saves the search once it has been run, so typing never fills the list. */
export function RememberSearch({ query }: { query: string }) {
  useEffect(() => addRecent(query), [query]);
  return null;
}

export function SearchIdeas() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists after mount
    setRecent(loadRecent());
  }, []);

  return (
    <div className="glass mt-6 p-6">
      <h2 className="text-xl font-semibold">Find anything in the writing</h2>
      <p className="mt-1 text-sm text-muted">Names are forgiving: a slip like Revok still finds Revoc.</p>

      {recent.length > 0 && (
        <>
          <h3 className="eyebrow mt-5 text-muted">Recent searches</h3>
          <ul className="search-chips mt-2">
            {recent.map((item) => (
              <li key={item}>
                <Link href={href(item)} className="char-chip">
                  {item}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="eyebrow mt-5 text-muted">Try</h3>
      <ul className="search-chips mt-2">
        {EXAMPLE_SEARCHES.map((item) => (
          <li key={item}>
            <Link href={href(item)} className="char-chip">
              {item}
            </Link>
          </li>
        ))}
      </ul>

      <h3 className="eyebrow mt-5 text-muted">Search tips</h3>
      <ul className="mt-2 grid gap-1 text-sm text-muted">
        <li>
          <code>&quot;air force&quot;</code> finds those words together.
        </li>
        <li>
          <code>-exam</code> leaves out a word.
        </li>
        <li>
          <code>speaker:Revoc</code>, <code>kind:outro</code> and <code>ep:3-5</code> narrow the scenes.
        </li>
      </ul>
    </div>
  );
}
