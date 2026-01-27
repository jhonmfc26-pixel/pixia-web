export default function Hero() {
  return (
    <section className="relative w-full overflow-hidden bg-black text-white">
      <div className="mx-auto max-w-7xl px-6 py-28 text-center">
        <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-1 text-sm font-medium text-white/80 backdrop-blur">
          ✨ AI-Powered Photo Stories
        </span>

        <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-6xl">
          Turn your memories into
          <span className="block bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
            cinematic photo books
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70">
          Pixia uses artificial intelligence to curate, design and transform your
          photos into a beautifully crafted story in minutes.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button className="rounded-xl bg-white px-8 py-4 text-sm font-semibold text-black transition hover:scale-105">
            Create my album
          </button>

          <button className="rounded-xl border border-white/20 px-8 py-4 text-sm font-semibold text-white transition hover:bg-white/10">
            View demo
          </button>
        </div>

        <p className="mt-6 text-xs text-white/50">
          No credit card required · Ready in minutes
        </p>
      </div>

      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-gradient-to-r from-orange-500/20 to-pink-500/20 blur-3xl" />
      </div>
    </section>
  );
}
