'use client';

import { useAlbum } from '@/components/album/AlbumProvider';

export default function AlbumEditorPage() {
  const album = useAlbum();

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-xl font-semibold mb-4">
        Album Editor
      </h1>

      <pre className="bg-neutral-100 p-4 rounded">
        {JSON.stringify(album, null, 2)}
      </pre>
    </main>
  );
}
