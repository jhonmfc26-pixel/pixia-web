"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useWizard } from "@/components/create/WizardProvider";
import ContinueButton from "@/components/create/ContinueButton";
import { FORMATS, formatCop, idealFormat, type AlbumFormat } from "@/lib/formats";
import { PRICING } from "@/lib/wompi";

const stories = [
  { id: "wedding", title: "Boda", image: "/story/wedding.jpg" },
  { id: "honeymoon", title: "Luna de miel", image: "/story/honeymoon.jpg" },
  { id: "trip", title: "Viaje", image: "/story/trip.jpg" },
  { id: "anniversary", title: "Aniversario", image: "/story/anniversary.jpg" },
  { id: "kids", title: "Niños y bebés", image: null },
  { id: "other", title: "Otra historia", image: "/story/other.jpg" },
];

/** Cómo se nombra el momento en la frase "ideal para …". */
const STORY_NOUN: Record<string, string> = {
  wedding: "bodas", honeymoon: "lunas de miel", trip: "viajes",
  anniversary: "aniversarios", kids: "niños y bebés", other: "tu historia",
};

/**
 * Paso 1: el momento y el tamaño. Al elegir el momento, Pixia preselecciona
 * el tamaño ideal (bodas → 30×30, niños → 20×20, viajes → vertical) y el
 * cliente puede cambiarlo. Solo 3 tamaños.
 */
export default function Step1Story() {
  const { state, dispatch } = useWizard();
  const sizesRef = useRef<HTMLDivElement>(null);
  const picked = useRef(false);

  const handleSelect = (id: string) => {
    picked.current = true;
    dispatch({ type: "SET_STORY_TYPE", payload: id });
  };

  // Al elegir el momento, llevar la vista a los tamaños (en celular quedan abajo).
  useEffect(() => {
    if (!picked.current || !state.storyType) return;
    picked.current = false;
    sizesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.storyType]);

  const ideal = state.storyType ? idealFormat(state.storyType) : null;
  const noun = STORY_NOUN[state.storyType ?? ""] ?? "tu historia";

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-normal text-white md:text-5xl">
          ¿Qué historia quieres contar?
        </h1>
        <p className="text-white/60 mt-2 max-w-xl mx-auto">
          Elige el momento y te sugerimos el tamaño ideal para tu álbum.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-6">
        {stories.map((story) => {
          const isSelected = state.storyType === story.id;
          return (
            <motion.button
              type="button"
              key={story.id}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleSelect(story.id)}
              aria-pressed={isSelected}
              className={`relative h-[120px] md:h-[170px] rounded-2xl overflow-hidden cursor-pointer text-left transition-all
                ${isSelected
                  ? "ring-2 ring-[var(--brand-coral)] shadow-[0_0_35px_rgba(232,85,58,0.45)]"
                  : "ring-1 ring-white/10 hover:ring-white/30"}`}
            >
              {story.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={story.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <KidsArt />
              )}
              <div className={`absolute inset-0 ${story.image ? "bg-black/40" : "bg-gradient-to-t from-black/50 via-black/10 to-transparent"}`} />
              <div className="relative z-10 h-full flex items-end p-4 md:p-5">
                <span className="text-base md:text-lg font-semibold text-white">{story.title}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {state.storyType && ideal && (
        <motion.section
          ref={sizesRef}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-12 md:mt-16"
          aria-labelledby="tamano-titulo"
        >
          <div className="text-center mb-6">
            <h2 id="tamano-titulo" className="font-[family-name:var(--font-display)] text-2xl font-normal text-white md:text-3xl">
              ¿De qué tamaño?
            </h2>
            <p className="text-white/60 mt-2 text-sm md:text-base">
              Tapa dura en los tres. Puedes cambiar el que te sugerimos.
            </p>
          </div>

          <div role="radiogroup" aria-labelledby="tamano-titulo" className="grid grid-cols-3 gap-2 md:gap-4">
            {FORMATS.map((f) => (
              <SizeCard
                key={f.id}
                format={f}
                selected={state.format === f.id}
                suggested={ideal.id === f.id && f.available}
                onSelect={() => dispatch({ type: "SET_FORMAT", payload: f.id })}
              />
            ))}
          </div>

          <p className="mt-4 text-center text-xs text-white/45">
            {!ideal.available && (
              <span className="block mb-1.5 text-white/60">
                Para {noun} el ideal es el {ideal.name.toLowerCase()} {ideal.sizeLabel}, que llega muy pronto.
              </span>
            )}
            Incluye {PRICING.pagesIncluded} páginas y envío a toda Colombia · Página adicional {formatCop(PRICING.extraPagePriceCop)}
          </p>
        </motion.section>
      )}

      <ContinueButton disabled={!state.storyType}>Continuar</ContinueButton>
    </div>
  );
}

/** Escala común: los tres libros se ven del tamaño real entre ellos. */
const PX_PER_CM = 2.6;

function SizeCard({ format: f, selected, suggested, onSelect }: {
  format: AlbumFormat; selected: boolean; suggested: boolean; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={!f.available}
      disabled={!f.available}
      onClick={onSelect}
      className={`relative flex flex-col items-center rounded-2xl px-2 pb-4 pt-6 text-center transition
        ${selected ? "bg-white/[0.07] ring-2 ring-[var(--brand-coral)]" : "bg-white/[0.03] ring-1 ring-white/10"}
        ${f.available ? "cursor-pointer hover:bg-white/[0.06]" : "cursor-not-allowed opacity-45"}`}
    >
      {suggested && (
        <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[var(--brand-coral)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-white">
          Sugerido
        </span>
      )}

      <div className="flex h-[78px] items-end justify-center" aria-hidden>
        <div
          className="relative rounded-[2px] shadow-[0_10px_20px_-8px_rgba(0,0,0,0.7)]"
          style={{
            width: f.widthCm * PX_PER_CM,
            height: f.heightCm * PX_PER_CM,
            background: "linear-gradient(135deg, #3a332d, #26211d)",
          }}
        >
          <span className="absolute inset-y-0 left-[4px] w-px bg-white/15" />
        </div>
      </div>

      <span className="mt-3 text-sm font-medium text-white">{f.name}</span>
      <span className="text-[11px] text-white/55 md:text-xs">{f.sizeLabel}</span>
      <span className={`mt-1.5 text-sm ${f.available ? "text-white" : "text-white/60"}`}>
        {f.available ? formatCop(f.priceCop) : "Muy pronto"}
      </span>
    </button>
  );
}

/** Fondo de la tarjeta "Niños y bebés" (no hay foto de stock para este momento). */
function KidsArt() {
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice" aria-hidden
      className="absolute inset-0 w-full h-full">
      <defs>
        <linearGradient id="kids-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F6D3B8" />
          <stop offset="1" stopColor="#EFAE8C" />
        </linearGradient>
      </defs>
      <rect width="100" height="60" fill="url(#kids-sky)" />
      <circle cx="74" cy="18" r="8" fill="#FBE3A0" />
      <path d="M12 20 q4 -5 9 -1 q4 -4 8 0 q5 1 3 4 h-21 q-3 -2 1 -3z" fill="#fff" opacity=".9" />
      <path d="M44 12 q3 -4 7 -1 q3 -3 6 0 q4 1 2 3 h-16 q-2 -1 1 -2z" fill="#fff" opacity=".75" />
      <path d="M0 42 Q25 33 50 40 T100 36 V60 H0z" fill="#D98466" />
      <path d="M0 50 Q30 42 60 47 T100 45 V60 H0z" fill="#B8654D" />
    </svg>
  );
}
