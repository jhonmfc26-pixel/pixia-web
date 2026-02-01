"use client";

import { motion } from "framer-motion";
import { useWizard } from "@/components/create/WizardProvider";

function Item({ label, value }: { label: string; value?: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-5 space-y-1">
      <p className="text-sm text-white/60">{label}</p>
      <p className="font-medium text-white">{value ?? "-"}</p>
    </div>
  );
}

export default function DecisionSummary() {
  const { state } = useWizard();

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: { staggerChildren: 0.12 },
        },
      }}
      className="grid grid-cols-2 md:grid-cols-4 gap-6"
    >
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
        <Item label="Historia" value={state.storyType} />
      </motion.div>
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
        <Item label="Estilo" value={state.style} />
      </motion.div>
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
        <Item label="Emoción" value={state.emotion} />
      </motion.div>
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
        <Item label="Fotos" value={`${state.photos.length}`} />
      </motion.div>
    </motion.div>
  );
}
