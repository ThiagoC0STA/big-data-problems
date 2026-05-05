"use client";

import "./globals.css";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased">
        <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-start justify-center gap-4 p-8">
          <span className="rounded-md border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            global error
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            Something broke at the root.
          </h1>
          <p className="text-sm text-muted-foreground">
            This is the last line of defense. The root layout itself failed, so the regular
            shell could not render. The error was contained here so the page does not white-screen.
          </p>
          {error.digest ? (
            <code className="text-xs text-muted-foreground">digest: {error.digest}</code>
          ) : null}
          <button
            onClick={reset}
            className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
