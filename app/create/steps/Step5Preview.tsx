"use client";

import { motion } from "framer-motion";
import ContinueButton from "@/components/create/ContinueButton";
import { useWizard } from "@/components/create/WizardProvider";

export default function Step5Preview() {
  const { state } = useWizard();

  const prioritized = state.photos.filter((p) => p.priority);
  const photos =
    prioritized.length > 0
      ? prioritized.slice(0, 4)
      : state.photos.slice(0, 4);

  const count = photos.length;

  const renderLayout = () => {
    if (count === 1) {
      return (
        <img
          src={URL.createObjectURL(photos[0].file)}
          className="object-cover w-full h-full"
        />
      );
    }

    if (count === 2) {
      return (
        <div className="grid grid-cols-2 h-full">
          {photos.map((p) => (
            <img
              key={p.id}
              src={URL.createObjectURL(p.file)}
              className="object-cover w-full h-full"
            />
          ))}
        </div>
      );
    }

    if (count === 3) {
      return (
        <div className="grid grid-cols-2 grid-rows-2 h-full">
          <img
            src={URL.createObjectURL(photos[0].file)}
            className="object-cover w-full h-full row-span-2"
          />
          {photos.slice(1).map((p) => (
            <img
              key={p.id}
              src={URL.createObjectURL(p.file)}
              className="object-cover w-full h-full"
            />
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 grid-rows-2 h-full">
        {photos.map((p) => (
          <img
            key={p.id}
            src={URL.createObjectURL(p.file)}
            className="object-cover w-full h-full"
          />
        ))}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-semibold text-white">
          Así se verá tu historia
        </h1>
        <p className="text-white/60 mt-3 max-w-xl mx-auto">
          Un adelanto cinematográfico basado en tus momentos clave.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative w-full max-w-4xl aspect-[3/4] rounded-3xl overflow-hidden
          shadow-[0_40px_120px_rgba(0,0,0,0.6)] mb-10"
      >
        {renderLayout()}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

        <div className="absolute bottom-0 left-0 right-0 p-8 text-center">
          <h2 className="text-3xl font-semibold text-white">
            Tu historia comienza aquí
          </h2>
        </div>
      </motion.div>

      <ContinueButton isFinalStep>
        Crear mi álbum
      </ContinueButton>
    </div>
  );
}

