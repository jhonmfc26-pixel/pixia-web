export type PhotoMeta = {
  id: string;
  src: string;
  width: number;
  height: number;
  aspectRatio: number;
  orientation: "vertical" | "horizontal" | "square";
};
