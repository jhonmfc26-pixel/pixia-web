"use client";

import { motion } from "framer-motion";

type Props = {
  title: string;
  icon: string;
  selected?: boolean;
  onClick?: () => void;
};

export default function StoryCard3D({
  title,
  icon,
  selected = false,
  onClick,
}: Props) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.05, rotateX: 6, rotateY: -6 }}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className={`relative cursor-pointer rounded-2xl h-40 flex flex-col items-center justify-center gap-3 border text-center transition-all
        ${
          selected
            ? "border-pink-400 shadow-[0_0_35px_rgba(236,72,153,0.6)] bg-gradient-to-br from-pink-500/10 to-indigo-500/10"
            : "border-white/10 bg-white/5 hover:border-white/30"
        }`}
    >
      <span className="text-5xl drop-shadow-lg">{icon}</span>
      <h3 className="text-white font-semibold text-lg">{title}</h3>

      {selected && (
        <div className="absolute inset-0 rounded-2xl bg-pink-500/20 blur-xl pointer-events-none" />
      )}
    </motion.div>
  );
}
