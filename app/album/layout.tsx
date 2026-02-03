'use client';

import type { ReactNode } from 'react';
import { AlbumProvider } from '@/context/AlbumProvider';

interface AlbumLayoutProps {
  children: ReactNode;
}

export default function AlbumLayout({ children }: AlbumLayoutProps) {
  return (
    <AlbumProvider>
      {children}
    </AlbumProvider>
  );
}
