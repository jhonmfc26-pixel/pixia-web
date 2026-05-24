'use client';

import type { ReactNode } from 'react';
import { AlbumProvider } from '@/components/album/AlbumProvider';

interface AlbumLayoutProps {
  children: ReactNode;
}

export default function AlbumLayout({ children }: AlbumLayoutProps) {
  return (
    <AlbumProvider photos={[]}>
      {children}
    </AlbumProvider>
  );
}
