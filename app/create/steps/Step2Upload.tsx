"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import ContinueButton from "@/components/create/ContinueButton";

export default function Step2Upload() {
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles].slice(0, 30));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
  });

  return (
    <div className="w-full">
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-semibold text-white">
          Sube tus recuerdos
        </h1>
        <p className="text-white/60 mt-3 max-w-xl mx-auto">
          Estas imágenes se convertirán en una historia que podrás revivir siempre.
        </p>
      </div>

      <motion.div
        {...(getRootProps() as any)}
        whileHover={{ scale: 1.01 }}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
          ${
            isDragActive
              ? "border-pink-400 bg-pink-500/10 shadow-[0_0_40px_rgba(236,72,153,0.4)]"
              : "border-white/20 bg-white/5 hover:border-white/40"
          }`}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">📸</span>
          <p className="text-white font-medium">
            Arrastra tus fotos aquí o haz clic para subir
          </p>
          <p className="text-white/40 text-sm">
            {files.length} / 30 fotos
          </p>
        </div>
      </motion.div>

      {files.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-4 mt-8">
          {files.map((file, i) => (
            <div
              key={i}
              className="relative w-full h-24 rounded-lg overflow-hidden bg-white/10"
            >
              <img
                src={URL.createObjectURL(file)}
                alt="preview"
                className="object-cover w-full h-full"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center mt-10">
        <ContinueButton disabled={files.length < 5} />
      </div>
    </div>
  );
}
