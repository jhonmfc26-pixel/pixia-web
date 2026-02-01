import { Album, AlbumSpread } from "@/lib/album/types";
import { PhotoMeta } from "@/lib/photos/types";
import { ALL_LAYOUTS } from "@/lib/layouts";

export function createAlbumFromPhotos(photos: PhotoMeta[]): Album {
  const spreads: AlbumSpread[] = [];

  // 1️⃣ Portada (izq vacía, der primera foto)
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
              frame: { x: 0, y: 0, scale: 1 },
            },
          ]
        : [],
    },
  });

  // 2️⃣ Spreads internos (2 fotos por spread)
  let index = 1;

  while (index < photos.length) {
    spreads.push({
      id: `spread-${index}`,
      left: {
        id: `page-${index}-left`,
        side: "left",
        editable: true,
        layout: ALL_LAYOUTS[0],
        photos: photos[index]
          ? [{ photo: photos[index], frame: { x: 0, y: 0, scale: 1 } }]
          : [],
      },
      right: {
        id: `page-${index + 1}-right`,
        side: "right",
        editable: true,
        layout: ALL_LAYOUTS[0],
        photos: photos[index + 1]
          ? [{ photo: photos[index + 1], frame: { x: 0, y: 0, scale: 1 } }]
          : [],
      },
    });

    index += 2;
  }

  // 3️⃣ Contraportada (der vacía)
  const last = spreads[spreads.length - 1];
  last.right = {
    id: "back-cover",
    side: "right",
    editable: false,
    layout: null,
    photos: [],
  };

  return {
    id: "album-1",
    spreads,
    meta: {
      storyType: "custom",
      style: "cinematic",
      emotion: "emotional",
    },
  };
}
