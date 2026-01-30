"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const steps = [
  { text: "Seleccionando tus momentos clave…", target: 25 },
  { text: "Organizando la narrativa visual…", target: 50 },
  { text: "Aplicando el estilo cinematográfico…", target: 75 },
  { text: "Tu historia está tomando forma…", target: 100 },
];

export default function CreateLoading() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Avanza el texto
  useEffect(() => {
    const stepTimer = setInterval(() => {
      setIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }, 1000);

    return () => clearInterval(stepTimer);
  }, []);

  // Avanza el porcentaje de forma suave
  useEffect(() => {
    const target = steps[index].target;

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= target) return prev;
        return prev + 1;
      });
    }, 30);

    return () => clearInterval(progressTimer);
  }, [index]);

  // Redirección final
  useEffect(() => {
    if (progress >= 100) {
      const timeout = setTimeout(() => {
        router.push("/create/result");
      }, 600);

      return () => clearTimeout(timeout);
    }
  }, [progress, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center px-6 max-w-xl w-full">
        {/* Título */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-4xl font-semibold mb-6"
        >
          Creando tu historia
        </motion.h1>

        {/* Storytelling */}
        <div className="relative h-10 mb-8 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 text-white/70"
            >
              {steps[index].text}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Barra de progreso */}
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-4">
          <motion.div
            className="h-full bg-gradient-to-r from-pink-500 to-indigo-500"
            animate={{ width: `${progress}%` }}
            transition={{ ease: "easeOut", duration: 0.3 }}
          />
        </div>

        {/* Porcentaje */}
        <p className="text-sm text-white/60">
          {progress}% completado
        </p>

        <p className="text-xs text-white/40 mt-3">
          Esto puede tomar unos segundos dependiendo de tu álbum
        </p>
      </div>
    </div>
  );
}
