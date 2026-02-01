import { LayoutDefinition } from "./types";

/* ─────────────────────────
   LAYOUT 1 — FULL BLEED
───────────────────────── */
export const FULL_BLEED_LAYOUT: LayoutDefinition = {
  id: "full-bleed",
  name: "Full Bleed Cinemático",
  intent: "cinematic",
  ratio: 3 / 4,
  slots: [
    {
      id: "main",
      role: "primary",
      area: { x: 0, y: 0, width: 1, height: 1 },
    },
  ],
  rules: {
    allowCrop: true,
    weight: {
      orientation: 0.4,
      resolution: 0.4,
      aspectRatio: 0.2,
    },
  },
};

/* ─────────────────────────
   LAYOUT 2 — RETRATO
───────────────────────── */
export const PORTRAIT_FOCUS_LAYOUT: LayoutDefinition = {
  id: "portrait-focus",
  name: "Retrato Narrativo",
  intent: "portrait",
  ratio: 3 / 4,
  slots: [
    {
      id: "main",
      role: "primary",
      area: { x: 0.15, y: 0.1, width: 0.7, height: 0.8 },
      preferredOrientation: "vertical",
    },
  ],
  rules: {
    preferredOrientation: "vertical",
    allowCrop: true,
    weight: {
      orientation: 0.5,
      resolution: 0.3,
      aspectRatio: 0.2,
    },
  },
};

/* ─────────────────────────
   LAYOUT 3 — SPLIT
───────────────────────── */
export const SPLIT_NARRATIVE_LAYOUT: LayoutDefinition = {
  id: "split-narrative",
  name: "Narrativa Doble",
  intent: "narrative",
  ratio: 3 / 4,
  slots: [
    {
      id: "primary",
      role: "primary",
      area: { x: 0, y: 0, width: 1, height: 0.6 },
      preferredOrientation: "horizontal",
    },
    {
      id: "secondary",
      role: "secondary",
      area: { x: 0.1, y: 0.65, width: 0.8, height: 0.25 },
    },
  ],
  rules: {
    allowCrop: true,
    weight: {
      orientation: 0.3,
      resolution: 0.3,
      aspectRatio: 0.4,
    },
  },
};

/* ─────────────────────────
   EXPORT ALL (ÚNICO)
───────────────────────── */
export const ALL_LAYOUTS: LayoutDefinition[] = [
  FULL_BLEED_LAYOUT,
  PORTRAIT_FOCUS_LAYOUT,
  SPLIT_NARRATIVE_LAYOUT,
];
