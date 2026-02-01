import { LayoutDefinition } from "@/lib/layouts/types";
import { PhotoMeta } from "@/lib/photos/types";

/**
 * Represents a single photo placed inside a layout slot.
 * The photo itself never changes, only its frame does.
 */
export type PhotoPlacement = {
  photo: PhotoMeta;

  frame: {
    x: number;
    y: number;
    scale: number;
  };
};

/**
 * A page is one side of a spread (left or right).
 */
export type AlbumPage = {
  id: string;
  side: "left" | "right";

  /**
   * Non-editable pages (cover, spine, ending)
   */
  editable: boolean;

  /**
   * Layout applied to this page
   */
  layout: LayoutDefinition | null;

  /**
   * Photos currently placed on this page
   */
  photos: PhotoPlacement[];
};

/**
 * A spread represents two pages shown together.
 */
export type AlbumSpread = {
  id: string;

  left: AlbumPage;
  right: AlbumPage;
};

/**
 * Full album state.
 * This is the single source of truth.
 */
export type Album = {
  id: string;

  /**
   * Ordered list of spreads
   */
  spreads: AlbumSpread[];

  /**
   * Global album metadata
   */
  meta: {
    storyType: "wedding" | "travel" | "anniversary" | "custom";
    style: string;
    emotion: string;
  };
};
