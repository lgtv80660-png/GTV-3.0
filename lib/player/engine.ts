import { tryDesktop } from "./desktop";
import { nativeVodSupported } from "./vod-compatibility";
import { diagnosticCodec, liveDiagnostic, startLiveDiagnostic } from "./live-diagnostic";
export type EngineKind =
  | "mpegts"
  | "hls"
  | "native"
  | "unsupported"
  | "desktop";

export interface EngineHandle {
  kind: EngineKind;
  destroy: () => void;
  getDuration?: () => number;
  getCurrentTime?: () => number;
  seek?: (seconds: number) => void;
  isRecovering?: () => boolean;
}

const NATIVE_OK = [
  "mp4",
  "m4v",
  "mov",
  "webm",
  "ogg",
];

const RISKY = [
  "mkv",
  "avi",
  "wmv",
  "flv",
];

export function pickEngine(
  url: string,
  ext: string,
  isLive: boolean,
): EngineKind {
  const u = url.toLowerCase();

  const e = ext
    .toLowerCase()
    .replace(/^\./, "");

  if (isLive && e === "ts") return "mpegts";

  /*
   * HLS
   * - Live
   * - m3u8
   * - API HLS Live
   * - API HLS VOD Apple
   */
  if (
    isLive ||
    e === "m3u8" ||
    u.includes("ext=m3u8") ||
    u.includes("/api/hls") ||
    u.includes("/api/vod-hls") ||
    /\.m3u8(\?|$)/.test(u)
  ) {
    return "hls";
  }

  if (e === "ts") {
    return "mpegts";
  }

  if (
    NATIVE_OK.includes(e) ||
    RISKY.includes(e)
  ) {
    return "native";
  }

  return "native";
}

