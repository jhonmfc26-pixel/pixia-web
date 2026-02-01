import { LayoutDefinition } from "@/lib/layouts/types";
import { PhotoMeta } from "@/lib/photos/types";
import { scorePhotoForLayout } from "./scorePhotoForLayout";

/**
 * Scores how suitable a layout is for a page given its photos.
 * Returns a value between 0 and 1.
 */
export function scoreLayoutForPage(
  layout: LayoutDefinition,
  photos: PhotoMeta[]
): number {
  if (!photos.length) return 0;

  const total = photos.reduce((acc, photo) => {
    return acc + scorePhotoForLayout(photo, layout);
  }, 0);

  return total / photos.length;
}
