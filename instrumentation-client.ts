// Local, explicitly enabled, passive Live diagnostics. No network submission.
if (['127.0.0.1', 'localhost'].includes(location.hostname) && new URLSearchParams(location.search).get('liveDiagnostics') === '5') {
  try {
    const started = performance.now();
    const rows: unknown[] = [];
    const bindings = new Map<HTMLVideoElement, () => void>();
    const audioEnabled=new URLSearchParams(location.search).get('liveAudioDiagnostics')==='5';
    let audioContext:AudioContext|null=null;
    let audioProbe:{video:HTMLVideoElement;stream:MediaStream;source:MediaStreamAudioSourceNode;analyser:AnalyserNode;gain:GainNode}|null=null;
    const releaseAudio=()=>{if(!audioProbe)return;audioProbe.source.disconnect();audioProbe.analyser.disconnect();audioProbe.gain.disconnect();audioProbe.stream.getTracks().forEach(track=>track.stop());audioProbe=null;};
    const output = document.createElement('pre');
    output.id = 'gtv-phase5-diagnostics'; output.hidden = true;
    document.documentElement.appendChild(output);
    const download = document.createElement('a');
    download.id='gtv-phase5-download';download.hidden=true;download.download='LIVE-WARS-PHASE-5-BROWSER.json';document.documentElement.appendChild(download);
    let exportUrl='';
    const publish=()=>{const text=JSON.stringify({version:5,epoch:performance.timeOrigin,rows});output.textContent=text;if(exportUrl)URL.revokeObjectURL(exportUrl);exportUrl=URL.createObjectURL(new Blob([text],{type:'application/json'}));download.href=exportUrl;};
    const add = (event: string, data: object = {}) => { if (rows.length < 2400) rows.push({ms: Math.round(performance.now() - started), event, ...data}); };
    const sample = (video: HTMLVideoElement) => {
      const q = video.getVideoPlaybackQuality?.();
      const audio = (video as HTMLVideoElement & {webkitAudioDecodedByteCount?: number}).webkitAudioDecodedByteCount;
      const heap=(performance as Performance & {memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize;
      return {time: video.currentTime,duration:Number.isFinite(video.duration)?video.duration:null,ended:video.ended, readyState: video.readyState, networkState: video.networkState, width: video.videoWidth, height: video.videoHeight, paused: video.paused, muted: video.muted,volume:video.volume, rate: video.playbackRate, decoded: q?.totalVideoFrames, dropped: q?.droppedVideoFrames, audioBytes: audio ?? null,jsHeapBytes:heap??null, error: video.error?.code ?? null, kind: video.currentSrc.startsWith('blob:') ? 'MSE' : video.currentSrc.includes('/live/stream/') ? 'Engine' : 'other', buffer: Array.from({length:video.buffered.length},(_,i)=>[video.buffered.start(i),video.buffered.end(i)])};
    };
    const click = (e: MouseEvent) => {
      const el = (e.target as Element)?.closest('[role="checkbox"],button');
      const text = el?.textContent || '';
      const id = /Chaîne\s+(\d+)/.exec(text)?.[1];
      if (id) {add('selection', {id});if(audioEnabled){audioContext??=new AudioContext();void audioContext.resume().catch(()=>{});}}
    };
    document.addEventListener('click', click, true);
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        const path = new URL(entry.name).pathname;
        if (/^\/api\/(hls|hlsseg|desktop|live|stream-live)$|^\/(health|handshake|authorize|live\/)/.test(path)) {
          // Session IDs, opaque resources, query strings and origins are omitted.
          add('request', {path:path.replace(/\/[0-9A-Fa-f]{16,}/g,'/:opaque'), start:Math.round(entry.startTime-started), duration:Math.round(entry.duration), ttfb:entry.responseStart>0?Math.round(entry.responseStart-entry.startTime):null, bytes:entry.transferSize});
        }
      }
    });
    observer.observe({type:'resource', buffered:false});
    const timer = setInterval(() => {
      try {
        for (const video of document.querySelectorAll('video')) {
          if (!bindings.has(video)) {
            const events = ['waiting','stalled','play','pause','ended','playing','loadedmetadata','loadeddata','canplay','seeking','seeked','emptied','error'];
            let callback = 0, last = 0, count = 0, first = false;
            const onEvent = (e: Event) => {if(e.type==='emptied'){first=false;last=0;if(audioProbe?.video===video)releaseAudio();}add(e.type, sample(video));};
            events.forEach(event=>video.addEventListener(event,onEvent));
            const frame: VideoFrameRequestCallback = (now, metadata) => {
              if (!first) {first=true;add('first-frame',{mediaTime:metadata.mediaTime});}
              if (last && now-last>100) add('frame-gap',{gap:Math.round(now-last),mediaTime:metadata.mediaTime});
              last=now; count++;
              callback=video.requestVideoFrameCallback(frame);
            };
            if (video.requestVideoFrameCallback) callback=video.requestVideoFrameCallback(frame);
            bindings.set(video,()=>{events.forEach(event=>video.removeEventListener(event,onEvent));if(callback)video.cancelVideoFrameCallback(callback);add('release',{framesPresented:count});});
            add('video-bound');
          }
          add('sample',sample(video));
          if(audioEnabled&&audioContext&&video.readyState>=3&&!video.paused){
            if(!audioProbe){const capture=(video as HTMLVideoElement & {captureStream?:()=>MediaStream}).captureStream;if(capture){const stream=capture.call(video);if(stream.getAudioTracks().length){const source=audioContext.createMediaStreamSource(stream),analyser=audioContext.createAnalyser(),gain=audioContext.createGain();analyser.fftSize=2048;gain.gain.value=0;source.connect(analyser);analyser.connect(gain);gain.connect(audioContext.destination);audioProbe={video,stream,source,analyser,gain};}else stream.getTracks().forEach(track=>track.stop());}}
            if(audioProbe){const values=new Float32Array(audioProbe.analyser.fftSize);audioProbe.analyser.getFloatTimeDomainData(values);let sum=0,peak=0;for(const value of values){sum+=value*value;peak=Math.max(peak,Math.abs(value));}add('audio-rms',{rms:Math.sqrt(sum/values.length),peak,contextState:audioContext.state,trackStates:audioProbe.stream.getAudioTracks().map(track=>track.readyState)});}
          }
        }
        for (const [video, dispose] of bindings) if (!video.isConnected) {dispose();bindings.delete(video);if(audioProbe?.video===video)releaseAudio();}
        if(rows.length % 4 === 0) publish();
      } catch { add('observer-error'); }
    },250);
    const originalFetch=window.fetch;
    const observedFetch:typeof fetch=async (...args)=>{const response=await originalFetch(...args);try{const input=args[0];const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);if(u.origin==='http://127.0.0.1:17891'&&/^\/live\/(probe|session|play|open)/.test(u.pathname)){void response.clone().json().then(state=>{add('engine-state',{endpoint:u.pathname.split('/').slice(0,3).join('/'),httpStatus:response.status,code:state.code,exceptionType:state.details?.exceptionType,causeType:state.details?.causeType,state:state.state,failureCode:state.failureCode,attempt:state.attempt,busy:state.busy,reconnects:state.reconnects,strategy:state.strategy,playable:state.playable,videoProbe:(state.media?.streams||state.tracks||[]).filter((s:any)=>s.codec_type==="video").map((s:any)=>({codec:s.codec_name,fieldOrder:s.field_order,width:s.width,height:s.height,profile:s.profile})),active:state.active?{strategy:state.active.strategy,video:state.active.video,audio:state.active.audio}:null,zeroStall:state.zeroStall});}).catch(()=>{});}}catch{}return response;};
    window.fetch=observedFetch;
    setTimeout(()=>{clearInterval(timer);observer.disconnect();document.removeEventListener('click',click,true);if(window.fetch===observedFetch)window.fetch=originalFetch;for(const dispose of bindings.values())dispose();bindings.clear();releaseAudio();void audioContext?.close();add('diagnostics-ended');publish();},180000);
  } catch { /* Diagnostics must never interrupt playback. */ }
}
