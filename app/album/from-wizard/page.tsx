"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWizard } from "@/components/create/WizardProvider";
import { AlbumProvider } from "@/components/album/AlbumProvider";
import AlbumOpenAnimation from "@/components/album/AlbumOpenAnimation";

export default function AlbumFromWizardPage() {
  const { state } = useWizard();
  const router = useRouter();

  // 🛡️ Guardia dura
  if (!state.photos.length) {
    return <p className="p-8">No hay fotos para crear el álbum</p>;
  }

  // ⏭ Redirigir al editor real
  useEffect(() => {
    router.replace("/album/editor");
  }, [router]);

  return (
    <AlbumProvider>
      <p className="p-8">Creando álbum…</p>
      <AlbumOpenAnimation />
    </AlbumProvider>
  );
}
