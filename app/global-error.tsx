"use client";

/** Last-resort error boundary (root layout failed). Must render its own <html>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ color: "#1f2a5c" }}>Something went wrong</h1>
          <p>We couldn’t load this page. Please try again.</p>
          {error.digest ? <p style={{ fontSize: 12, color: "#666" }}>Ref: {error.digest}</p> : null}
          <button
            onClick={reset}
            style={{ minHeight: 44, padding: "0 20px", borderRadius: 10, border: 0, background: "#1f2a5c", color: "#fff", cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
