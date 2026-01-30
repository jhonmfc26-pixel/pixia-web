"use client";

import { useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  motion,
  AnimatePresence,
  Reorder,
  useMotionValue,
  useTransform,
} from "framer-motion";
import ContinueButton from "@/components/create/ContinueButton";
import { X, Star, Move } from "lucide-react";
import { useWizard, PhotoItem } from "@/components/create/WizardProvider";

export default function Step2Upload() {
  const { state, dispatch } = useWizard();
  const photos = state.photos;

  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newPhotos: PhotoItem[] = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        priority: false,
      }));

      dispatch({
        type: "SET_PHOTOS",
        payload: [...photos, ...newPhotos].slice(0, 30),
      });
    },
    [dispatch, photos]
  );

  const removePhoto = (id: string) => {
    dispatch({
      type: "SET_PHOTOS",
      payload: photos.filter((p) => p.id !== id),
    });
  };

  const togglePriority = (id: string) => {
    const prioritized = photos.filter((p) => p.priority).length;

    dispatch({
      type: "SET_PHOTOS",
      payload: photos.map((p) => {
        if (p.id !== id) return p;
        if (!p.priority && prioritized >= 5) return p;
        return { ...p, priority: !p.priority };
      }),
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
  });

  useEffect(() => {
    count.set(photos.length);
  }, [photos.length, count]);

  const unlocked = photos.length >= 5;
  const priorityCount = photos.filter((p) => p.priority).length;

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-semibold text-white">
          Sube y ordena tus recuerdos
        </h1>
        <p className="text-white/60 mt-3 max-w-xl mx-auto">
          Arrastra las fotos para definir el orden de tu historia. Marca las más
          importantes.
        </p>
      </div>

      <motion.div
        {...(getRootProps() as any)}
        whileHover={{ scale: 1.01 }}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
          ${
            isDragActive
              ? "border-pink-400 bg-pink-500/10 shadow-[0_0_40px_rgba(236,72,153,0.4)]"
              : "border-white/20 bg-white/5 hover:border-white/40"
          }`}
      >
        <input {...getInputProps()} />

        <div className="relative z-10 flex flex-col items-center gap-3">
          <span className="text-4xl">📸</span>
          <p className="text-white font-medium">
            Arrastra tus fotos aquí o haz clic para subir
          </p>

          <motion.p className="text-white/50 text-sm">
            <motion.span>{rounded}</motion.span> / 30 fotos
          </motion.p>

          {priorityCount > 0 && (
            <p className="text-xs text-pink-400">
              ⭐ {priorityCount} foto{priorityCount > 1 ? "s" : ""} priorizada
              {priorityCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </motion.div>

      {photos.length > 0 && (
        <Reorder.Group
          axis="x"
          values={photos}
          onReorder={(newOrder) =>
            dispatch({ type: "SET_PHOTOS", payload: newOrder })
          }
          className="grid grid-cols-3 md:grid-cols-5 gap-4 mt-8"
        >
          <AnimatePresence>
            {photos.map((item) => (
              <Reorder.Item
                key={item.id}
                value={item}
                whileDrag={{ scale: 1.1, zIndex: 50 }}
                className={`relative group w-full h-24 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing
                  ${
                    item.priority
                      ? "ring-2 ring-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.6)]"
                      : ""
                  }`}
              >
                <img
                  src={URL.createObjectURL(item.file)}
                  alt="preview"
                  className="object-cover w-full h-full"
                />

                <div className="absolute top-1.5 left-1.5 text-white/60 opacity-0 group-hover:opacity-100 transition">
                  <Move className="w-4 h-4" />
                </div>

                <button
                  onClick={() => removePhoto(item.id)}
                  className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full
                    bg-black/60 backdrop-blur text-white/80
                    flex items-center justify-center
                    opacity-100 md:opacity-0 group-hover:opacity-100 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => togglePriority(item.id)}
                  className={`absolute bottom-1.5 right-1.5 z-10 w-6 h-6 rounded-full
                    backdrop-blur flex items-center justify-center transition
                    ${
                      item.priority
                        ? "bg-pink-500 text-white shadow-[0_0_12px_rgba(236,72,153,0.9)]"
                        : "bg-black/50 text-white/70 opacity-0 group-hover:opacity-100"
                    }`}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      item.priority ? "fill-white" : ""
                    }`}
                  />
                </button>
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      )}

      <ContinueButton disabled={!unlocked} />
    </div>
  );
}

