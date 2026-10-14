/** Direct media relay first: preserve source container, quality and byte-range seek. */
export function vodHlsSource(src: string): string {
  const url = new URL(src, "http://gtv.local");

  // External sources retain their existing playback behavior.
  if (
    !src.startsWith("/") ||
    src.startsWith("//") ||
    url.pathname !== "/api/resolve"
  ) {
    return src;
  }

  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");

  if ((type !== "movie" && type !== "series") || !id) {
    throw new Error("Invalid VOD source");
  }

  url.pathname = "/api/vod-direct";

  // Keep the original container extension for unchanged media bytes.
  if(!url.searchParams.get("ext"))url.searchParams.set("ext","mp4");

  // Keep only the required gateway parameters.
  url.searchParams.set("type", type);
  url.searchParams.set("id", id);

  return `${url.pathname}${url.search}`;
}

export function isVodHlsSource(src: string): boolean {
  return (
    /^\/api\/vod-hls(?:\?|$)/.test(src) ||
    /\.m3u8(?:[?#]|$)/i.test(src)
  );
}