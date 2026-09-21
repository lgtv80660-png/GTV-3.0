import { create } from "zustand";
import type { SortKey } from "@/lib/utils";

export interface SectionFilter {
  category: string;
  sort: SortKey;
  query: string;
}

export const DEFAULT_FILTER: SectionFilter = {
  category: "all",
  sort: "name_asc",
  query: "",
};

interface UIState {
  filters: Record<string, SectionFilter>;
  patchFilter: (section: string, patch: Partial<SectionFilter>) => void;
}

export const useUI = create<UIState>((set) => ({
  filters: {},
  patchFilter: (section, patch) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [section]: {
          ...(state.filters[section] ?? DEFAULT_FILTER),
          ...patch,
        },
      },
    })),
}));