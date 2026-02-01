import { Album, AlbumSpread } from "@/lib/album/types";
import { PhotoMeta } from "@/lib/photos/types";
import { ALL_LAYOUTS } from "@/lib/layouts";

export function generateAlbumFromPhotos(
  photos: PhotoMeta[]
): Album {
  const spreads: AlbumSpread[] = [];

  /* ============================
     1️⃣ PORTADA
  ============================ */
  spreads.push({
    id: "spread-cover",
    left: {
      id: "cover-left",
      side: "left",
      editable: false,
      layout: null,
      photos: [],
    },
    right: {
      id: "cover-right",
      side: "right",
      editable: true,
      layout: ALL_LAYOUTS[0],
      photos: photos[0]
        ? [
            {
              photo: photos[0],
              frame: { x: 0, y: 0, scale: 1.25 },
            },
          ]
        : [],
    },
  });

  /* ============================
     2️⃣ INTERIORES (2 fotos por spread)
  ============================ */
  const interiorPhotos = photos.slice(1);

  for (let i = 0; i < interiorPhotos.length; i += 2) {
    const leftPhoto = interiorPhotos[i];
    const rightPhoto = interiorPhotos[i + 1];

    spreads.push({
      id: `spread-${i / 2 + 1}`,
      left: {
        id: `page-left-${i}`,
        side: "left",
        editable: true,
        layout: ALL_LAYOUTS[0],
        photos: leftPhoto
          ? [
              {
                photo: leftPhoto,
                frame: { x: 0, y: 0, scale: 1.25 },
              },
            ]
          : [],
      },
      right: {
        id: `page-right-${i + 1}`,
        side: "right",
        editable: true,
        layout: ALL_LAYOUTS[0],
        photos: rightPhoto
          ? [
              {
                photo: rightPhoto,
                frame: { x: 0, y: 0, scale: 1.25 },
              },
            ]
          : [],
      },
    });
  }

  /* ============================
     3️⃣ CONTRAPORTADA (VACÍA)
  ============================ */
  spreads.push({
    id: "spread-back",
    left: {
      id: "back-left",
      side: "left",
      editable: false,
      layout: null,
      photos: [],
    },
    right: {
      id: "back-right",
      side: "right",
      editable: false,
      layout: null,
      photos: [],
    },
  });

  return {
    id: "album-1",
    spreads,
    meta: {
      storyType: "custom",
      style: "cinematic",
      emotion: "neutral",
    },
  };
}
