"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Album } from "@/lib/album/types";
import { buildAlbumFromPhotos } from "@/lib/album/buildAlbumFromPhotos";
import { useWizard } from "@/components/create/WizardProvider";
import { PhotoMeta } from "@/lib/photos/types";

type AlbumContextType = {
  album: Album | null;
  currentSpreadIndex: number;
  nextSpread: () => void;
  prevSpread: () => void;
};

const AlbumContext = createContext<AlbumContextType | null>(null);

export function AlbumProvider({ children }: { children: React.ReactNode }) {
  const { state } = useWizard();
  const [album, setAlbum] = useState<Album | null>(null);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);

  /* ------------------------------------------------------------------ */
  /* BUILD ALBUM FROM WIZARD PHOTOS                                      */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (state.photos.length === 0) return;

    const photos: PhotoMeta[] = state.photos.map((p) => ({
      id: p.id,
      src: URL.createObjectURL(p.file),
      width: 2000,
      height: 3000,
      aspectRatio: 2 / 3,
      orientation: "vertical",
    }));

    const builtAlbum = buildAlbumFromPhotos(photos);

    /* -------------------------------------------------------------- */
    /* 🧱 MARCAR CONTRAPORTADAS (MODELO, NO RENDER)                    */
    /* -------------------------------------------------------------- */
    if (builtAlbum.spreads.length > 0) {
      // Contraportada inicial
      builtAlbum.spreads[0].left.editable = false;
      builtAlbum.spreads[0].left.layout = null;

      // Contraportada final
      const lastIndex = builtAlbum.spreads.length - 1;
      builtAlbum.spreads[lastIndex].right.editable = false;
      builtAlbum.spreads[lastIndex].right.layout = null;
    }

    setAlbum(builtAlbum);
    setCurrentSpreadIndex(0);
  }, [state.photos]);

  /* ------------------------------------------------------------------ */
  /* NAVIGATION                                                         */
  /* ------------------------------------------------------------------ */
  const nextSpread = () => {
    if (!album) return;
    setCurrentSpreadIndex((i) =>
      Math.min(i + 1, album.spreads.length - 1)
    );
  };

  const prevSpread = () => {
    setCurrentSpreadIndex((i) => Math.max(i - 1, 0));
  };

  return (
    <AlbumContext.Provider
      value={{ album, currentSpreadIndex, nextSpread, prevSpread }}
    >
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
