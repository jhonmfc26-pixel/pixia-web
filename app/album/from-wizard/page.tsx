"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AlbumFromWizardPage() {
  const router = useRouter();

  // 🚀 Esta página NO construye nada
  // Solo redirige al editor, que sí está envuelto correctamente
  useEffect(() => {
    router.replace("/album/editor");
  }, [router]);

  return (
    <div className="w-full h-[60vh] flex items-center justify-center">
      <p className="text-sm text-black/40 uppercase tracking-widest">
        Preparando tu álbum…
      </p>
    </div>
  );
}
