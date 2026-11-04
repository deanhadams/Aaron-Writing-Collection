"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useModal } from "@/components/ui/use-modal";

/** Null closes the dialog. A string stays open, and shows the text if there is any. */
export type Submit = (data: FormData) => Promise<string | null>;

export function FormDialog({
  title,
  submitLabel,
  busyLabel = "Saving…",
  danger,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  submitLabel: string;
  busyLabel?: string;
  danger?: boolean;
  onSubmit: Submit;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useModal();
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const problem = await onSubmit(new FormData(event.currentTarget));
    setSaving(false);
    if (problem === null) onClose();
    else setError(problem);
  };

  return (
    <dialog ref={dialog} aria-labelledby={titleId} className="editor-dialog" onClose={onClose}>
      <h2 id={titleId} className="text-xl font-semibold">
        {title}
      </h2>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        {children}
        {error && (
          <p role="alert" className="text-sm font-medium text-status-idea">
            {error}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="submit" className={danger ? "btn-danger text-sm" : "btn-primary text-sm"} disabled={isSaving}>
            {isSaving ? busyLabel : submitLabel}
          </button>
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function TextField({
  label,
  name,
  defaultValue,
  required,
  autoFocus,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow text-muted">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="field w-full"
      />
    </label>
  );
}

export function TextArea({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string | null }) {
  return (
    <label className="block">
      <span className="eyebrow text-muted">{label}</span>
      <textarea name={name} defaultValue={defaultValue ?? ""} rows={4} className="field w-full resize-y" />
    </label>
  );
}
