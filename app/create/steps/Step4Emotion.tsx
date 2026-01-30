"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ContinueButton from "@/components/create/ContinueButton";
import { useWizard } from "@/components/create/WizardProvider";

const emotions = [
  {
    id: "happy",
    title: "Alegre",
    desc: "Luminosa, ligera, llena de sonrisas",
    gradient: "from-yellow-400 via-orange-400 to-pink-400",
    glow: "shadow-[0_0_40px_rgba(251,191,36,0.6)]",
    icon: "😊",
  },
  {
    id: "romantic",
    title: "Romántica",
    desc: "Suave, amorosa, íntima",
    gradient: "from-pink-400 via-rose-400 to-fuchsia-500",
    glow: "shadow-[0_0_40px_rgba(244,114,182,0.6)]",
    icon: "💖",
  },
  {
    id: "nostalgic",
    title: "Nostálgica",
    desc: "Recuerdos que tocan el corazón",
    gradient: "from-indigo-500 via-blue-500 to-cyan-500",
    glow: "shadow-[0_0_40px_rgba(99,102,241,0.6)]",
    icon: "🥹",
  },
  {
    id: "epic",
    title: "Épica",
    desc: "Como el tráiler de una gran película",
    gradient: "from-red-500 via-orange-500 to-yellow-500",
    glow: "shadow-[0_0_40px_rgba(239,68,68,0.6)]",
    icon: "🔥",
  },
  {
    id: "intimate",
    title: "Íntima",
    desc: "Cercana, real, profundamente humana",
    gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    glow: "shadow-[0_0_40px_rgba(16,185,129,0.6)]",
    icon: "🌿",
  },
  {
    id: "inspiring",
    title: "Inspiradora",
    desc: "Motivadora, llena de esperanza",
    gradient: "from-sky-400 via-violet-400 to-fuchsia-500",
    glow: "shadow-[0_0_40px_rgba(139,92,246,0.6)]",
    icon: "✨",
  },
];

export default function Step4Emotion() {
  const { state, dispatch } = useWizard();
  const [selected, setSelected] = useState<string | null>(state.emotion ?? null);

  const handleSelect = (id: string) => {
    setSelected(id);
    dispatch({ type: "SET_EMOTION", payload: id as any });
  };

  return (
    <div className="w-full">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-semibold text-white">
          ¿Qué emoción quieres que se sienta tu historia?
        </h1>
        <p className="text-white/60 mt-3 max-w-xl mx-auto">
          Esto define el tono, la música y el ritmo de tu película.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
        {emotions.map((emotion) => {
          const isSelected = selected === emotion.id;

          return (
            <motion.div
              key={emotion.id}
              whileHover={{ scale: 1.05 }}
              onClick={() => handleSelect(emotion.id)}
              className={`relative h-40 rounded-2xl cursor-pointer overflow-hidden transition-all
                ${
                  isSelected
                    ? emotion.glow
                    : "border border-white/10 hover:border-white/30"
                }
              `}
            >
              {/* Fondo gradiente */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${emotion.gradient} opacity-80`}
              />

              {/* Overlay oscuro */}
              <div className="absolute inset-0 bg-black/40" />

              {/* Contenido */}
              <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
                <span className="text-4xl mb-2">{emotion.icon}</span>
                <h3 className="text-white text-lg font-semibold">
                  {emotion.title}
                </h3>
                <p className="text-white/70 text-sm mt-1">{emotion.desc}</p>
              </div>

              {/* Glow al seleccionar */}
              {isSelected && (
                <div className="absolute inset-0 bg-white/10 blur-xl pointer-events-none" />
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="flex justify-center">
        <ContinueButton disabled={!selected} />
      </div>
    </div>
  );
}
