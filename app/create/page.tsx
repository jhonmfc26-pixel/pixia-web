"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useWizard } from "@/components/create/WizardProvider";

import Step1Story from "./steps/Step1Story";
import Step2Upload from "./steps/Step2Upload";
import Step3Style from "./steps/Step3Style";
import Step4Emotion from "./steps/Step4Emotion";
import Step5Preview from "./steps/Step5Preview";

function WizardSteps() {
  const { state } = useWizard();

  return (
    <AnimatePresence mode="wait">
      {state.step === 1 && (
        <motion.div
          key="step1"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="w-full"
        >
          <Step1Story />
        </motion.div>
      )}

      {state.step === 2 && (
        <motion.div
          key="step2"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="w-full"
        >
          <Step2Upload />
        </motion.div>
      )}

      {state.step === 3 && (
        <motion.div
          key="step3"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="w-full"
        >
          <Step3Style />
        </motion.div>
      )}
      {state.step === 4 && (
        <motion.div
          key="step4"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="w-full"
        >
          <Step4Emotion />
        </motion.div>
      )}

      {state.step === 5 && (
        <motion.div
          key="step5"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="w-full"
        >
          <Step5Preview />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function CreatePage() {
  return <WizardSteps />;
}
