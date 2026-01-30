"use client";

import { motion } from "framer-motion";
import { useWizard } from "@/components/create/WizardProvider";

const stories = [
  { id: "wedding", title: "Boda", image: "/story/wedding.jpg" },
  { id: "honeymoon", title: "Luna de miel", image: "/story/honeymoon.jpg" },
  { id: "trip", title: "Viaje", image: "/story/trip.jpg" },
  { id: "anniversary", title: "Aniversario", image: "/story/anniversary.jpg" },
  { id: "other", title: "Otra historia", image: "/story/other.jpg" },
];

export default function Step1Story() {
  const { state, dispatch } = useWizard();

  const handleSelect = (id: string) => {
    dispatch({ type: "SET_STORY_TYPE", payload: id });
    dispatch({ type: "NEXT_STEP" });
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold text-white">
          ¿Qué historia quieres contar?
        </h1>
        <p className="text-white/60 mt-2 max-w-xl mx-auto">
          Elige el tipo de momento que vamos a transformar en una película
          visual.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stories.map((story) => {
          const isSelected = state.storyType === story.id;

          return (
            <motion.div
              key={story.id}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleSelect(story.id)}
              className={`relative h-[170px] rounded-2xl overflow-hidden cursor-pointer transition-all
                ${
                  isSelected
                    ? "ring-2 ring-pink-500 shadow-[0_0_35px_rgba(236,72,153,0.5)]"
                    : "ring-1 ring-white/10 hover:ring-white/30"
                }`}
            >
              <img
                src={story.image}
                alt={story.title}
                className="absolute inset-0 w-full h-full object-cover"
              />

              <div className="absolute inset-0 bg-black/40" />

              <div className="relative z-10 h-full flex items-end p-5">
                <span className="text-lg font-semibold text-white">
                  {story.title}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
