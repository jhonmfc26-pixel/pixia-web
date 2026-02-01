import { Album, AlbumSpread } from "@/lib/album/types";
import { PhotoMeta } from "@/lib/photos/types";
import { ALL_LAYOUTS } from "@/lib/layouts";

/**
 * Distribución base v1 (ventas):
 * - Portada técnica (no visible)
 * - Spreads internos: 2 fotos (izq + der)
 * - Si hay foto impar, la última va a la derecha (izq queda vacía)
 * - Contraportada técnica (no visible)
 */
export function buildAlbumFromPhotos(photos: PhotoMeta[]): Album {
  const spreads: AlbumSpread[] = [];

  // ─────────────────────────
  // 📘 Portada técnica
  // ─────────────────────────
  spreads.push({
    id: "spread-cover",
    left: { id: "cover-left", side: "left", editable: false, layout: null, photos: [] },
    right:{ id: "cover-right",side: "right",editable: false, layout: null, photos: [] },
  });

  // ─────────────────────────
  // 📖 Spreads internos (2 fotos)
  // ─────────────────────────
  for (let i = 0; i < photos.length; i += 2) {
    const leftPhoto = photos[i];
    const rightPhoto = photos[i + 1];

    spreads.push({
      id: `spread-${Math.floor(i / 2) + 1}`,
      left: {
        id: `page-left-${i + 1}`,
        side: "left",
        editable: true,
        layout: ALL_LAYOUTS[0],
        photos: leftPhoto
          ? [{ photo: leftPhoto, frame: { x: 0, y: 0, scale: 1.2 } }]
          : [],
      },
      right: {
        id: `page-right-${i + 2}`,
        side: "right",
        editable: true,
        layout: ALL_LAYOUTS[0],
        photos: rightPhoto
          ? [{ photo: rightPhoto, frame: { x: 0, y: 0, scale: 1.2 } }]
          : [],
      },
    });
  }

  // ─────────────────────────
  // 📕 Contraportada técnica
  // ─────────────────────────
  spreads.push({
    id: "spread-back",
    left: { id: "back-left", side: "left", editable: false, layout: null, photos: [] },
    right:{ id: "back-right",side: "right",editable: false, layout: null, photos: [] },
  });

  return {
    id: "album-1",
    spreads,
    meta: {
      storyType: "custom",
      style: "default",
      emotion: "neutral",
    },
  };
}
