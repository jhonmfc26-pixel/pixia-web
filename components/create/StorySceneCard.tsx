"use client";

import { motion } from "framer-motion";

type Props = {
  title: string;
  subtitle: string;
  image: string;
  icon: string;
  selected?: boolean;
  onClick?: () => void;
};

export default function StorySceneCard({
  title,
  subtitle,
  image,
  icon,
  selected = false,
  onClick,
}: Props) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      className={`relative h-56 rounded-2xl overflow-hidden cursor-pointer transition-all
        ${selected ? "ring-2 ring-pink-400 shadow-[0_0_40px_rgba(236,72,153,0.6)]" : "ring-1 ring-white/10"}
      `}
    >
      {/* Imagen */}
      <img
        src={image}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay degradado */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Contenido */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
        <div className="w-12 h-12 rounded-xl bg-pink-500/90 flex items-center justify-center text-2xl shadow-lg">
          {icon}
        </div>
        <div>
          <h3 className="text-white text-xl font-semibold">{title}</h3>
          <p className="text-white/70 text-sm">{subtitle}</p>
        </div>
      </div>

      {/* Glow al seleccionar */}
      {selected && (
        <div className="absolute inset-0 bg-pink-500/10 blur-xl pointer-events-none" />
      )}
    </motion.div>
  );
}
