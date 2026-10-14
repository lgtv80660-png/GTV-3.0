// TEMPORARY: opt-in, loopback only, no network/export or raw media objects.
type Scalar = number | boolean | string | null;
type RecordData = { [key: string]: Scalar | Scalar[] | number[][] };
type Diagnostic = {
  emit: (event: string, data?: RecordData) => void;
  buffer: (buffer: SourceBuffer) => void;
  stop: () => void;
};
const active = new WeakMap<HTMLVideoElement, Diagnostic>();
export const liveDiagnostic = (video: HTMLVideoElement) => active.get(video);

// Accept only codec syntax, never arbitrary metadata, errors, URLs or IDs.
export function diagnosticCodec(value: unknown): string | null {
  return typeof value === 'string' && /^(?:avc[13]\.[0-9a-f]{6}|mp4a\.40\.\d{1,2}|(?:hvc1|hev1)\.[0-9a-f.]{1,40}|vp09\.[0-9.]{1,30}|av01\.[0-9mhl.]{1,30}|h264|hevc|aac|mp2|mp3|ac3|eac3|opus|vorbis|vp8|vp9|av1)$/i.test(value)
    ? value : null;
}

export function startLiveDiagnostic(video: HTMLVideoElement, signal?: AbortSignal): Diagnostic | undefined {
  try {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ||
        sessionStorage.getItem('gtv.liveDiagnostic') !== '1' || signal?.aborted) return;
  } catch { return; }
  active.get(video)?.stop();
  const records: RecordData[] = [];
  // Overwritten on each attach: callers label their own 2763/2768 exports.
  const target = window as typeof window & { __gtvLiveDiagnostic?: RecordData[] };
  target.__gtvLiveDiagnostic = records;
  const started = performance.now();
  let stopped = false, frameId: number | undefined, frames = 0, previousFrames = 0;
  let previousTime = video.currentTime;
  const hasFrameCallback = typeof video.requestVideoFrameCallback === 'function';
  const removals: (() => void)[] = [];
  const emit: Diagnostic['emit'] = (event, data = {}) => {
    if (stopped || records.length >= 180) return;
    const row = { event, elapsedMs: Math.round(performance.now() - started), ...data };
    records.push(row);
    console.info('[GTV Live diagnostic]', JSON.stringify(row));
  };
  const listen = (target: EventTarget, event: string, callback: EventListener) => {
    target.addEventListener(event, callback);
    removals.push(() => target.removeEventListener(event, callback));
  };
  const finite = (value: number) => Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;
  const sample = (event: string) => {
    const ranges: number[][] = [];
    let ahead = 0;
    for (let i = 0; i < Math.min(video.buffered.length, 8); i++) {
      const start = video.buffered.start(i), end = video.buffered.end(i);
      ranges.push([start, end]);
      if (start <= video.currentTime && end >= video.currentTime) ahead = end - video.currentTime;
    }
    const quality = video.getVideoPlaybackQuality?.();
    const count = hasFrameCallback ? frames : quality?.totalVideoFrames ?? 0;
    emit(event, { readyState: video.readyState, networkState: video.networkState,
      videoWidth: video.videoWidth, videoHeight: video.videoHeight,
      currentTime: finite(video.currentTime), timeDelta: finite(video.currentTime - previousTime),
      buffered: ranges, bufferAhead: finite(ahead), paused: video.paused,
      mediaErrorCode: video.error?.code ?? null,
      frameMethod: hasFrameCallback ? 'requestVideoFrameCallback' : quality ? 'getVideoPlaybackQuality' : 'unavailable',
      frames: count, frameDelta: count - previousFrames,
      droppedFrames: quality?.droppedVideoFrames ?? null });
    previousFrames = count; previousTime = video.currentTime;
  };
  const onFrame: VideoFrameRequestCallback = () => {
    if (stopped) return;
    frames++;
    frameId = video.requestVideoFrameCallback(onFrame);
  };
  const buffers = new WeakSet<SourceBuffer>();
  const diagnostic: Diagnostic = {
    emit,
    buffer: buffer => {
      if (stopped || buffers.has(buffer)) return;
      buffers.add(buffer);
      listen(buffer, 'error', () => emit('mse-sourcebuffer-error', { updating: buffer.updating }));
      listen(buffer, 'abort', () => emit('mse-sourcebuffer-abort', { updating: buffer.updating }));
    },
    stop: () => {
      if (stopped) return;
      emit('stop'); stopped = true;
      clearInterval(interval); clearTimeout(timeout);
      if (frameId !== undefined) video.cancelVideoFrameCallback(frameId);
      removals.forEach(remove => remove());
      signal?.removeEventListener('abort', diagnostic.stop);
      if (active.get(video) === diagnostic) active.delete(video);
    },
  };
  active.set(video, diagnostic);
  for (const event of ['error', 'loadedmetadata', 'loadeddata', 'playing', 'waiting', 'stalled', 'emptied', 'desktopfallback']) {
    listen(video, event, () => sample(event));
  }
  const interval = setInterval(() => sample('sample'), 2000);
  const timeout = setTimeout(diagnostic.stop, 120000);
  signal?.addEventListener('abort', diagnostic.stop, { once: true });
  if (hasFrameCallback) frameId = video.requestVideoFrameCallback(onFrame);
  sample('start');
  return diagnostic;
}
