export type GResumeData = { id: string; position: number; duration: number; updatedAt: number };

export class GPlayerPersistence {
  private prefix = "gtv_gplayer_resume_";
  save(id: string, position: number, duration: number) {
    if (typeof window === "undefined" || !Number.isFinite(position) || position < 0 ||
      !Number.isFinite(duration) || duration <= 0) return;
    try {
      localStorage.setItem(this.prefix + id, JSON.stringify({
        id, position: Math.min(position, duration), duration, updatedAt: Date.now(),
      }));
    } catch { /* Storage can be unavailable in private browsing. */ }
  }
  load(id: string): GResumeData | null {
    if (typeof window === "undefined") return null;
    try {
      const data = JSON.parse(localStorage.getItem(this.prefix + id) || "null");
      if (!data || data.id !== id || !Number.isFinite(data.position) || data.position < 0 ||
        !Number.isFinite(data.duration) || data.duration <= 0 || data.position > data.duration || !Number.isFinite(data.updatedAt)) return null;
      return data;
    } catch { return null; }
  }
  clear(id: string) {
    if (typeof window === "undefined") return;
    try { localStorage.removeItem(this.prefix + id); } catch {}
  }
  shouldResume(data: GResumeData | null) {
    return !!data && data.position > 0 && data.position < data.duration;
  }
}
