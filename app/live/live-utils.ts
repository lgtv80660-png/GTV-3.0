export async function readJson<T>(response: Response): Promise<T> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`API ${response.status}: réponse invalide`);
  }
}

export function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function getToday(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const y = parts.find((part) => part.type === "year")?.value;
    const m = parts.find((part) => part.type === "month")?.value;
    const d = parts.find((part) => part.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {}

  return new Date().toISOString().slice(0, 10);
}

export function formatTime(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return "--:--";
  }
}

export function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(hd|fhd|uhd|4k|540|720|1080|hevc|h265|h264|live)\b/g, " ")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function footballChannel(value: string | null | undefined) {
  if (!value) return false;
  const name = normalize(value);
  return [
    "bein sport",
    "bein sports",
    "dazn",
    "canal foot",
    "canal sport",
    "rmc sport",
    "sky sport",
    "supersport",
    "football",
    "foot",
  ].some((token) => name.includes(token));
}
