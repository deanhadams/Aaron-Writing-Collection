"use client";

import "./globals.css";

/** For a failure in the root layout itself, so it brings its own page. */
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body className="grid min-h-dvh place-items-center bg-background p-6 text-ink">
        <main className="glass max-w-md p-8 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-muted">Your writing is safe. Try loading the page again.</p>
          <button type="button" onClick={retry} className="btn-primary mt-5">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
