"use client";

import { useState } from "react";
import StepCard from "@/components/create/StepCard";
import ContinueButton from "@/components/create/ContinueButton";
import { useWizard } from "@/components/create/WizardProvider";

const styles = [
  {
    id: "cinematic",
    title: "Cinemático",
    filter: "contrast-125 saturate-110 brightness-90",
  },
  {
    id: "warm",
    title: "Cálido",
    filter: "sepia-[0.3] saturate-150 brightness-105",
  },
  {
    id: "bw",
    title: "Blanco y Negro",
    filter: "grayscale contrast-125",
  },
  {
    id: "romantic",
    title: "Romántico",
    filter: "hue-rotate-[-20deg] saturate-125 brightness-110",
  },
  {
    id: "minimal",
    title: "Minimal",
    filter: "saturate-75 brightness-110 contrast-90",
  },
  {
    id: "vintage",
    title: "Vintage",
    filter: "sepia-[0.5] contrast-90 brightness-95",
  },
];

export default function Step3Style() {
  const { state, dispatch } = useWizard();
  const [selected, setSelected] = useState<string | null>(state.style ?? null);

  const handleSelect = (id: string) => {
    setSelected(id);
    dispatch({ type: "SET_STYLE", payload: id as any });
  };

  return (
    <div className="w-full">
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-semibold text-white">
          ¿Qué estilo visual quieres?
        </h1>
        <p className="text-white/60 mt-3 max-w-xl mx-auto">
          Mira cómo se verían tus recuerdos con diferentes atmósferas.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
        {styles.map((style) => (
          <StepCard
            key={style.id}
            title={style.title}
            image="/demo-style.jpg"
            filterClass={style.filter}
            selected={selected === style.id}
            onClick={() => handleSelect(style.id)}
          />
        ))}
      </div>

      <div className="flex justify-center">
        <ContinueButton disabled={!selected} />
      </div>
    </div>
  );
}
