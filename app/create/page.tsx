"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useWizard } from "@/components/create/WizardProvider";

import Step1Story from "./steps/Step1Story";
import Step2Upload from "./steps/Step2Upload";
import Step3Cover from "./steps/Step3Cover";

export default function CreatePage() {
  const { state } = useWizard();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state.step}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -24 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="w-full"
      >
        {state.step === 1 && <Step1Story />}
        {state.step === 2 && <Step2Upload />}
        {state.step === 3 && <Step3Cover />}
      </motion.div>
    </AnimatePresence>
  );
}