async function attachGtv(
  video: HTMLVideoElement,
  opts: {
    url: string;
    ext: string;
    isLive: boolean;
    signal?: AbortSignal;
  },
): Promise<EngineHandle> {
  if (opts.isLive) {
    // Probe only the authenticated local relay, never a provider URL.
    const source = new URL(opts.url, location.origin);
    if (source.origin !== location.origin) throw Error('Invalid Live source');
    const controller = new AbortController();
    const cancel = () => controller.abort();
    opts.signal?.addEventListener('abort', cancel, {once:true});
    const timer = setTimeout(cancel, 5000);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      if (opts.signal?.aborted) cancel();
      const response = await fetch(source, {credentials:'same-origin',cache:'no-store',signal:controller.signal});
      if (!response.ok || !response.body) throw Error('Live unavailable');
      reader = response.body.getReader();
      const prefix = new Uint8Array(564); let length = 0;
      while (length < prefix.length) {
        const next = await reader.read(); if (next.done) break;
        const part = next.value.subarray(0, prefix.length - length);
        prefix.set(part, length); length += part.length;
        if (new TextDecoder().decode(prefix.subarray(0,length)).replace(/^\uFEFF/, '').trimStart().startsWith('#EXTM3U')) break;
      }
      const hls = new TextDecoder().decode(prefix.subarray(0,length)).replace(/^\uFEFF/, '').trimStart().startsWith('#EXTM3U');
      const ts = length >= 377 && prefix[0] === 0x47 && prefix[188] === 0x47 && prefix[376] === 0x47;
      if (!hls && !ts) throw Error('Unsupported Live format');
      opts = {...opts, ext:ts?'ts':'m3u8'};
    } finally {
      controller.abort();
      await reader?.cancel().catch(()=>{}); reader?.releaseLock();
      clearTimeout(timer); opts.signal?.removeEventListener('abort', cancel);
    }
  }
  const kind = pickEngine(
    opts.url,
    opts.ext,
    opts.isLive,
  );
  const assertCurrent=()=>{if(opts.signal?.aborted)throw new DOMException('Cancelled','AbortError');};
  assertCurrent();

  /* =====================================================
     HLS
  ===================================================== */

  if (kind === "hls") {
    /*
     * APPLE / SAFARI
     *
     * Safari iPhone/iPad possède un moteur HLS natif.
     * On le teste AVANT hls.js.
     */
    const nativeHlsSupported =
      !!video.canPlayType(
        "application/vnd.apple.mpegurl",
      ) ||
      !!video.canPlayType(
        "application/x-mpegURL",
      );

    if (nativeHlsSupported) {
      video.src = opts.url;

      return {
        kind: "native",

        destroy: () => {
          try {
            video.pause();
          } catch {}

          try {
            video.removeAttribute("src");
            video.load();
          } catch {}
        },
      };
    }

    /*
     * Chrome / Edge / Firefox / navigateurs MSE
     */
    const Hls = (
      await import("hls.js")
    ).default;
    assertCurrent();

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,

        lowLatencyMode: false,

        backBufferLength: 30,

        maxBufferLength: 30,

        maxMaxBufferLength: 60,

        manifestLoadingMaxRetry: 4,

        levelLoadingMaxRetry: 6,

        fragLoadingMaxRetry: 8,

        fragLoadingRetryDelay: 500,

        ...(opts.isLive
          ? {
              liveSyncDurationCount: 3,
              liveMaxLatencyDurationCount: 10,
            }
          : { startPosition: 0 }),
      });

      const diagnostic = opts.isLive ? liveDiagnostic(video) : undefined;
      if (diagnostic) {
        hls.on(Hls.Events.ERROR, (_event, data) => {
          // Never emit data, reason, error.message, fragment or response objects.
          diagnostic.emit('hls-error', {
            fatal: data.fatal,
            type: Object.values(Hls.ErrorTypes).includes(data.type) ? data.type : 'unknown',
            details: Object.values(Hls.ErrorDetails).includes(data.details) ? data.details : 'unknown',
            mediaErrorCode: video.error?.code ?? null,
          });
        });
        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          diagnostic.emit('hls-codecs', {
            videoCodecs: data.levels.slice(0, 8).map(level => diagnosticCodec(level.videoCodec)),
            audioCodecs: data.levels.slice(0, 8).map(level => diagnosticCodec(level.audioCodec)),
          });
        });
        hls.on(Hls.Events.BUFFER_CREATED, (_event, data) => {
          for (const kind of ['audio', 'video', 'audiovideo'] as const) {
            const track = data.tracks[kind];
            if (!track) continue;
            diagnostic.emit('mse-buffer-created', { kind, codec: diagnosticCodec(track.codec) });
            if (track.buffer) diagnostic.buffer(track.buffer);
          }
        });
      }

      hls.on(
        Hls.Events.ERROR,
        (_e, data) => {
          if (!data.fatal) {
            return;
          }

          if (
            data.type ===
            Hls.ErrorTypes.NETWORK_ERROR
          ) {
            try {
              hls.startLoad();
            } catch {}

            return;
          }

          if (
            data.type ===
            Hls.ErrorTypes.MEDIA_ERROR
          ) {
            try {
              hls.recoverMediaError();
            } catch {}

            return;
          }

          try {
            hls.destroy();
          } catch {}
        },
      );

      hls.loadSource(
        opts.url,
      );

      hls.attachMedia(
        video,
      );

      return {
        kind: "hls",

        destroy: () => {
          try {
            hls.destroy();
          } catch {}
        },
      };
    }

    /*
     * Fallback HLS
     */
    video.src = opts.url;

    return {
      kind: "native",

      destroy: () => {
        try {
          video.pause();
        } catch {}

        try {
          video.removeAttribute("src");
          video.load();
        } catch {}
      },
    };
  }

  /* =====================================================
     MPEG-TS
  ===================================================== */

  if (kind === "mpegts") {
    // @ts-ignore
    const mpegts = (
      await import("mpegts.js")
    ).default;

    if (
      mpegts &&
      (
        mpegts.getFeatureList()
          .mseLivePlayback ||
        mpegts.isSupported()
      )
    ) {
      const player =
        mpegts.createPlayer(
          {
            type: "mpegts",
            isLive: opts.isLive,
            url: opts.url,
          },
          {
            enableStashBuffer: false,

            stashInitialSize: 128,

            lazyLoad: false,

            liveBufferLatencyChasing:
              opts.isLive,

            liveBufferLatencyChasingOnPaused:
              false,

            liveBufferLatencyMaxLatency:
              3.0,

            liveBufferLatencyMinRemain:
              0.5,

            autoCleanupSourceBuffer:
              true,
          },
        );

      assertCurrent();
      player.attachMediaElement(
        video,
      );

      player.load();

      return {
        kind: "mpegts",

        destroy: () => {
          try {
            player.destroy();
          } catch {}
        },
      };
    }

    video.src = opts.url;

    return {
      kind: "native",

      destroy: () => {
        try {
          video.pause();
        } catch {}

        try {
          video.removeAttribute("src");
          video.load();
        } catch {}
      },
    };
  }

  /* =====================================================
     NATIVE MP4 / MOV / WEBM / ETC.
  ===================================================== */

  video.src = opts.url;

  return {
    kind: "native",

    destroy: () => {
      try {
        video.pause();
      } catch {}

      try {
        video.removeAttribute("src");
        video.load();
      } catch {}
    },
  };
}

type AttachOptions = {url:string;ext:string;isLive:boolean;desktopSource?:string;signal?:AbortSignal};

