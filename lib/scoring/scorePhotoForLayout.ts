import { LayoutDefinition } from "@/lib/layouts/types";
import { PhotoMeta } from "@/lib/photos/types";

/**
 * Scores how well a single photo fits a given layout.
 * Returns a value between 0 and 1.
 */
export function scorePhotoForLayout(
  photo: PhotoMeta,
  layout: LayoutDefinition
): number {
  let score = 0;

  /* 1️⃣ Orientation preference */
  const preferred =
    layout.rules.preferredOrientation ??
    layout.slots.find((s) => s.preferredOrientation)?.preferredOrientation;

  if (preferred && photo.orientation === preferred) {
    score += layout.rules.weight.orientation;
  }

  /* 2️⃣ Aspect ratio proximity */
  const ratioDiff = Math.abs(photo.aspectRatio - layout.ratio);
  const ratioScore = Math.max(0, 1 - ratioDiff); // simple proximity
  score += ratioScore * layout.rules.weight.aspectRatio;

  /* 3️⃣ Resolution baseline (exists & non-zero) */
  if (photo.width > 0 && photo.height > 0) {
    score += layout.rules.weight.resolution;
  }

  return Math.min(score, 1);
}
