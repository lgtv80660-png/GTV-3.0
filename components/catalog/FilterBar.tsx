"use client";

import React from "react";
import { Search, ArrowUpDown } from "lucide-react";
import type { SortKey } from "@/lib/utils";

interface FilterBarProps {
  categories: any[];
  activeCategory: string;
  onCategory: (id: string) => void;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  query: string;
  onQuery: (query: string) => void;
  count: number;
}

export function FilterBar({ sort, onSort, query, onQuery, count }: FilterBarProps) {
  return (
    <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-950/40 backdrop-blur-md">
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Rechercher..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-all"
        />
      </div>

      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
        <span className="text-xs text-zinc-400 font-medium">
          {count} élément{count > 1 ? "s" : ""}
        </span>

        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as SortKey)}
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer [&>option]:bg-zinc-900"
          >
            <option value="name_asc">Nom (A-Z)</option>
            <option value="name_desc">Nom (Z-A)</option>
            <option value="rating_desc">Mieux notés</option>
            <option value="year_desc">Plus récents</option>
          </select>
        </div>
      </div>
    </div>
  );
}