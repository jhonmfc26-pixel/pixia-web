import { create } from 'zustand';

export interface AlbumDraft {
  id: string;
  photos: { id: string; src: string }[];
  style: string;
  emotion: string;
  format: string;
}

interface AlbumDraftState {
  currentDraft: AlbumDraft | null;
  createDraft: (draft: AlbumDraft) => void;
  clearDraft: () => void;
}

export const useAlbumDraftStore = create<AlbumDraftState>((set) => ({
  currentDraft: null,

  createDraft: (draft) =>
    set(() => ({
      currentDraft: draft,
    })),

  clearDraft: () =>
    set(() => ({
      currentDraft: null,
    })),
}));
