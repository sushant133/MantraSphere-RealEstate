import Link from "next/link";

/** 404 for paths outside a locale prefix (rare: middleware normally adds /en). */
export default function RootNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ color: "#1f2a5c" }}>Page not found</h1>
          <p>The page you are looking for doesn’t exist or has moved.</p>
          <Link href="/en" style={{ display: "inline-block", minHeight: 44, lineHeight: "44px", color: "#1f2a5c" }}>
            Back to home
          </Link>
        </main>
      </body>
    </html>
  );
}
