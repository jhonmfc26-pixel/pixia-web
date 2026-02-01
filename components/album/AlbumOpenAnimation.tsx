"use client";

import { useAlbum } from "@/components/album/AlbumProvider";
import AlbumSpread from "@/components/album/AlbumSpread";

export default function AlbumOpenAnimation() {
  const { album, currentSpreadIndex, nextSpread, prevSpread } = useAlbum();

  if (!album) return null;

  /* ---------------------------------------------------------- */
  /* 📐 PAGE NUMBER LOGIC (EDITORIAL SAFE)                       */
  /* ---------------------------------------------------------- */

  const isCoverSpread = currentSpreadIndex === 0;

  const totalPages = (album.spreads.length - 1) * 2;

  let pageLabel: string | null = null;

  if (!isCoverSpread) {
    const leftPage = (currentSpreadIndex - 1) * 2 + 1;
    const rightPage = leftPage + 1;

    pageLabel = `Página ${leftPage}–${rightPage} de ${totalPages}`;
  }

  /* ---------------------------------------------------------- */

  return (
    <div className="relative flex flex-col items-center gap-6">

      {/* 🔢 PAGE INDICATOR */}
      {pageLabel && (
        <div className="text-sm text-white/70 tracking-wide">
          {pageLabel}
        </div>
      )}

      {/* 📖 ALBUM */}
      <div className="relative flex items-center justify-center">
        <button
          onClick={prevSpread}
          disabled={currentSpreadIndex === 0}
          className="absolute left-[-60px] w-10 h-10 rounded-full bg-white/90 text-black
                     flex items-center justify-center disabled:opacity-30"
        >
          ‹
        </button>

        <AlbumSpread />

        <button
          onClick={nextSpread}
          disabled={currentSpreadIndex === album.spreads.length - 1}
          className="absolute right-[-60px] w-10 h-10 rounded-full bg-white/90 text-black
                     flex items-center justify-center disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </div>
  );
}
