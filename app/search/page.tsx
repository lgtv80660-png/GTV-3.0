"use client";

import React from "react";
import { Search } from "lucide-react";

export default function SearchPage() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white p-8">
      <div className="bg-zinc-900/50 p-6 rounded-full mb-6 border border-white/5 shadow-2xl">
        <Search className="w-12 h-12 text-zinc-400" />
      </div>
      <h1 className="text-3xl font-extrabold mb-3 tracking-tight">Recherche</h1>
      <p className="text-zinc-500 text-center max-w-md text-sm md:text-base">
        Le moteur de recherche global est en cours de construction. Bientôt, vous pourrez trouver n'importe quel film, série ou chaîne TV en un clin d'œil.
      </p>
    </div>
  );
}