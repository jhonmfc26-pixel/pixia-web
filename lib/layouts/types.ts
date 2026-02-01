export type LayoutSlot = {
  id: string;
  role: "primary" | "secondary";
  area: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  preferredOrientation?: "vertical" | "horizontal" | "square";
};

export type LayoutRules = {
  preferredOrientation?: "vertical" | "horizontal" | "square";
  minResolution?: {
    width: number;
    height: number;
  };
  allowCrop: boolean;
  weight: {
    orientation: number;
    resolution: number;
    aspectRatio: number;
  };
};

export type LayoutDefinition = {
  id: string;
  name: string;
  intent: "cinematic" | "portrait" | "narrative";
  ratio: number;
  slots: LayoutSlot[];
  rules: LayoutRules;
};
