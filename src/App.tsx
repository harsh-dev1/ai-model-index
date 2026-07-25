export default function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">Wave 0 · pipeline proof</p>
      <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">AI Model Index</h1>
      <p className="mt-4 text-lg text-ink-400">
        Live rankings pulled from open AI leaderboards, plus an opinionated composite index you can
        re-weight yourself.
      </p>
      <p className="mt-8 text-sm text-ink-400">
        This page exists to prove the deploy pipeline works before any features are built. The data
        layer, scoring engine, and charts land next.
      </p>
    </main>
  );
}
