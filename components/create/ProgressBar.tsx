"use client";

import { motion } from "framer-motion";
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
  const currentStep = state.step;

  return (
    <div className="w-full flex items-center justify-between gap-2">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = step.id < currentStep;

        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center relative z-10">
              <motion.div
                animate={{
                  scale: isActive ? 1.2 : 1,
                  boxShadow: isActive
                    ? "0 0 20px rgba(236,72,153,0.8)"
                    : "0 0 0 rgba(0,0,0,0)",
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                  ${
                    isActive
                      ? "bg-gradient-to-br from-pink-500 to-indigo-500 text-white"
                      : isCompleted
                      ? "bg-white/20 text-white"
                      : "bg-white/10 text-white/40"
                  }`}
              >
                {step.id}
              </motion.div>
              <span
                className={`mt-2 text-xs ${
                  isActive ? "text-white" : "text-white/40"
                }`}
              >
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div className="flex-1 h-px bg-gradient-to-r from-white/10 via-white/30 to-white/10 mx-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}