export async function attach(video: HTMLVideoElement, opts: AttachOptions): Promise<EngineHandle> {
  const diagnostic = opts.isLive ? startLiveDiagnostic(video, opts.signal) : undefined;
  if (!diagnostic) return attachInternal(video, opts);
  try {
    const handle = await attachInternal(video, opts);
    diagnostic.emit('engine', { kind: handle.kind });
    return { ...handle, destroy: () => { diagnostic.stop(); handle.destroy(); } };
  } catch (error) {
    diagnostic.emit('attach-failed');
    diagnostic.stop();
    // Preserve the original exception and its existing playback handling.
    throw error;
  }
}

async function attachInternal(video: HTMLVideoElement, opts: AttachOptions):Promise<EngineHandle> {
  const isVodDirect=!opts.isLive&&/^\/api\/vod-direct\?/.test(opts.url);
  const desktop=isVodDirect?null:await tryDesktop(video,opts,()=>attachGtv(video,opts));
  if(opts.signal?.aborted) { desktop?.destroy(); throw new DOMException('Cancelled','AbortError'); }
  if(desktop)return desktop;
  if(!opts.isLive && /^\/api\/vod-direct\?/.test(opts.url)){
    const source=new URL(opts.url,location.origin),planUrl=new URL(source);planUrl.pathname='/api/vod-plan';
    const response=await fetch(planUrl.pathname+planUrl.search,{signal:opts.signal,credentials:'same-origin',cache:'no-store'});
    const plan=await response.json().catch(()=>({}));
    // A failed metadata probe is not evidence that native playback is unsupported.
    // Only this upstream failure may use the authenticated, policy-checked relay.
    const probeUnavailable=response.status===503&&plan.code==='MEDIA_PROBE_UPSTREAM'&&plan.diagnostic?.upstreamStatus===502&&!plan.diagnostic?.blockedOrigin;
    if(!response.ok&&!probeUnavailable){const denied=plan;const origin=denied?.diagnostic?.blockedOrigin;let message='Media compatibility unavailable';if(typeof origin==='string'){try{const target=new URL(origin);if(target.origin===origin&&!target.username&&!target.password)message='Origine média à valider : '+target.origin+(denied.code==='MEDIA_TLS_REQUIRED'?' (HTTPS requis).':'.');}catch{}}const error=new Error(message);error.name=message.startsWith('Origine média')?'MediaPolicyError':'Error';throw error;}
    const media=plan.media;
    // Container support and decoded video do not establish audio compatibility.
    // Direct playback is reserved for a known browser audio format; other audio
    // uses the existing video-copy/AAC path and its server seek handling.
    let nativeHandle:EngineHandle|undefined;
    if(nativeVodSupported(media,opts.ext,mime=>video.canPlayType(mime))){
    const native=await attachGtv(video,opts);
    try{
      await new Promise<void>((resolve,reject)=>{
        const finish=(error?:Error)=>{clearTimeout(timer);video.removeEventListener('loadeddata',ready);video.removeEventListener('error',failed,{capture:true});opts.signal?.removeEventListener('abort',cancel);error?reject(error):resolve();};
        const ready=()=>finish(Number.isFinite(video.duration)&&video.duration>0&&video.videoWidth>0?undefined:Error('Native timeline unavailable')),failed=(event:Event)=>{event.stopImmediatePropagation();finish(Error('Native media unsupported'));},cancel=()=>finish(new DOMException('Cancelled','AbortError'));
        const timer=setTimeout(()=>finish(Error('Native startup timeout')),10000);
        video.addEventListener('loadeddata',ready,{once:true});video.addEventListener('error',failed,{once:true,capture:true});opts.signal?.addEventListener('abort',cancel,{once:true});
        if(opts.signal?.aborted)cancel();else if(video.readyState>=2)ready();
      });
      nativeHandle=native;
    }catch{native.destroy();if(opts.signal?.aborted)throw new DOMException('Cancelled','AbortError');}
  }

    const fallback=async():Promise<EngineHandle>=>{
    // Unknown codecs must not select an audio conversion or server-seek plan.
    if(!media)throw Error('Native playback unavailable; media probe failed');
    const codec=media.video.codec;
    const copyVideo=codec==='h264'||(codec==='hevc'&&!!video.canPlayType('video/mp4; codecs="hvc1.1.6.L120.B0"'));
    if(copyVideo){
      source.pathname='/api/stream-vod';let pending:number|null=null,offset=0,generation=0,resumeAfterSeek=false;let metadataListener:(()=>void)|undefined;let seekAbort:AbortController|undefined;
      const handle=await attachGtv(video,{...opts,url:source.pathname+source.search,ext:'mp4'});
      return {...handle,getDuration:()=>media.duration,getCurrentTime:()=>pending??(offset+(Number.isFinite(video.currentTime)?video.currentTime:0)),isRecovering:()=>pending!==null,
        destroy:()=>{generation++;seekAbort?.abort();if(metadataListener)video.removeEventListener('loadedmetadata',metadataListener);handle.destroy();},
        seek:(seconds:number)=>{if(pending===null)resumeAfterSeek=!video.paused;pending=Math.max(0,Math.min(seconds,Math.max(0,media.duration-0.05)));const target=pending,own=++generation;video.pause();
          seekAbort?.abort();seekAbort=new AbortController();
          // Release the old media pipe immediately, before waiting for a keyframe probe.
          video.removeAttribute('src');video.load();
          if(metadataListener)video.removeEventListener('loadedmetadata',metadataListener);
          const seekPlan=new URL(planUrl);seekPlan.searchParams.set('t',String(target));
          void fetch(seekPlan.pathname+seekPlan.search,{signal:opts.signal?AbortSignal.any([opts.signal,seekAbort.signal]):seekAbort.signal,credentials:'same-origin',cache:'no-store'}).then(async response=>{
            if(!response.ok)throw Error('Seek unavailable');const plan=await response.json();if(own!==generation||opts.signal?.aborted)return;
            if(!Number.isFinite(plan.seekStart)||plan.seekStart<0||plan.seekStart>target+0.1)throw Error('Seek unavailable');
            offset=plan.seekStart;source.searchParams.set('t',String(target));
            // The server starts at a decodable keyframe and resets MP4 timestamps.
            // This pipe has no byte ranges: do not seek it again before buffering.
            metadataListener=()=>{if(own!==generation||opts.signal?.aborted)return;pending=null;if(resumeAfterSeek)void video.play().catch(()=>{});};
            video.addEventListener('loadedmetadata',metadataListener,{once:true});video.src=source.pathname+source.search;video.load();
          }).catch(()=>{if(own===generation&&!opts.signal?.aborted){pending=null;video.dispatchEvent(new Event('error'));}});
        }
      };
    }
    if(media.video.hdr||/10|12/.test(media.video.pixelFormat))throw Error('A compatible HDR/bit-depth playback device is required');
    source.pathname='/api/vod-hls';
    return attachGtv(video,{...opts,url:source.pathname+source.search,ext:'m3u8'});
    };
    if(!nativeHandle)return fallback();

    // Keep the same public handle when a later decode or Range seek fails.
    let active=nativeHandle,stopped=false,recovering=false,usedFallback=false,pending:number|null=null;
    const recoveryAbort=new AbortController();
    let watchdog:ReturnType<typeof setTimeout>|undefined;
    const clearWatchdog=()=>clearTimeout(watchdog);
    const recover=async()=>{
      if(stopped||usedFallback||opts.signal?.aborted)return;
      usedFallback=true;recovering=true;clearWatchdog();
      const at=pending??video.currentTime,paused=video.paused;
      active.destroy();
      try{
        active=await fallback();
        if(stopped||opts.signal?.aborted){active.destroy();return;}
        const resume=()=>{
          if(stopped||opts.signal?.aborted)return;
          const target=pending??at;
          if(target>0){if(active.seek)active.seek(target);else video.currentTime=target;}
          pending=null;recovering=false;
          if(!paused)void video.play().catch(()=>{});
          video.dispatchEvent(new Event('durationchange'));
        };
        if(video.readyState>=1)resume();else video.addEventListener('loadedmetadata',resume,{once:true,signal:opts.signal?AbortSignal.any([opts.signal,recoveryAbort.signal]):recoveryAbort.signal});
      }catch{if(!stopped&&!opts.signal?.aborted){recovering=false;video.dispatchEvent(new Event('error'));}}
    };
    const onError=(event:Event)=>{if(!usedFallback&&!stopped){event.stopImmediatePropagation();void recover();}};
    const onWaiting=()=>{if(usedFallback||stopped)return;clearWatchdog();watchdog=setTimeout(()=>void recover(),10000);};
    const onSeeked=()=>{if(!recovering)pending=null;clearWatchdog();};
    video.addEventListener('error',onError,true);video.addEventListener('waiting',onWaiting);video.addEventListener('playing',clearWatchdog);video.addEventListener('seeked',onSeeked);
    return {kind:'native',getDuration:()=>active.getDuration?.()||media.duration,getCurrentTime:()=>pending??active.getCurrentTime?.()??video.currentTime,isRecovering:()=>recovering||!!active.isRecovering?.(),
      seek:(at:number)=>{if(recovering){pending=at;return;}if(active.seek)active.seek(at);else {pending=at;try{video.currentTime=at;onWaiting();}catch{void recover();}}},
      destroy:()=>{stopped=true;recoveryAbort.abort();clearWatchdog();video.removeEventListener('error',onError,{capture:true});video.removeEventListener('waiting',onWaiting);video.removeEventListener('playing',clearWatchdog);video.removeEventListener('seeked',onSeeked);active.destroy();}
    };
  }
  const fallback=await attachGtv(video,opts);
  if(opts.signal?.aborted){fallback.destroy();throw new DOMException('Cancelled','AbortError');}
  return fallback;
}
