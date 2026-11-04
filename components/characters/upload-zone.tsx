"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { uploadFile } from "@/lib/characters/client";
import { ACCEPTED_TYPES, type UploadKind } from "@/lib/characters/upload";

export function UploadZone({
  characterId,
  kind,
  label,
  onUploaded,
}: {
  characterId: string;
  kind: UploadKind;
  label: string;
  onUploaded: (key: string) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOver, setOver] = useState(false);

  const send = async (file: File | null | undefined) => {
    if (!file || progress !== null) return;

    setError(null);
    setProgress(0);
    try {
      const key = await uploadFile(characterId, file, kind, setProgress);
      await onUploaded(key);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Upload failed");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  };

  const latestSend = useRef(send);
  useEffect(() => {
    latestSend.current = send;
  });

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const { target } = event;
      const isTyping = target instanceof Element && target.closest("input, textarea");
      const image = [...(event.clipboardData?.files ?? [])].find((file) => file.type.startsWith("image/"));
      if (image && !isTyping) void latestSend.current(image);
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    void send(event.dataTransfer.files[0]);
  };

  return (
    <div>
      <label
        className="upload-zone"
        data-over={isOver || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          onChange={(event) => send(event.target.files?.[0])}
        />
        <span className="font-medium text-primary-strong">{label}</span>
        <span className="text-xs text-muted">Drop or paste an image, or choose a file. PNG, JPG, WebP or GIF, up to 10 MB.</span>
      </label>

      {progress !== null && (
        <div
          role="progressbar"
          aria-label="Upload progress"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="upload-progress"
        >
          <span style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-status-idea">
          {error}
        </p>
      )}
    </div>
  );
}
