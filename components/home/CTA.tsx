"use client";

import { ArrowRight } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import Link from "next/link";

export default function CTA() {
  return (
    <section className="py-28 bg-black relative overflow-hidden">
      {/* Glow sutil de fondo */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-transparent to-orange-400/10" />

      <div className="relative max-w-5xl mx-auto px-6 text-center">
        <Reveal>
          <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
            Tu historia merece ser recordada para siempre
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="text-gray-400 max-w-2xl mx-auto mb-8">
            Convierte tus fotos en un libro físico, diseñado por IA, que podrás
            conservar, regalar y revivir toda la vida.
          </p>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-10 text-sm text-gray-400">
            <span>✔ En menos de 5 minutos</span>
            <span>✔ Todos los medios de pago</span>
            <span>✔ Calidad premium de impresión</span>
          </div>
        </Reveal>

        <Reveal delay={0.35}>
          <Link href="/create">
            <button
              className="group inline-flex items-center gap-3 px-10 py-4 rounded-full text-white font-semibold text-lg
              bg-gradient-to-r from-[#FF7A18] via-[#FF4D8D] to-[#FF2D95]
              shadow-[0_0_40px_rgba(255,77,141,0.35)]
              hover:shadow-[0_0_60px_rgba(255,77,141,0.55)]
              transition-all duration-300 hover:scale-[1.04]"
            >
              Crear mi álbum ahora
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
          </Link>
        </Reveal>

        <Reveal delay={0.5}>
          <p className="mt-5 text-xs text-gray-500">
            Tus datos están seguros · Listo en minutos
          </p>
        </Reveal>
      </div>
    </section>
  );
}
