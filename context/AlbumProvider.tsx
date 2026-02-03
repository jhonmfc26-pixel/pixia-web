'use client';

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';

interface AlbumState {
  id: string | null;
}

interface AlbumContextValue {
  album: AlbumState;
  setAlbum: (album: AlbumState) => void;
}

const AlbumContext = createContext<AlbumContextValue | null>(null);

export function AlbumProvider({ children }: { children: ReactNode }) {
  const [album, setAlbum] = useState<AlbumState>({
    id: null,
  });

  return (
    <AlbumContext.Provider value={{ album, setAlbum }}>
      {children}
    </AlbumContext.Provider>
  );
}

export function useAlbum() {
  const context = useContext(AlbumContext);

  if (!context) {
    throw new Error(
      'useAlbum must be used within <AlbumProvider /> (check app/album/layout.tsx)'
    );
  }

  return context;
}
