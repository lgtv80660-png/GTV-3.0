"use client";

import React, { useState } from "react";

interface SmartImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  rounded?: string;
}

export function SmartImage({ src, alt, className = "", rounded = "rounded-xl" }: SmartImageProps) {
  const [error, setError] = useState(false);

  let imageUrl = src;
  if (imageUrl && imageUrl.startsWith("http://")) {
    imageUrl = `/api/images?url=${encodeURIComponent(imageUrl)}`;
  }

  if (!imageUrl || error) {
    return (
      <div className={`flex items-center justify-center bg-zinc-900 text-zinc-600 font-bold text-xs ${rounded} ${className}`}>
        No Image
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      onError={() => setError(true)}
      className={`${rounded} ${className}`}
      loading="lazy"
    />
  );
}