"use client";

import Image from "next/image";
import { useAlbum } from "@/components/album/AlbumProvider";
import { AlbumPage } from "@/lib/album/types";

export default function AlbumSpread() {
  const { album, currentSpreadIndex } = useAlbum();

  // 🛡️ Guard seguro
  if (!album || !album.spreads[currentSpreadIndex]) {
    return (
      <div className="w-[960px] h-[640px] flex items-center justify-center bg-white/70 rounded-lg">
        <p className="text-black/40 text-sm uppercase tracking-widest">
          Cargando álbum…
        </p>
      </div>
    );
  }

  const spread = album.spreads[currentSpreadIndex];

  const renderPage = (page: AlbumPage) => {
    // 🟫 Contraportadas / páginas no editables
    if (!page.editable || !page.layout) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-white/70 border border-black/5 rounded-sm">
          <span className="text-black/40 text-sm tracking-widest uppercase">
            Pixia
          </span>
        </div>
      );
    }

    const { slots } = page.layout;

    return (
      <div className="relative w-full h-full bg-white overflow-hidden">
        {slots.map((slot, index) => {
          const placement = page.photos[index];

          return (
            <div
              key={slot.id}
              className="absolute overflow-hidden bg-neutral-200"
              style={{
                left: `${slot.area.x * 100}%`,
                top: `${slot.area.y * 100}%`,
                width: `${slot.area.width * 100}%`,
                height: `${slot.area.height * 100}%`,
              }}
            >
              {placement ? (
                <Image
                  src={placement.photo.src}
                  alt=""
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-black/30">
                  Sin foto
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative flex">
      {/* Página izquierda */}
      <div className="w-[460px] h-[640px] p-8">{renderPage(spread.left)}</div>

      {/* Lomo */}
      <div className="w-[18px] bg-black/30" />

      {/* Página derecha */}
      <div className="w-[460px] h-[640px] p-8">{renderPage(spread.right)}</div>
    </div>
  );
}
