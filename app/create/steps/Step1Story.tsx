"use client";

import { useState } from "react";
import ContinueButton from "@/components/create/ContinueButton";
import { useWizard } from "@/components/create/WizardProvider";
import StorySceneCard from "@/components/create/StorySceneCard";

const stories = [
  {
    id: "wedding",
    title: "Boda",
    subtitle: "El día más importante de tu vida",
    icon: "💍",
    image: "/story/wedding.jpg",
  },
  {
    id: "honeymoon",
    title: "Luna de miel",
    subtitle: "Su primer viaje como esposos",
    icon: "🌙",
    image: "/story/honeymoon.jpg",
  },
  {
    id: "trip",
    title: "Viaje",
    subtitle: "Aventuras que merecen ser recordadas",
    icon: "✈️",
    image: "/story/trip.jpg",
  },
  {
    id: "anniversary",
    title: "Aniversario",
    subtitle: "Celebrando el amor con el tiempo",
    icon: "❤️",
    image: "/story/anniversary.jpg",
  },
  {
    id: "other",
    title: "Otro",
    subtitle: "Una historia única y personal",
    icon: "✨",
    image: "/story/other.jpg",
  },
];

export default function Step1Story() {
  const { state, dispatch } = useWizard();
  const [selected, setSelected] = useState<string | null>(state.storyType);

  const handleSelect = (id: string) => {
    setSelected(id);
    dispatch({ type: "SET_STORY", payload: id as any });
  };

  return (
    <div className="w-full">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-semibold text-white">
          ¿Qué historia quieres contar?
        </h1>
        <p className="text-white/60 mt-3 max-w-xl mx-auto">
          Elige el tipo de momento que vamos a transformar en una película visual.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {stories.map((story) => (
          <StorySceneCard
            key={story.id}
            title={story.title}
            subtitle={story.subtitle}
            icon={story.icon}
            image={story.image}
            selected={selected === story.id}
            onClick={() => handleSelect(story.id)}
          />
        ))}
      </div>

      <div className="flex justify-center">
        <ContinueButton disabled={!selected} />
      </div>
    </div>
  );
}
