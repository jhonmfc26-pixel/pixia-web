"use client";

import { motion } from "framer-motion";

export default function ResultHero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      className="text-center space-y-4"
    >
      <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
        ✨ Tu historia está lista
      </h1>
      <p className="text-white/70 max-w-xl mx-auto">
        Tu álbum ha sido creado. Ahora puedes abrirlo y editar cada detalle.
      </p>
    </motion.div>
  );
}
