"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Play, Star } from "lucide-react";

export interface PosterItem {
  id?: string | number;
  series_id?: string | number;
  stream_id?: string | number;
  name?: string;
  title?: string;
  subtitle?: string;
  cover?: string;
  stream_icon?: string;
  poster?: string;
  rating?: string | number;
  year?: string | number;
  releaseDate?: string;
  container_extension?: string;
}

interface PosterCardProps {
  item: PosterItem;
  href: string;
  className?: string;
  onPlay?: (item: PosterItem) => void;
}

export const PosterCard: React.FC<PosterCardProps> = ({ item, href, className = "", onPlay }) => {
  const [imageError, setImageError] = useState(false);
  const title = item.name || item.title || "Titre inconnu";

  let imageUrl = item.cover || item.stream_icon || item.poster || "";
  if (imageUrl && imageUrl.startsWith("http://")) {
    imageUrl = `/api/images?url=${encodeURIComponent(imageUrl)}`;
  }

  const initials = title
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const handleQuickPlay = (e: React.MouseEvent) => {
    if (onPlay) {
      e.preventDefault();
      e.stopPropagation();
      onPlay(item);
    }
  };

  const ratingValue = Number(item.rating);

  return (
    <Link
      href={href}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      className={`group relative flex flex-col overflow-hidden rounded-2xl bg-zinc-900/60 backdrop-blur-sm border border-white/10 
      transition-all duration-300 ease-out 
      hover:scale-105 hover:-translate-y-1.5 hover:border-white/30 hover:shadow-2xl 
      select-none cursor-pointer ${className}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-950 pointer-events-none">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={title}
            draggable={false}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 pointer-events-none"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-500 font-bold text-xs select-none">
            {initials}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px] pointer-events-auto">
          <button
            type="button"
            onClick={handleQuickPlay}
            className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-xl transform scale-50 group-hover:scale-100 transition-all duration-300 hover:scale-110"
          >
            <Play className="w-5 h-5 fill-black translate-x-0.5" />
          </button>
        </div>

        {ratingValue > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-full flex items-center gap-1 text-[10px] font-bold text-amber-400 z-10 shadow-md">
            <Star className="w-3 h-3 fill-amber-400" />
            <span>{ratingValue.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="p-2.5 flex flex-col gap-0.5 bg-gradient-to-b from-zinc-900/40 to-zinc-900 pointer-events-none">
        <h3 className="line-clamp-1 text-xs font-semibold text-zinc-100 group-hover:text-white transition-colors">
          {title}
        </h3>
        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium">
          <span>{item.subtitle || item.year || (item.releaseDate ? item.releaseDate.slice(0, 4) : "")}</span>
          {item.container_extension && (
            <span className="uppercase text-[9px] font-bold text-zinc-500">{item.container_extension}</span>
          )}
        </div>
      </div>
    </Link>
  );
};