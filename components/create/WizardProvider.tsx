"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
} from "react";

/* =======================
   TYPES
======================= */

export type PhotoItem = {
  id: string;
  file: File;
  priority: boolean;
  /** SHA-256 del contenido del archivo — usado para deduplicar uploads. */
  contentHash?: string;
};

export type CoverDraft = {
  title: string;
  subtitle: string;
  date: string;
  /** id (PhotoItem.id) de la foto de portada. Por id y no por posición: sobrevive a reordenar o quitar fotos. */
  photoId: string;
};

/** Pasos del asistente. La barra de progreso y el reducer salen de acá. */
export const WIZARD_STEPS = [
  { id: 1, label: "Historia" },
  { id: 2, label: "Fotos" },
  { id: 3, label: "Tu portada" },
] as const;

type WizardState = {
  step: number;
  storyType?: string;
  photos: PhotoItem[];
  cover?: CoverDraft;
};

type WizardAction =
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_STORY_TYPE"; payload: string }
  | { type: "SET_PHOTOS"; payload: PhotoItem[] }
  | { type: "SET_COVER"; payload: CoverDraft };

/* =======================
   INITIAL STATE
======================= */

const initialState: WizardState = {
  step: 1,
  photos: [],
};

/* =======================
   REDUCER
======================= */

function wizardReducer(
  state: WizardState,
  action: WizardAction
): WizardState {
  switch (action.type) {
    case "NEXT_STEP":
      return { ...state, step: Math.min(state.step + 1, WIZARD_STEPS.length) };
    case "PREV_STEP":
      return { ...state, step: Math.max(state.step - 1, 1) };
    case "SET_STORY_TYPE":
      return { ...state, storyType: action.payload };
    case "SET_PHOTOS":
      return { ...state, photos: action.payload };
    case "SET_COVER":
      return { ...state, cover: action.payload };
    default:
      return state;
  }
}

/* =======================
   CONTEXT
======================= */

const WizardContext = createContext<{
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
} | null>(null);

/* =======================
   PROVIDER
======================= */

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  // Auto-scroll suave al cambiar de step
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.step]);

  return (
    <WizardContext.Provider value={{ state, dispatch }}>
      {children}
    </WizardContext.Provider>
  );
}

/* =======================
   HOOK
======================= */

export function useWizard() {
  const context = useContext(WizardContext);

  if (!context) {
    throw new Error("useWizard must be used within WizardProvider");
  }

  return context;
}
