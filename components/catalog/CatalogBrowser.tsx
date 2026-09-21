"use client";

import { useUI } from "@/store/ui";
import type { FilterState } from "@/store/ui";

export default function CatalogBrowser() {
  const { filters, patchFilter } = useUI();

  const activeFilters: FilterState =
    typeof filters === "object" && filters !== null
      ? (filters as FilterState)
      : { category: "all", search: "", sortBy: "name" };

  const searchVal = activeFilters.search || "";

  const handleSearchChange = (val: string) => {
    patchFilter("search", val);
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <input
          type="text"
          value={searchVal}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Rechercher..."
          className="w-full sm:w-64 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 text-sm"
        />
      </div>
    </div>
  );
}
