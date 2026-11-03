"use client";

import { useEffect } from "react";
import { EmptyState } from "@/components/ui/empty-state";

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mt-10">
      <EmptyState mood="error" title="Something went wrong">
        <p>Your writing is safe. Try loading the page again.</p>
        <button type="button" onClick={retry} className="btn-primary mt-5">
          Try again
        </button>
      </EmptyState>
    </div>
  );
}
