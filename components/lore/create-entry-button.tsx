"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createLoreEntry } from "@/lib/lore/client";

export function CreateEntryButton({ title }: { title: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  const create = async () => {
    setState("busy");
    try {
      const { slug } = await createLoreEntry(title, "Other");
      router.push(`/lore/${slug}/edit`);
    } catch {
      setState("failed");
    }
  };

  return (
    <button type="button" className="wiki-create" disabled={state === "busy"} aria-label={`Create entry for ${title}`} onClick={create}>
      {state === "failed" ? "Try again" : state === "busy" ? "Creating…" : "Create entry"}
    </button>
  );
}
