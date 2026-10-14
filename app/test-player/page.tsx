"use client";

import { VideoPlayer } from "@/components/player/VideoPlayer";

export default function TestPlayer() {
  return (
    <div className="h-screen w-screen bg-black">

      <VideoPlayer
        sources={[
          "https://gmztv.vercel.app/movie/zohir/123456/796692.mkv"
        ]}
        ext="mkv"
        isLive={false}
        mediaType="movie"
        title="TEST MKV AUDIO"
        poster=""
        startTime={0}
      />

    </div>
  );
}