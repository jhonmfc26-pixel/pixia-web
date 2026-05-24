"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Album } from "@/lib/album/types";
import { buildAlbumFromPhotos } from "@/lib/album/buildAlbumFromPhotos";
import { PhotoMeta } from "@/lib/photos/types";

type AlbumContextType = {
  album: Album | null;
  currentSpreadIndex: number;
  nextSpread: () => void;
  prevSpread: () => void;
};

const AlbumContext = createContext<AlbumContextType | null>(null);

interface Props {
  children: React.ReactNode;
  photos: { id: string; src: string }[];
}

export function AlbumProvider({ children, photos }: Props) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);

  useEffect(() => {
    if (photos.length === 0) return;

    const photoMetas: PhotoMeta[] = photos.map((p) => ({
      id: p.id,
      src: p.src,
      width: 2000,
      height: 3000,
      aspectRatio: 2 / 3,
      orientation: "vertical",
    }));

    const builtAlbum = buildAlbumFromPhotos(photoMetas);

    if (builtAlbum.spreads.length > 0) {
      builtAlbum.spreads[0].left.editable = false;
      builtAlbum.spreads[0].left.layout = null;

      const lastIndex = builtAlbum.spreads.length - 1;
      builtAlbum.spreads[lastIndex].right.editable = false;
      builtAlbum.spreads[lastIndex].right.layout = null;
    }

    setAlbum(builtAlbum);
    setCurrentSpreadIndex(0);
  }, [photos]);

  const nextSpread = () => {
    if (!album) return;
    setCurrentSpreadIndex((i) => Math.min(i + 1, album.spreads.length - 1));
  };

  const prevSpread = () => {
    setCurrentSpreadIndex((i) => Math.max(i - 1, 0));
  };

  return (
    <AlbumContext.Provider value={{ album, currentSpreadIndex, nextSpread, prevSpread }}>
      {children}
    </AlbumContext.Provider>
  );
}

export function useAlbum() {
  const ctx = useContext(AlbumContext);
  if (!ctx) {
    throw new Error("useAlbum must be used within AlbumProvider");
  }
  return ctx;
}
