"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useWizard } from "./WizardProvider";

const steps = [
  { id: 1, label: "Historia" },
  { id: 2, label: "Fotos" },
  { id: 3, label: "Estilo" },
  { id: 4, label: "Emoción" },
  { id: 5, label: "Preview" },
];

export function ProgressBar() {
  const { state } = useWizard();

  return (
    <div className="flex justify-center">
      <div className="flex items-center gap-6">
        {steps.map((step, index) => {
          const isActive = state.step === step.id;
          const isCompleted = state.step > step.id;

          return (
            <div key={step.id} className="flex items-center gap-3">
              {/* Círculo */}
              <motion.div
                layout
                className={`relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                  ${
                    isActive
                      ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white"
                      : isCompleted
                      ? "bg-white text-black"
                      : "bg-white/20 text-white/60"
                  }`}
                initial={false}
                animate={
                  isActive
                    ? {
                        boxShadow: [
                          "0 0 0px rgba(236,72,153,0)",
                          "0 0 18px rgba(236,72,153,0.6)",
                          "0 0 0px rgba(236,72,153,0)",
                        ],
                      }
                    : {}
                }
                transition={{ duration: 0.6 }}
              >
                {/* Check animado al completar */}
                <AnimatePresence mode="wait">
                  {isCompleted ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <Check className="w-4 h-4" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="number"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {step.id}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Label */}
              <span
                className={`text-xs ${
                  isActive ? "text-white" : "text-white/40"
                }`}
              >
                {step.label}
              </span>

              {/* Línea */}
              {index < steps.length - 1 && (
                <div className="w-8 h-px bg-white/20" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
