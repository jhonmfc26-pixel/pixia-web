"use client";

import { useEffect, useMemo, useState } from "react";
import { useWizard } from "@/components/create/WizardProvider";
import ContinueButton from "@/components/create/ContinueButton";
import CoverPage from "@/core/modules/viewer/pages/CoverPage";
import { getDefaultTemplate } from "@/core/modules/cover/coverTemplates";
import { occasionFromStory, titleForOccasion } from "@/core/engine/buildPixiaBook";
import { readPhotoAnalysis, type PhotoAnalysisEntry } from "@/core/modules/upload/photoSession";
import { getFormat } from "@/lib/formats";
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
  kids: { subtitle: "Sofía", date: "Su primer año · 2026" },
  other: { subtitle: "La familia Rojas", date: "2026" },
};

export default function Step3Cover() {
  const { state, dispatch } = useWizard();
  const story = state.storyType ?? "other";
  const occasion = occasionFromStory(story) as OccasionType;
  const ph = PLACEHOLDERS[story] ?? PLACEHOLDERS.other;
  const format = getFormat(state.format);

  // Análisis del paso 2 (dimensiones, score, miniatura), por id de foto. Se lee una vez.
  const [analysis] = useState<Map<string, PhotoAnalysisEntry>>(() =>
    typeof window === "undefined" ? new Map() : readPhotoAnalysis(),
  );

  // TODAS las fotos como opción de portada: primero las ★, después las de mejor score.
  const ordered = useMemo(() => {
    const score = (id: string) => analysis.get(id)?.score?.finalScore ?? 0;
    return [...state.photos].sort(
      (a, b) => Number(b.priority) - Number(a.priority) || score(b.id) - score(a.id),
    );
  }, [state.photos, analysis]);

  const validId = (id?: string) => !!id && state.photos.some((p) => p.id === id);
  const cover = state.cover && validId(state.cover.photoId)
    ? state.cover
    : {
        title: state.cover?.title ?? titleForOccasion(story),
        subtitle: state.cover?.subtitle ?? "",
        date: state.cover?.date ?? "",
        photoId: ordered[0]?.id ?? "",
      };
  useEffect(() => {
    // Deja la portada por defecto en el estado (o la corrige si la foto elegida se quitó).
    if (!state.cover || state.cover.photoId !== cover.photoId) dispatch({ type: "SET_COVER", payload: cover });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover.photoId]);
  const update = (patch: Partial<typeof cover>) => dispatch({ type: "SET_COVER", payload: { ...cover, ...patch } });

  // Tapa en vivo: el archivo original de la foto elegida (una sola URL local).
  const coverFile = state.photos.find((p) => p.id === cover.photoId)?.file;
  const coverUrl = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : ""), [coverFile]);
  useEffect(() => () => { if (coverUrl) URL.revokeObjectURL(coverUrl); }, [coverUrl]);

  // Grilla: miniaturas livianas del análisis; si alguna falta, URL local del archivo.
  const thumbs = useMemo(() => {
    const map = new Map<string, { url: string; local: boolean }>();
    for (const p of state.photos) {
      const t = analysis.get(p.id)?.thumbnail;
      map.set(p.id, t ? { url: t, local: false } : { url: URL.createObjectURL(p.file), local: true });
    }
    return map;
  }, [state.photos, analysis]);
  useEffect(() => () => thumbs.forEach((t) => t.local && URL.revokeObjectURL(t.url)), [thumbs]);

  const meta = analysis.get(cover.photoId);
  const photo = {
    id: "cover-preview",
    url: coverUrl,
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
            {photo.url && <CoverPage photo={photo} cover={config} style="con-margen" format={format.blueprintFormat} />}
          </div>
          <p className="mt-3 text-center text-xs text-white/40">Álbum {format.name.toLowerCase()} · Tapa dura · {format.sizeLabel}</p>
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

          {ordered.length > 1 && (
            <div>
              <span className="mb-2 flex items-baseline justify-between text-sm text-white/70">
                Foto de portada
                <span className="text-xs text-white/35">{ordered.length} fotos</span>
              </span>
              <div className="grid max-h-[288px] grid-cols-4 gap-2 overflow-y-auto overscroll-contain p-1 sm:grid-cols-5">
                {ordered.map((p, n) => (
                  <button key={p.id} type="button" onClick={() => update({ photoId: p.id })}
                    aria-label={`Usar la foto ${n + 1} como portada`} aria-pressed={cover.photoId === p.id}
                    className={`relative aspect-square overflow-hidden rounded-lg ring-2 ring-offset-2 ring-offset-[var(--bg-base)] transition ${cover.photoId === p.id ? "ring-[var(--brand-coral)]" : "ring-transparent opacity-70 hover:opacity-100"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbs.get(p.id)?.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {p.priority && <span aria-hidden className="absolute right-1 top-1 text-[11px] drop-shadow">★</span>}
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
