import { create } from "zustand";
import type { SortKey } from "@/lib/utils";

export const DEFAULT_FILTER = {
  category: "all",
  search: "",
  sortBy: "name" as SortKey,
};

interface UIState {
  sortBy: SortKey;
  setSortBy: (sort: SortKey) => void;
}

export const useUI = create<UIState>((set) => ({
  sortBy: "name",
  setSortBy: (sortBy) => set({ sortBy }),
}));
