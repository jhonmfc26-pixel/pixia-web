"use client";

import { motion } from "framer-motion";

type StepCardProps = {
  title: string;
  image: string;
  filterClass: string;
  selected?: boolean;
  onClick?: () => void;
};

export default function StepCard({
  title,
  image,
  filterClass,
  selected = false,
  onClick,
}: StepCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`relative cursor-pointer rounded-2xl overflow-hidden border transition-all
        ${
          selected
            ? "border-pink-400 shadow-[0_0_30px_rgba(236,72,153,0.5)]"
            : "border-white/10 hover:border-white/30"
        }`}
    >
      {/* Imagen */}
      <div className="relative h-44 w-full overflow-hidden">
        <img
          src={image}
          alt={title}
          className={`w-full h-full object-cover transition-all duration-500 ${filterClass}`}
        />

        {/* Overlay oscuro */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Título */}
      <div className="absolute bottom-3 left-3 right-3 text-center">
        <span className="text-white font-semibold text-lg drop-shadow">
          {title}
        </span>
      </div>

      {/* Glow selección */}
      {selected && (
        <div className="absolute inset-0 rounded-2xl bg-pink-500/20 blur-xl pointer-events-none" />
      )}
    </motion.div>
  );
}
