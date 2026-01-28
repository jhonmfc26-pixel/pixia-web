"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { useWizard } from "./WizardProvider";

type Props = {
  disabled?: boolean;
  children?: ReactNode; // texto opcional
};

export default function ContinueButton({ disabled = false, children }: Props) {
  const { dispatch } = useWizard();

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      disabled={disabled}
      onClick={() => dispatch({ type: "NEXT_STEP" })}
      className={`relative px-10 py-4 rounded-full font-semibold text-lg transition-all
        ${
          disabled
            ? "bg-white/10 text-white/40 cursor-not-allowed"
            : "bg-gradient-to-r from-pink-500 to-indigo-500 text-white shadow-[0_0_30px_rgba(236,72,153,0.5)]"
        }`}
    >
      <span className="relative z-10">
        {children || "Continuar"}
      </span>

      {!disabled && (
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500 to-indigo-500 blur-xl opacity-50" />
      )}
    </motion.button>
  );
}
