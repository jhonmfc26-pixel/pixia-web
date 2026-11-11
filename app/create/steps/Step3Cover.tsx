"use client";

import { useEffect, useMemo, useState } from "react";
import { useWizard, type CoverDraft } from "@/components/create/WizardProvider";
import ContinueButton from "@/components/create/ContinueButton";
import CoverPage from "@/core/modules/viewer/pages/CoverPage";
import { COVER_TEMPLATES, getDefaultTemplate, getTemplateById, getTemplatesForOccasion, type CoverTemplate } from "@/core/modules/cover/coverTemplates";
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

type Pos = CoverConfig["textPosition"];
type Align = CoverConfig["textAlign"];
const POSITIONS: Pos[] = ["top", "center", "bottom"];
const ALIGNS: Align[] = ["left", "center", "right"];
const POS_LABEL: Record<Pos, string> = { top: "Arriba", center: "En el centro", bottom: "Abajo" };
const ALIGN_LABEL: Record<Align, string> = { left: "a la izquierda", center: "centrado", right: "a la derecha" };
const COLORS: { id: CoverConfig["textColor"]; label: string }[] = [
  { id: "auto", label: "Automático" },
  { id: "light", label: "Blanco" },
  { id: "dark", label: "Negro" },
];

/**
 * Estilos que se ofrecen: primero los de la ocasión y después otros distintos
 * (fuente, sombra o posición) hasta 4, para que siempre haya de dónde elegir.
 */
