"use client";

import { createContext, useContext, useReducer, ReactNode } from "react";

type StoryType =
  | "wedding"
  | "honeymoon"
  | "trip"
  | "anniversary"
  | "other"
  | null;

type VisualStyle =
  | "cinematic"
  | "warm"
  | "bw"
  | "romantic"
  | "minimal"
  | "vintage"
  | null;

type Emotion =
  | "happy"
  | "romantic"
  | "nostalgic"
  | "epic"
  | "intimate"
  | "inspiring"
  | null;

type WizardState = {
  step: number;
  storyType: StoryType;
  style: VisualStyle;
  emotion: Emotion;
};

type WizardAction =
  | { type: "SET_STORY"; payload: StoryType }
  | { type: "SET_STYLE"; payload: VisualStyle }
  | { type: "SET_EMOTION"; payload: Emotion }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" };

const initialState: WizardState = {
  step: 1,
  storyType: null,
  style: null,
  emotion: null,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_STORY":
      return { ...state, storyType: action.payload };

    case "SET_STYLE":
      return { ...state, style: action.payload };

    case "SET_EMOTION":
      return { ...state, emotion: action.payload };

    case "NEXT_STEP":
      return { ...state, step: state.step + 1 };

    case "PREV_STEP":
      return { ...state, step: Math.max(1, state.step - 1) };

    default:
      return state;
  }
}

const WizardContext = createContext<{
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
} | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  return (
    <WizardContext.Provider value={{ state, dispatch }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizard must be used within WizardProvider");
  }
  return context;
}
