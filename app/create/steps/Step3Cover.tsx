"use client";

import { useEffect, useMemo, useState } from "react";
import { useWizard, type CoverDraft } from "@/components/create/WizardProvider";
import ContinueButton from "@/components/create/ContinueButton";
import CoverPage from "@/core/modules/viewer/pages/CoverPage";
import { getDefaultTemplate, galleryTemplates, type CoverTemplate } from "@/core/modules/cover/coverTemplates";
import { applyTemplate, resolveCover, DESIGN_KEYS } from "@/core/modules/cover/coverDesign";
import { useCoverDesigns } from "@/core/modules/cover/useCoverDesigns";
import { countryInTitle, designToCover, sortDesigns, type CoverDesign } from "@/lib/coverDesigns";
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
  const update = (patch: Partial<CoverDraft>) => dispatch({ type: "SET_COVER", payload: { ...cover, ...patch } });

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
  // Portada actual como CoverConfig: lo del borrador sobre la plantilla por defecto.
  const base: CoverConfig = {
    photoId: photo.id,
    templateId: getDefaultTemplate(occasion).id,
    title: cover.title || titleForOccasion(story),
    subtitle: cover.subtitle,
    date: cover.date,
    textPosition: getDefaultTemplate(occasion).defaultPosition,
    textAlign: getDefaultTemplate(occasion).defaultAlign,
    textColor: "auto",
  };
  const design = Object.fromEntries(DESIGN_KEYS.filter((k) => cover[k] !== undefined).map((k) => [k, cover[k]]));
  const config: CoverConfig = { ...base, ...design };
  const kind = resolveCover(config).kind;
  const [galleryKind, setGalleryKind] = useState<"photo" | "graphic">(kind);
  // Catálogo del admin primero (en viajes, los del país que aparece en el
  // título), después las plantillas propias; 8 en total.
  const designs = useCoverDesigns();
  const titleForMatch = cover.title || "";
  const catalog = useMemo(() => {
    if (galleryKind !== "graphic") return [];
    const countries = designs.filter((d) => d.country).map((d) => d.country as string);
    const country = story === "trip" || story === "honeymoon" ? countryInTitle(titleForMatch, countries) : undefined;
    return sortDesigns(designs, occasion, country).filter((d) => d.occasion === occasion).slice(0, 6);
  }, [designs, galleryKind, occasion, story, titleForMatch]);
  const gallery = useMemo(() => galleryTemplates(occasion, galleryKind).slice(0, 8 - catalog.length), [occasion, galleryKind, catalog.length]);
  const pickDesign = (d: CoverDesign) => {
    const next = { ...config, ...designToCover(d) };
    update(Object.fromEntries(DESIGN_KEYS.map((k) => [k, next[k]])) as Partial<CoverDraft>);
  };
  const pickTemplate = (t: CoverTemplate) => {
    const next = applyTemplate(config, t);
    update(Object.fromEntries(DESIGN_KEYS.map((k) => [k, next[k]])) as Partial<CoverDraft>);
  };
  const aspect = format.widthCm / format.heightCm;
  const thumbUrl = thumbs.get(cover.photoId)?.url ?? coverUrl;

  const field = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-white/30 outline-none transition focus:border-[var(--brand-coral)] focus:bg-white/[0.06]";

  return (
    <div className="w-full">
      <div className="mb-6 text-center md:mb-10">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-normal text-white md:text-5xl">
          Ponle nombre a tu historia
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-white/60">
          Escribe el título y elige el diseño de la tapa. Lo que ves es lo que se imprime.
        </p>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
        {/* Tapa en vivo. En el computador las opciones tienen su propio
            scroll y la tapa queda quieta y entera a la vista (antes con
            sticky, que no funcionaba dentro del <main> del asistente: al
            bajar, la tapa se cortaba). En el celular va arriba con la
            galería justo debajo. */}
        <div className="w-full">
          <div
            className="mx-auto w-[min(100%,440px,calc(40svh*var(--ar)))] md:w-[min(100%,480px,calc((100svh-400px)*var(--ar)))]"
            style={{ ["--ar" as string]: aspect }}
          >
            <div className="overflow-hidden rounded-[6px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]">
              {(photo.url || kind === "graphic") && <CoverPage photo={photo} cover={config} style="con-margen" format={format.blueprintFormat} />}
            </div>
            <p className="mt-2 text-center text-xs text-white/40">Álbum {format.name.toLowerCase()} · Tapa dura · {format.sizeLabel}</p>
          </div>
        </div>

        <div className="space-y-7 md:max-h-[calc(100svh-390px)] md:overflow-y-auto md:overscroll-contain md:pr-2">
          {/* Diseño: galería de plantillas con la foto y el título del cliente. */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm text-white/70">Diseño de la tapa</span>
              <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-[12px]">
                {(["photo", "graphic"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setGalleryKind(k)}
                    className={`rounded-full px-3 py-1.5 transition ${galleryKind === k ? "bg-white text-black" : "text-white/60 hover:text-white"}`}>
                    {k === "photo" ? "Con foto" : "Sin foto"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {catalog.map((d) => {
                const on = config.designId === d.id;
                return (
                  <button key={d.id} type="button" onClick={() => pickDesign(d)} aria-pressed={on}
                    className={`rounded-lg p-1 text-center transition ${on ? "bg-[var(--brand-coral)]/15 ring-2 ring-[var(--brand-coral)]" : "ring-1 ring-white/10 hover:ring-white/30"}`}>
                    <div className="pointer-events-none overflow-hidden rounded-[4px]">
                      <CoverPage photo={photo} cover={{ ...config, subtitle: "", date: "", ...designToCover(d) }} style="con-margen" format={format.blueprintFormat} />
                    </div>
                    <span className={`mt-1 block truncate text-[11px] ${on ? "text-[var(--brand-coral)]" : "text-white/50"}`}>{d.name}</span>
                  </button>
                );
              })}
              {gallery.map((t) => {
                const on = t.id === config.templateId && !config.designId;
                return (
                  <button key={t.id} type="button" onClick={() => pickTemplate(t)} aria-pressed={on}
                    className={`rounded-lg p-1 text-center transition ${on ? "bg-[var(--brand-coral)]/15 ring-2 ring-[var(--brand-coral)]" : "ring-1 ring-white/10 hover:ring-white/30"}`}>
                    <div className="pointer-events-none overflow-hidden rounded-[4px]">
                      <CoverPage
                        photo={{ id: "mini", url: thumbUrl } as PhotoAsset}
                        cover={applyTemplate({ ...config, subtitle: "", date: "" }, t)}
                        style="con-margen" format={format.blueprintFormat}
                      />
                    </div>
                    <span className={`mt-1 block truncate text-[11px] ${on ? "text-[var(--brand-coral)]" : "text-white/50"}`}>{t.name}</span>
                  </button>
                );
              })}
            </div>
            {/* Que el cliente sepa que esto es solo el comienzo: lo completo
                está en el estudio de portada, después de crear el álbum. */}
            <div className="mt-3 flex gap-3 rounded-xl border border-[var(--brand-coral)]/30 bg-[var(--brand-coral)]/[0.08] px-3.5 py-3">
              <span aria-hidden className="mt-0.5 text-[15px] text-[var(--brand-coral)]">✦</span>
              <p className="text-[13px] leading-relaxed text-white/75">
                <strong className="font-medium text-white">Después la puedes personalizar toda:</strong> más letras, colores,
                ilustraciones, el lomo y la contraportada. Cuando veas tu álbum, toca <span className="text-white">Editar portada</span>.
              </p>
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm text-white/70">{config.titleInArt ? "Nombre del álbum" : "Título"}</span>
            {config.titleInArt && (
              <span className="mb-2 block text-[12px] text-white/45">Este diseño ya trae el título dibujado: este nombre va en el lomo. Si quieres, agrega el año en «Fecha o lugar».</span>
            )}
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

          {kind === "photo" && ordered.length > 1 && (
            <div>
              <span className="mb-2 flex items-baseline justify-between text-sm text-white/70">
                Foto de portada
                <span className="text-xs text-white/35">{ordered.length} fotos</span>
              </span>
              {/* Safari (iPhone) aplastaba las filas de esta grilla con muchas
                  fotos (se veían encimadas con 67): el scroll va en un
                  contenedor aparte y cada celda es cuadrada con padding-top
                  (no aspect-ratio), que Safari respeta siempre. */}
              <div className="max-h-[288px] overflow-y-auto overscroll-contain">
              <div className="grid grid-cols-4 gap-2 p-1 sm:grid-cols-5">
                {ordered.map((p, n) => (
                  <button key={p.id} type="button" onClick={() => update({ photoId: p.id })}
                    aria-label={`Usar la foto ${n + 1} como portada`} aria-pressed={cover.photoId === p.id}
                    className={`relative block w-full overflow-hidden rounded-lg pt-[100%] ring-2 ring-offset-2 ring-offset-[var(--bg-base)] transition ${cover.photoId === p.id ? "ring-[var(--brand-coral)]" : "ring-transparent opacity-70 hover:opacity-100"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbs.get(p.id)?.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    {p.priority && <span aria-hidden className="absolute right-1 top-1 text-[11px] drop-shadow">★</span>}
                  </button>
                ))}
              </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ContinueButton isFinalStep disabled={!cover.title.trim()}>Crear mi álbum</ContinueButton>
    </div>
  );
}
