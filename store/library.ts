import { create } from "zustand";

interface LibraryItem {
  id: number | string;
  name?: string;
  title?: string;
  poster?: string;
  cover?: string;
  [key: string]: any;
}

interface LibraryState {
  favorites: Record<string, LibraryItem>;
  progress: Record<string, { position: number; duration: number }>;
  toggleFav: (type: string, item: LibraryItem) => void;
  isFav: (type: string, id: number | string) => boolean;
}

export const useLibrary = create<LibraryState>()((set, get) => ({
  favorites: {},
  progress: {},
  toggleFav: (type: string, item: LibraryItem) =>
    set((state: LibraryState) => {
      const key = `${type}:${item.id}`;
      const next = { ...state.favorites };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = item;
      }
      return { favorites: next };
    }),
  isFav: (type: string, id: number | string) => !!get().favorites[`${type}:${id}`],
}));