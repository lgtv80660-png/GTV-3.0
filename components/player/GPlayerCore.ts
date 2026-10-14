import type { EngineHandle } from "@/lib/player/engine";
import { GPlayerState, type GPlayerStateData } from "./GPlayerState";

export type GPlayerSourceType = "mp4" | "mkv" | "hls" | "unknown";
export type GPlayerSource = { url: string; type?: GPlayerSourceType };
export type GPlayerEvents = {
  onReady?: () => void;
  onMetadata?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
  onError?: (error: unknown) => void;
  onStateChange?: (state: GPlayerStateData) => void;
};

/** The media element is authoritative; state and UI are snapshots of its events. */
export class GPlayerCore {
  private state = new GPlayerState();
  private source: GPlayerSource | null = null;
  private lastPosition = 0;
  private duration = 0;
  private engine: EngineHandle | null = null;
  setEngine(engine: EngineHandle) { this.engine=engine; this.sync(); }
  private pendingResume: EventListener | null = null;
  private bindings: Array<[string, EventListener]> = [];

  constructor(private video: HTMLVideoElement, private events: GPlayerEvents = {}) {
    const bind = (name: string, action?: () => void) => {
      const handler = () => { this.sync(); action?.(); };
      video.addEventListener(name, handler);
      this.bindings.push([name, handler]);
    };
    const metadata = () => {
      const duration = video.duration;
      if (Number.isFinite(duration) && duration > 0 && !this.engine?.getDuration) this.duration = duration;
      this.sync();
      events.onMetadata?.();
    };
    bind("loadedmetadata", metadata);
    bind("durationchange", metadata);
    bind("loadeddata");
    bind("canplay", () => events.onReady?.());
    bind("timeupdate", () => events.onTimeUpdate?.(this.getCurrentTime()));
    bind("seeking");
    bind("seeked");
    bind("volumechange");
    bind("play", () => events.onPlay?.());
    bind("playing");
    bind("pause", () => events.onPause?.());
    bind("waiting", () => { this.state.setStatus("buffering"); this.publish(); });
    bind("ended", () => events.onEnded?.());
    bind("error", () => { if(!this.engine?.isRecovering?.()) events.onError?.(video.error); });
    this.sync();
  }

  private publish() { this.events.onStateChange?.(this.state.get()); }

  sync() {
    this.state.setDuration(this.getDuration());
    this.state.setTime(this.getCurrentTime());
    this.state.setVolume(this.video.volume);
    this.state.setMuted(this.video.muted);
    this.state.setStatus(this.video.error ? "error" : this.video.ended ? "ended" :
      this.video.readyState < 1 ? "loading" : this.video.paused ? "paused" : "playing");
    this.publish();
  }

  setSource(source: GPlayerSource) {
    this.cancelResume();
    this.duration = 0;
    this.source = source;
    this.state.setSource(source.url);
    this.sync();
  }

  load(source: GPlayerSource, resume = 0) {
    this.setSource(source);
    if (Number.isFinite(resume) && resume > 0) {
      this.pendingResume = () => {
        if (this.video.readyState < 1 || this.getDuration() <= 0) return;
        this.seek(resume);
      };
      this.video.addEventListener("loadedmetadata", this.pendingResume);
      this.video.addEventListener("durationchange", this.pendingResume);
    }
    this.video.src = source.url;
    this.video.load();
  }

  async play() { await this.video.play(); this.sync(); }
  pause() { this.video.pause(); this.sync(); }
  seek(seconds: number) {
    const duration = this.getDuration();
    if (!Number.isFinite(seconds) || duration <= 0 || this.video.readyState < 1) return;
    this.cancelResume();
    const at=Math.max(0, Math.min(duration, seconds));
    if(this.engine?.seek)this.engine.seek(at);else this.video.currentTime=at;
    this.sync();
  }
  skip(seconds: number) { this.seek(this.getCurrentTime() + seconds); }
  setVolume(volume: number) {
    if (!Number.isFinite(volume)) return;
    this.video.volume = Math.max(0, Math.min(1, volume));
    if (volume > 0) this.video.muted = false;
    this.sync();
  }
  mute(muted: boolean) { this.video.muted = muted; this.sync(); }
  getCurrentTime() { if(this.engine?.getCurrentTime)return this.engine.getCurrentTime(); return Number.isFinite(this.video.currentTime) ? Math.max(0, this.video.currentTime) : 0; }
  getDuration() { return this.engine?.getDuration?.() || this.duration; }
  private cancelResume() {
    if (!this.pendingResume) return;
    this.video.removeEventListener("loadedmetadata", this.pendingResume);
    this.video.removeEventListener("durationchange", this.pendingResume);
    this.pendingResume = null;
  }
  savePosition() { return this.lastPosition = this.getCurrentTime(); }
  restorePosition() { this.seek(this.lastPosition); }
  pauseForAd() { this.savePosition(); this.pause(); }
  resumeAfterAd() { this.restorePosition(); return this.play(); }
  getState() { return this.state.get().status; }
  getSnapshot() { return this.state.get(); }
  getSource() { return this.source; }
  destroy() {
    this.cancelResume();
    for (const [name, handler] of this.bindings) this.video.removeEventListener(name, handler);
    this.bindings = [];
    // The factory owner destroys the engine and source after detaching observers.
  }
}
