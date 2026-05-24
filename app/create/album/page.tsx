'use client';

import { useRouter } from 'next/navigation';
import { useAlbumDraftStore } from '@/store/albumDraftStore';

export default function CreateAlbumPage() {
  const router = useRouter();
  const createDraft = useAlbumDraftStore((s) => s.createDraft);

  const selectedPhotos = [
    { id: 'p1', src: '/photos/1.jpg' },
    { id: 'p2', src: '/photos/2.jpg' },
  ];

  const style   = 'Cinematográfico';
  const emotion = 'Íntimo y cálido';
  const format  = 'Álbum premium';

  const handleFinish = () => {
    createDraft({
      id: crypto.randomUUID(),
      photos: selectedPhotos,
      style,
      emotion,
      format,
    });

    router.push('/create/result');
  };

  return (
    <main className="p-6">
      <button
        onClick={handleFinish}
        className="px-6 py-3 bg-black text-white rounded-lg"
      >
        Finalizar creación
      </button>
    </main>
  );
}
