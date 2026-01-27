"use client";

import { motion } from "framer-motion";

export default function Hero() {
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="relative min-h-screen flex items-center justify-center bg-black text-white"
    >
      <div className="max-w-6xl mx-auto px-6 text-center">
        <h1 className="text-5xl md:text-6xl font-bold leading-tight">
          Turn your memories into{" "}
          <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-fuchsia-500 bg-clip-text text-transparent">
            cinematic photo books
          </span>
        </h1>

        <p className="mt-6 text-lg text-gray-300 max-w-2xl mx-auto">
          Create beautiful, AI-powered photo stories in minutes. Designed to be
          printed, shared and remembered forever.
        </p>

        <div className="mt-10 flex justify-center gap-4">
          <button className="px-8 py-3 rounded-full text-white font-semibold bg-gradient-to-r from-orange-400 to-pink-500 shadow-lg hover:scale-105 transition">
            Create your album
          </button>
          <button className="px-8 py-3 rounded-full border border-white/20 text-white hover:bg-white/10 transition">
            View demo
          </button>
        </div>
      </div>
    </motion.section>
  );
}
