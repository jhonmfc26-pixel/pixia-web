"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWizard } from "@/components/create/WizardProvider";
import { createAlbumFromPhotos } from "@/lib/album/createAlbumFromPhotos";
import { AlbumProvider } from "@/components/album/AlbumProvider";

export default function AlbumFromWizardPage() {
  const { state } = useWizard();
  const router = useRouter();

  // 🚨 Guardia dura
  if (!state.photos.length) {
    return <p className="p-8">No hay fotos para crear el álbum</p>;
  }

  const album = createAlbumFromPhotos(
    state.photos.map((p) => ({
      id: p.id,
      src: URL.createObjectURL(p.file),
      width: 3000,
      height: 2000,
      aspectRatio: 1.5,
      orientation: "horizontal",
    }))
  );

  // ⏭ Redirigir al editor real
  useEffect(() => {
    router.replace("/album/editor");
  }, [router]);

  return (
    <AlbumProvider initialAlbum={album}>
      <p className="p-8">Creando álbum…</p>
    </AlbumProvider>
  );
}