function styleOptions(occasion: OccasionType): CoverTemplate[] {
  const own = getTemplatesForOccasion(occasion);
  const sig = (t: CoverTemplate) => `${t.titleFont}|${t.titleWeight}|${t.overlayStyle}|${t.defaultPosition}`;
  const seen = new Set(own.map(sig));
  const rest = COVER_TEMPLATES.filter((t) => t.occasion !== occasion && !seen.has(sig(t)) && seen.add(sig(t)));
  return [...own, ...rest].slice(0, 4);
}

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
  const styles = useMemo(() => styleOptions(occasion), [occasion]);
  const template = getTemplateById(cover.templateId ?? "") ?? getDefaultTemplate(occasion);
  const config: CoverConfig = {
    photoId: photo.id,
    templateId: template.id,
    title: cover.title || titleForOccasion(story),
    subtitle: cover.subtitle,
    date: cover.date,
    textPosition: cover.textPosition ?? template.defaultPosition,
    textAlign: cover.textAlign ?? template.defaultAlign,
    textColor: cover.textColor ?? "auto",
  };
  // Elegir un estilo trae su posición recomendada; el cliente la puede mover después.
  const pickStyle = (t: CoverTemplate) =>
    update({ templateId: t.id, textPosition: t.defaultPosition, textAlign: t.defaultAlign });
  const setDesign = (patch: Partial<Pick<CoverConfig, "textPosition" | "textAlign" | "textColor">>) =>
    update({ templateId: template.id, textPosition: config.textPosition, textAlign: config.textAlign, textColor: config.textColor, ...patch });
  const aspect = format.widthCm / format.heightCm;
  const thumbUrl = thumbs.get(cover.photoId)?.url ?? coverUrl;

  const field = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-white/30 outline-none transition focus:border-[var(--brand-coral)] focus:bg-white/[0.06]";

  return (
    <div className="w-full">
      <div className="mb-10 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-normal text-white md:text-5xl">
          Ponle nombre a tu historia
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-white/60">
          Escribe el título, elige la foto y el estilo. Lo que ves es lo que se imprime.
        </p>
      </div>

      <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Tapa en vivo + cómo se ve: todo lo que cambia el diseño va pegado a la tapa. */}
        <div className="w-full md:sticky md:top-24 md:order-2">
          {/* Alto limitado: en el celular la tapa vertical llenaba la pantalla y
              tapaba todo lo demás. */}
          <div
            className="mx-auto w-[min(100%,440px,calc(44svh*var(--ar)))] md:w-[min(100%,440px,calc(58svh*var(--ar)))]"
            style={{ ["--ar" as string]: aspect }}
          >
            <div className="overflow-hidden rounded-[6px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]">
              {photo.url && <CoverPage photo={photo} cover={config} style="con-margen" format={format.blueprintFormat} />}
            </div>
            <p className="mt-2 text-center text-xs text-white/40">Álbum {format.name.toLowerCase()} · Tapa dura · {format.sizeLabel}</p>
          </div>

          <div className="mx-auto mt-5 max-w-[440px] space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div>
              <span className="mb-2 block text-sm text-white/70">Estilo</span>
              <div className="grid grid-cols-4 gap-2">
                {styles.map((t) => {
                  const on = t.id === template.id;
                  return (
                    <button key={t.id} type="button" onClick={() => pickStyle(t)} aria-pressed={on}
                      className={`group rounded-lg p-1 text-center transition ${on ? "bg-[var(--brand-coral)]/15 ring-2 ring-[var(--brand-coral)]" : "ring-1 ring-white/10 hover:ring-white/30"}`}>
                      <div className="pointer-events-none overflow-hidden rounded-[4px]">
                        <CoverPage
                          photo={{ id: "mini", url: thumbUrl } as PhotoAsset}
                          cover={{ ...config, templateId: t.id, textPosition: t.defaultPosition, textAlign: t.defaultAlign, subtitle: "", date: "" }}
                          style="con-margen" format={format.blueprintFormat}
                        />
                      </div>
                      <span className={`mt-1 block truncate text-[11px] ${on ? "text-[var(--brand-coral)]" : "text-white/50"}`}>{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div>
                <span className="mb-2 block text-sm text-white/70">Dónde va el texto</span>
                {/* Mini tapa con 9 puntos: se toca donde se quiere el texto. */}
                <div
                  role="radiogroup" aria-label="Dónde va el texto"
                  className="grid w-[92px] grid-cols-3 grid-rows-3 gap-1 rounded-md border border-white/15 bg-white/[0.04] p-1.5"
                  style={{ aspectRatio: String(aspect) }}
                >
                  {POSITIONS.flatMap((pos) => ALIGNS.map((al) => {
                    const on = config.textPosition === pos && config.textAlign === al;
                    return (
                      <button key={`${pos}-${al}`} type="button" role="radio" aria-checked={on}
                        aria-label={`${POS_LABEL[pos]} ${ALIGN_LABEL[al]}`}
                        onClick={() => setDesign({ textPosition: pos, textAlign: al })}
                        className={`flex items-center rounded-[3px] transition ${al === "left" ? "justify-start" : al === "right" ? "justify-end" : "justify-center"} ${on ? "bg-[var(--brand-coral)]/25" : "hover:bg-white/10"}`}>
                        <span className={`block h-[3px] rounded-full ${on ? "w-4 bg-[var(--brand-coral)]" : "w-2 bg-white/30"}`} />
                      </button>
                    );
                  }))}
                </div>
                <span className="mt-1.5 block text-[11px] text-white/45">{POS_LABEL[config.textPosition]} {ALIGN_LABEL[config.textAlign]}</span>
              </div>
              <div className="min-w-0 flex-1">
                <span className="mb-2 block text-sm text-white/70">Color del texto</span>
                <div className="flex flex-col gap-1.5">
                  {COLORS.map((c) => {
                    const on = config.textColor === c.id;
                    return (
                      <button key={c.id} type="button" onClick={() => setDesign({ textColor: c.id })} aria-pressed={on}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition ${on ? "border-[var(--brand-coral)] bg-[var(--brand-coral)]/10 text-white" : "border-white/10 text-white/60 hover:border-white/25"}`}>
                        <span className={`h-3.5 w-3.5 shrink-0 rounded-full border border-white/30 ${c.id === "light" ? "bg-white" : c.id === "dark" ? "bg-[#1a1a1a]" : "bg-gradient-to-br from-white to-[#1a1a1a]"}`} />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-white/40">Así queda tu tapa. Después, en el editor, también puedes mover la foto.</p>
          </div>
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
