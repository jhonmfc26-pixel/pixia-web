"use client";

import { useEffect, useMemo, useState } from "react";
import { useWizard } from "@/components/create/WizardProvider";
import ContinueButton from "@/components/create/ContinueButton";
import CoverPage from "@/core/modules/viewer/pages/CoverPage";
import { getDefaultTemplate } from "@/core/modules/cover/coverTemplates";
import { occasionFromStory, titleForOccasion } from "@/core/engine/buildPixiaBook";
import type { CoverConfig, OccasionType, PhotoAsset } from "@/core/contracts/AlbumBlueprint";

/**
 * Paso final: el cliente le pone nombre a su historia y ve la tapa en vivo.
 * Es el momento más emocional del flujo — antes la portada salía "Mi álbum
 * Pixia" sin preguntar nada.
 */

const LIMITS = { title: 40, subtitle: 40, date: 32 };

const PLACEHOLDERS: Record<string, { subtitle: string; date: string }> = {
  wedding: { subtitle: "Laura & Andrés", date: "Villa de Leyva · 14.06.2026" },
  honeymoon: { subtitle: "Laura & Andrés", date: "Santorini · 2026" },
  trip: { subtitle: "Familia Gómez", date: "Perú · Agosto 2026" },
  anniversary: { subtitle: "10 años juntos", date: "2016 — 2026" },
  other: { subtitle: "La familia Rojas", date: "2026" },
};

interface AnalysisEntry {
  originalIndex: number;
  width?: number;
  height?: number;
  score?: { finalScore?: number } | null;
}

function readAnalysis(): AnalysisEntry[] {
  try {
    const raw = localStorage.getItem("pixia_photo_analysis");
    return raw ? (JSON.parse(raw) as AnalysisEntry[]) : [];
  } catch {
    return [];
  }
}

export default function Step3Cover() {
  const { state, dispatch } = useWizard();
  const story = state.storyType ?? "other";
  const occasion = occasionFromStory(story) as OccasionType;
  const ph = PLACEHOLDERS[story] ?? PLACEHOLDERS.other;

  // Análisis del paso 2 (dimensiones y score de cada foto). Se lee una vez.
  const [analysis] = useState<AnalysisEntry[]>(() => (typeof window === "undefined" ? [] : readAnalysis()));
  const byIndex = useMemo(() => new Map(analysis.map((a) => [a.originalIndex, a])), [analysis]);

  // Candidatas a portada: primero las marcadas con ★, después las de mejor score.
  const candidates = useMemo(() => {
    const idx = state.photos.map((_, i) => i);
    const score = (i: number) => byIndex.get(i)?.score?.finalScore ?? 0;
    return idx
      .sort((a, b) => Number(state.photos[b].priority) - Number(state.photos[a].priority) || score(b) - score(a))
      .slice(0, 8);
  }, [state.photos, byIndex]);

  const cover = state.cover ?? {
    title: titleForOccasion(story),
    subtitle: "",
    date: "",
    photoIndex: candidates[0] ?? 0,
  };
  useEffect(() => {
    if (!state.cover) dispatch({ type: "SET_COVER", payload: cover });
    // solo la primera vez: deja la portada por defecto en el estado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const update = (patch: Partial<typeof cover>) => dispatch({ type: "SET_COVER", payload: { ...cover, ...patch } });

  // URLs locales de las miniaturas (se liberan al salir del paso).
  const urls = useMemo(() => {
    const map = new Map<number, string>();
    for (const i of new Set([...candidates, cover.photoIndex])) {
      const f = state.photos[i]?.file;
      if (f) map.set(i, URL.createObjectURL(f));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, state.photos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const meta = byIndex.get(cover.photoIndex);
  const photo = {
    id: "cover-preview",
    url: urls.get(cover.photoIndex) ?? "",
    width: meta?.width ?? 0,
    height: meta?.height ?? 0,
  } as PhotoAsset;
  const template = getDefaultTemplate(occasion);
  const config: CoverConfig = {
    photoId: photo.id,
    templateId: template.id,
    title: cover.title || titleForOccasion(story),
    subtitle: cover.subtitle,
    date: cover.date,
    textPosition: template.defaultPosition,
    textAlign: template.defaultAlign,
    textColor: "auto",
  };

  const field = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-white/30 outline-none transition focus:border-[var(--brand-coral)] focus:bg-white/[0.06]";

  return (
    <div className="w-full">
      <div className="mb-10 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-normal text-white md:text-5xl">
          Ponle nombre a tu historia
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-white/60">
          Así se verá la tapa de tu álbum. Podrás cambiarlo después, antes de pedirlo.
        </p>
      </div>

      <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Tapa en vivo */}
        <div className="mx-auto w-full max-w-[440px] md:order-2">
          <div className="overflow-hidden rounded-[6px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]">
            {photo.url && <CoverPage photo={photo} cover={config} style="con-margen" format="30x30" />}
          </div>
          <p className="mt-3 text-center text-xs text-white/40">Tapa dura · 30 × 30 cm</p>
        </div>

        {/* Formulario */}
        <div className="space-y-6 md:order-1">
          <label className="block">
            <span className="mb-2 block text-sm text-white/70">Título</span>
            <input className={field} value={cover.title} maxLength={LIMITS.title}
              placeholder={titleForOccasion(story)} onChange={(e) => update({ title: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/70">Nombres <span className="text-white/35">· opcional</span></span>
            <input className={field} value={cover.subtitle} maxLength={LIMITS.subtitle}
              placeholder={ph.subtitle} onChange={(e) => update({ subtitle: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/70">Fecha o lugar <span className="text-white/35">· opcional</span></span>
            <input className={field} value={cover.date} maxLength={LIMITS.date}
              placeholder={ph.date} onChange={(e) => update({ date: e.target.value })} />
          </label>

          {candidates.length > 1 && (
            <div>
              <span className="mb-2 block text-sm text-white/70">Foto de portada</span>
              <div className="grid grid-cols-4 gap-2">
                {candidates.map((i) => (
                  <button key={i} type="button" onClick={() => update({ photoIndex: i })}
                    aria-label={`Usar la foto ${i + 1} como portada`} aria-pressed={cover.photoIndex === i}
                    className={`aspect-square overflow-hidden rounded-lg ring-2 ring-offset-2 ring-offset-[var(--bg-base)] transition ${cover.photoIndex === i ? "ring-[var(--brand-coral)]" : "ring-transparent opacity-70 hover:opacity-100"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urls.get(i)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ContinueButton isFinalStep disabled={!cover.title.trim()}>Crear mi álbum</ContinueButton>
    </div>
  );
}
