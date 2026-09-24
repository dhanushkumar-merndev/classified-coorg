"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", display: "grid", placeItems: "center", minHeight: "100vh", textAlign: "center" }}>
        <div>
          <h1>Something went wrong</h1>
          <p>Please try again.</p>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  );
}
