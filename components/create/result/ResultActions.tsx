"use client";

import { motion } from "framer-motion";

export default function ResultActions() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6 }}
      className="flex flex-col items-center gap-6"
    >
      <button className="px-10 py-4 rounded-full bg-purple-600 hover:bg-purple-700 transition text-lg font-medium">
        Crear mi álbum físico
      </button>

      <button className="text-white/70 hover:text-white transition">
        Editar mi historia
      </button>
    </motion.div>
  );
}
