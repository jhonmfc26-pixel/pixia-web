import ResultHero from "@/components/create/result/ResultHero";
import AlbumMockup from "@/components/create/result/AlbumMockup";
import ResultActions from "@/components/create/result/ResultActions";

export default function ResultPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-5xl mx-auto px-6 py-20 space-y-24">
        <ResultHero />
        <AlbumMockup />
        <ResultActions />
      </section>
    </main>
  );
}
