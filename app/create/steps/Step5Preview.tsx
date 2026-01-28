"use client";

import { motion } from "framer-motion";
import ContinueButton from "@/components/create/ContinueButton";
import { useWizard } from "@/components/create/WizardProvider";

const emotionGradients: Record<string, string> = {
  happy: "from-yellow-400/40 via-orange-400/30 to-pink-400/40",
  romantic: "from-pink-400/40 via-rose-400/30 to-fuchsia-500/40",
  nostalgic: "from-indigo-500/40 via-blue-500/30 to-cyan-500/40",
  epic: "from-red-500/40 via-orange-500/30 to-yellow-500/40",
  intimate: "from-emerald-400/40 via-teal-500/30 to-cyan-600/40",
  inspiring: "from-sky-400/40 via-violet-400/30 to-fuchsia-500/40",
};

const storyLabels: Record<string, string> = {
  wedding: "Boda",
  honeymoon: "Luna de miel",
  trip: "Viaje",
  anniversary: "Aniversario",
  other: "Historia personal",
};

const styleLabels: Record<string, string> = {
  cinematic: "Cinemático",
  warm: "Cálido",
  bw: "Blanco y Negro",
  romantic: "Romántico",
  minimal: "Minimal",
  vintage: "Vintage",
};

const emotionLabels: Record<string, string> = {
  happy: "Alegre",
  romantic: "Romántica",
  nostalgic: "Nostálgica",
  epic: "Épica",
  intimate: "Íntima",
  inspiring: "Inspiradora",
};

export default function Step5Preview() {
  const { state } = useWizard();

  return (
    <div className="w-full">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-semibold text-white">
          Así se verá tu historia
        </h1>
        <p className="text-white/60 mt-3 max-w-xl mx-auto">
          Un adelanto antes de crear tu álbum con IA.
        </p>
      </div>

      {/* Poster */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative mx-auto max-w-3xl h-[420px] rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)]"
      >
        {/* Imagen base */}
        <img
          src="/story/wedding.jpg"
          alt="Preview"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Gradiente emoción */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${
            emotionGradients[state.emotion || "romantic"]
          }`}
        />

        {/* Overlay oscuro */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Texto */}
        <div className="relative z-10 h-full flex flex-col justify-end p-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {storyLabels[state.storyType || "wedding"]}
          </h2>

          <p className="text-white/80 text-lg">
            Estilo: {styleLabels[state.style || "cinematic"]} · Emoción:{" "}
            {emotionLabels[state.emotion || "romantic"]}
          </p>
        </div>
      </motion.div>

      {/* CTA */}
      <div className="flex flex-col items-center mt-12 gap-4">
        <ContinueButton>Crear mi álbum</ContinueButton>
        <span className="text-white/40 text-sm">
          Esto tomará solo unos segundos.
        </span>
      </div>
    </div>
  );
}
