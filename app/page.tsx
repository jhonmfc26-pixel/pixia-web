export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen text-center px-6">
      <h1 className="text-6xl font-bold mb-4 tracking-tight">Pixia</h1>
      <p className="text-xl text-gray-400 max-w-xl mb-8">
        Turn your memories into cinematic AI-powered photo stories in seconds.
      </p>

      <div className="flex gap-4">
        <button className="bg-white text-black px-6 py-3 rounded-xl font-semibold hover:scale-105 transition">
          Create Album
        </button>
        <button className="border border-white/30 px-6 py-3 rounded-xl hover:bg-white/10 transition">
          View Demo
        </button>
      </div>
    </main>
  );
}
