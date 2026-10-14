export type AdState = "idle" | "saving" | "playing" | "finished";
export type AdSource = { url: string; duration?: number };

/** VOD-only foundation. The caller owns a separate ad video and its overlay.
 * Never replace the content source: its engine, buffer and position stay intact.
 * No scheduling or automatic advertising is enabled by this class.
 */
export class GPlayerAds {
  private state: AdState = "idle";
  private ad: AdSource | null = null;
  private contentTime = 0;
  private resumePlayback = false;
  private generation = 0;

  constructor(
    private video: HTMLVideoElement,
    private adVideo: HTMLVideoElement,
  ) {
    if (video === adVideo) throw new Error("A separate ad video is required.");
    adVideo.addEventListener("ended", this.onFinished);
    adVideo.addEventListener("error", this.onFinished);
  }

  private onFinished = () => { void this.finishAd().catch(() => {
    // Browser autoplay restrictions leave the content paused with its controls.
  }); };

  loadAd(source: AdSource) {
    if (this.state !== "idle") throw new Error("An ad is already active.");
    if (!source.url.trim()) throw new Error("An ad URL is required.");
    this.ad = source;
  }

  saveContentPosition() {
    this.state = "saving";
    this.contentTime = Number.isFinite(this.video.currentTime) ? this.video.currentTime : 0;
    this.resumePlayback = !this.video.paused && !this.video.ended;
    return this.contentTime;
  }

  async playAd() {
    if (!this.ad || this.state !== "idle") return;
    const generation = ++this.generation;
    this.saveContentPosition();
    this.video.pause();
    this.state = "playing";
    this.adVideo.src = this.ad.url;
    this.adVideo.load();
    try {
      await this.adVideo.play();
    } catch (error) {
      if (generation === this.generation) await this.finishAd();
      throw error;
    }
  }

  async finishAd() {
    if (this.state === "idle" || this.state === "finished") return;
    ++this.generation;
    this.state = "finished";
    this.adVideo.pause();
    this.adVideo.removeAttribute("src");
    this.adVideo.load();
    const resume = this.resumePlayback;
    this.restoreContentPosition();
    if (resume) await this.video.play();
  }

  restoreContentPosition() {
    // Content stays on the same source and is paused throughout the ad.
    if (Number.isFinite(this.contentTime) && this.video.currentTime !== this.contentTime) {
      this.video.currentTime = this.contentTime;
    }
    this.state = "idle";
  }

  destroy() {
    ++this.generation;
    this.adVideo.removeEventListener("ended", this.onFinished);
    this.adVideo.removeEventListener("error", this.onFinished);
    this.adVideo.pause();
    this.adVideo.removeAttribute("src");
    this.adVideo.load();
    if (this.state !== "idle") this.restoreContentPosition();
    this.ad = null;
  }

  getState() { return this.state; }
  getPosition() { return this.contentTime; }
}
