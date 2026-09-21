"use client";

import React from "react";
import { SmartImage } from "@/components/ui/SmartImage";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailHeroProps {
  backdrop?: string;
  poster?: string;
  title: string;
  fav?: boolean;
  onToggleFav?: () => void;
  children?: React.ReactNode;
}

export function DetailHero({
  backdrop,
  poster,
  title,
  fav,
  onToggleFav,
  children,
}: DetailHeroProps) {
  return (
    <div className="relative w-full rounded-3xl overflow-hidden bg-zinc-950 border border-white/10 p-6 shadow-2xl">
      {/* Off-screen Backdrop Background */}
      {backdrop && (
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          <img src={backdrop} alt={title} className="w-full h-full object-cover blur-xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
        </div>
      )}

      <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
        {/* Affiche Poster */}
        {poster && (
          <div className="relative w-40 sm:w-52 shrink-0 aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <SmartImage src={poster} alt={title} className="w-full h-full object-cover" />
            {onToggleFav && (
              <button
                onClick={onToggleFav}
                className={cn(
                  "absolute top-3 right-3 p-2.5 rounded-full border backdrop-blur-md transition-all",
                  fav
                    ? "bg-red-500/20 border-red-500 text-red-500"
                    : "bg-black/40 border-white/20 text-white hover:bg-black/60"
                )}
              >
                <Heart className={cn("w-4 h-4", fav && "fill-current")} />
              </button>
            )}
          </div>
        )}

        {/* Zone de contenu principale (Synopsis, Casting, Lecteur In-Page) */}
        <div className="flex-1 w-full">{children}</div>
      </div>
    </div>
  );
}