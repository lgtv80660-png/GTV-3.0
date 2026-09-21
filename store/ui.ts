import { create } from "zustand";
import type { SortKey } from "@/lib/utils";

export interface FilterState {
  category: string;
  search: string;
  sortBy: SortKey;
}

export const DEFAULT_FILTER: FilterState = {
  category: "all",
  search: "",
  sortBy: "name",
};

interface UIState {
  sortBy: SortKey;
  setSortBy: (sort: SortKey) => void;
  filters: FilterState;
  patchFilter: (patch: Partial<FilterState>) => void;
}

export const useUI = create<UIState>((set) => ({
  sortBy: "name",
  setSortBy: (sortBy) => set({ sortBy }),
  filters: DEFAULT_FILTER,
  patchFilter: (patch) =>
    set((state) => ({
      filters: { ...state.filters, ...patch },
      ...(patch.sortBy ? { sortBy: patch.sortBy } : {}),
    })),
}));
