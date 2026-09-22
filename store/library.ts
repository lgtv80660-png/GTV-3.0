import { create } from "zustand";
import { persist } from "zustand/middleware"; // 🔴 NOUVEAU: Permet de sauvegarder dans le navigateur

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

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
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
    }),
    {
      name: "gtv-library-storage", // Nom de la sauvegarde locale
    }
  )
);