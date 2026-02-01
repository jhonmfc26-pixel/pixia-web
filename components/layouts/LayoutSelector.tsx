"use client";

import { motion, AnimatePresence } from "framer-motion";
import { LayoutDefinition } from "@/lib/layouts/types";
import LayoutOptionCard from "./LayoutOptionCard";

export type LayoutSelectorItem = {
  layout: LayoutDefinition;
  score: number;
  isCurrent: boolean;
};

type Props = {
  layouts: LayoutSelectorItem[];
  onSelect: (layout: LayoutDefinition) => void;
  onClose: () => void;
};

export default function LayoutSelector({
  layouts,
  onSelect,
  onClose,
}: Props) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl p-6 max-w-3xl w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold mb-1">
            Diseños que funcionan mejor aquí
          </h3>
          <p className="text-sm text-black/50 mb-6">
            Pixia recomienda estos layouts según tus fotos
          </p>

          <div className="grid grid-cols-3 gap-6">
            {layouts.map(({ layout, score, isCurrent }) => (
              <LayoutOptionCard
                key={layout.id}
                layout={layout}
                score={score}
                isCurrent={isCurrent}
                onClick={() => onSelect(layout)}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
