"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AlbumMockup() {
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  const handleOpen = () => {
    setOpening(true);
    setTimeout(() => {
      router.push("/create/album");
    }, 850);
  };

  return (
    <section className="w-full flex justify-center py-28">
      <div
        className="relative cursor-pointer"
        style={{ perspective: 1600 }}
        onClick={handleOpen}
      >
        {/* CAPA HOVER 3D (SIEMPRE ACTIVA) */}
        <motion.div
          whileHover={{
            rotateX: 8,
            rotateY: -12,
            scale: 1.08,
          }}
          transition={{
            type: "spring",
            stiffness: 140,
            damping: 18,
          }}
          className="relative"
        >
          {/* CAPA DE APERTURA */}
          <AnimatePresence>
            {!opening && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  scale: 1.15,
                  opacity: 0,
                }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
                className="relative"
              >
                <Image
                  src="/story/album-cover.jpg"
                  alt="Portada del álbum Pixia"
                  width={480}
                  height={640}
                  priority
                  className="rounded-[32px] shadow-[0_110px_260px_rgba(0,0,0,0.85)]"
                />

                {/* Sombra flotante */}
                <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 w-[75%] h-12 bg-black/60 blur-3xl rounded-full" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* TEXTO */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 text-center text-white/60 text-sm tracking-wide"
        >
          Haz clic para abrir tu álbum
        </motion.p>
      </div>
    </section>
  );
}
