"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { useWizard } from "./WizardProvider";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Props = {
  disabled?: boolean;
  children?: ReactNode;
  isFinalStep?: boolean;
};

export default function ContinueButton({
  disabled = false,
  children,
  isFinalStep = false,
}: Props) {
  const { state, dispatch } = useWizard();
  const router = useRouter();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="backdrop-blur-xl bg-black/70 border-t border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">

          {/* 🔙 Volver (mejorado) */}
          {state.step > 1 ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => dispatch({ type: "PREV_STEP" })}
              className="
                group flex items-center gap-2 px-6 py-3 rounded-full
                text-sm font-medium text-white/70
                border border-white/15
                bg-gradient-to-r from-white/5 to-white/0
                hover:text-white
                hover:border-white/30
                hover:shadow-[0_0_20px_rgba(168,85,247,0.25)]
                transition-all
              "
            >
              <ArrowLeft
                className="w-4 h-4 transition-transform group-hover:-translate-x-1"
              />
              Volver
            </motion.button>
          ) : (
            <div />
          )}

          {/* 👉 Continuar / Crear */}
          <motion.button
            whileHover={!disabled ? { scale: 1.05 } : {}}
            whileTap={!disabled ? { scale: 0.95 } : {}}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              if (isFinalStep) {
                router.push("/create/loading");
              } else {
                dispatch({ type: "NEXT_STEP" });
              }
            }}
            className={`relative px-8 py-3 rounded-full font-semibold text-base transition-all
              ${
                disabled
                  ? "bg-white/10 text-white/40 cursor-not-allowed"
                  : "bg-gradient-to-r from-pink-500 to-indigo-500 text-white shadow-[0_0_25px_rgba(236,72,153,0.6)] hover:shadow-[0_0_40px_rgba(236,72,153,0.9)]"
              }`}
          >
            <span className="relative z-10">
              {children || "Continuar"}
            </span>

            {!disabled && (
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500 to-indigo-500 blur-xl opacity-40" />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

