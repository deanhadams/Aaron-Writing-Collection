"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useModal } from "@/components/ui/use-modal";
import { createCard } from "@/lib/characters/client";

export function CreateCardDialog({ name = "", onClose }: { name?: string; onClose: () => void }) {
  const router = useRouter();
  const dialog = useModal();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    setSaving(true);
    setError(null);
    try {
      const { slug } = await createCard(String(data.get("name")), String(data.get("fullName")) || null);
      router.push(`/characters/${slug}/edit`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not create the card");
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialog} aria-labelledby="create-card-title" className="editor-dialog" onClose={onClose}>
      <h2 id="create-card-title" className="text-xl font-semibold">
        Create a card
      </h2>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <label className="block">
          <span className="eyebrow text-muted">Name in scripts</span>
          <input name="name" required defaultValue={name} className="field mt-1 w-full uppercase" />
        </label>
        <label className="block">
          <span className="eyebrow text-muted">Full name (optional)</span>
          <input name="fullName" className="field mt-1 w-full" />
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-status-idea">
            {error}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="submit" className="btn-primary text-sm" disabled={isSaving}>
            {isSaving ? "Creating…" : "Create card"}
          </button>
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
