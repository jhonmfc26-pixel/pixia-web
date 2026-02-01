import { LayoutDefinition } from "@/lib/layouts/types";
import { PhotoMeta } from "@/lib/photos/types";
import { scoreLayoutForPage } from "./scoreLayoutForPage";

export type RecommendedLayout = {
  layout: LayoutDefinition;
  score: number;
};

/**
 * Returns layouts ordered by relevance for a given page.
 */
export function getRecommendedLayoutsForPage(
  layouts: LayoutDefinition[],
  photos: PhotoMeta[],
  threshold = 0.25
): RecommendedLayout[] {
  return layouts
    .map((layout) => ({
      layout,
      score: scoreLayoutForPage(layout, photos),
    }))
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
