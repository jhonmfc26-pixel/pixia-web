"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const steps = [
  "Analizando tus recuerdos...",
  "Seleccionando los mejores momentos...",
  "Construyendo la narrativa...",
  "Diseñando tu álbum cinematográfico...",
  "Dándole vida a tu historia...",
];

export default function CreatingStoryPage() {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 1;
      });
    }, 80);

    const stepInterval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(stepInterval);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-black via-zinc-900 to-black text-white">
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl md:text-5xl font-semibold mb-6"
      >
        Creando tu historia
      </motion.h1>

      <motion.p
        key={stepIndex}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-white/70 mb-10 text-lg"
      >
        {steps[stepIndex]}
      </motion.p>

      {/* Barra de progreso */}
      <div className="w-80 h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-pink-500 to-indigo-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ ease: "linear" }}
        />
      </div>

      <span className="mt-4 text-white/50 text-sm">{progress}%</span>
    </div>
  );
}
