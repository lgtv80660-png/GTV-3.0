import type { EngineHandle } from './engine';
import { report, type Media } from './desktop-capabilities';
import { diagnosticCodec, liveDiagnostic } from './live-diagnostic';

const base='http://127.0.0.1:17891';
type Options={url:string;ext:string;isLive:boolean;signal?:AbortSignal;desktopSource?:string};
type Plan={id:string;stream:string;strategy:string;playable:boolean;media:Media;audioActive:number};
type Owner={controller:AbortController;destroy:()=>void};
const owners=new WeakMap<HTMLVideoElement,Owner>();
let liveStop:Promise<boolean>=Promise.resolve(true);

export async function tryDesktop(video:HTMLVideoElement,opts:Options,fallback:()=>Promise<EngineHandle>):Promise<EngineHandle|null> {
  // The original opaque GTV source identifies media; never resolve or accept an upstream URL.
  const source=new URL(opts.desktopSource||opts.url,location.origin);
  if(source.origin!==location.origin || !['/api/resolve','/api/vod-direct','/api/vod-hls','/api/stream-vod','/api/hls','/api/live','/api/stream-live'].includes(source.pathname))return null;
  const id=source.searchParams.get('id'),type=opts.isLive?'live':source.searchParams.get('type');
  if(!id||!/^\d+$/.test(id)||!['movie','series','live'].includes(type||''))return null;
  owners.get(video)?.destroy();
  const controller=new AbortController();
  let stopped=false,token='',binding='',sessionId='',url='',plan:Plan|null=null;
  let downstream:EngineHandle|null=null,failed=false,recovering=false,pending:number|null=null;
  let startup:ReturnType<typeof setTimeout>|undefined;
  let lastProgress=0;
  let rescueActive=false;
  let mediaGeneration=0;
  let lastStopConfirmed=true;
  const timers=new Set<ReturnType<typeof setTimeout>>();
  const tracks:HTMLTrackElement[]=[];
  const blobs:string[]=[];
  const request=async(path:string,data?:unknown,timeout=4500,cleanup=false)=>{
    const response=await fetch(base+path,{method:data===undefined?'GET':'POST',credentials:'omit',cache:'no-store',headers:{'X-GTV-Token':token,...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data),signal:cleanup?AbortSignal.timeout(1200):AbortSignal.any([controller.signal,AbortSignal.timeout(timeout)])});
    if(!response.ok)throw Error('Engine unavailable');
    if(response.headers.get('content-length')==='0')return {};
    return response.json().catch(()=>({}));
  };
  const cleanupSession=async()=>{const old=sessionId;sessionId='';if(!old)return lastStopConfirmed;try{await request((opts.isLive?'/live/stop/':'/stop/')+old,{},1200,true);return lastStopConfirmed=true;}catch{return lastStopConfirmed=false;}};
  const revoke=()=>{if(binding)void fetch('/api/desktop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'revoke',binding}),keepalive:true,signal:AbortSignal.timeout(1200)}).catch(()=>{});};
  const destroy=()=>{
    if(stopped)return;stopped=true;controller.abort();
    clearTimeout(startup);clearTimeout(setupTimer);for(const t of timers)clearTimeout(t);
    video.removeEventListener('error',onError,true);video.removeEventListener('playing',onPlaying);video.removeEventListener('waiting',onWaiting);video.removeEventListener('timeupdate',onTime);
    for(const t of tracks)t.remove();for(const b of blobs)URL.revokeObjectURL(b);
    downstream?.destroy();
    if(owners.get(video)===owner){video.pause();video.removeAttribute('src');video.load();owners.delete(video);}
    const stopping=cleanupSession();if(opts.isLive)liveStop=stopping;revoke();
  };
  const owner:Owner={controller,destroy};owners.set(video,owner);
  const setupTimer=setTimeout(destroy,10000);
  const owns=()=>!stopped&&!controller.signal.aborted&&owners.get(video)===owner;
  const abort=()=>destroy();opts.signal?.addEventListener('abort',abort,{once:true});
  controller.signal.addEventListener('abort',()=>opts.signal?.removeEventListener('abort',abort),{once:true});
  const position=()=>pending??(Number.isFinite(video.currentTime)?video.currentTime:0);
  const recover=async()=>{
    if(!owns()||failed)return;failed=true;recovering=true;
    const at=position(),wasPaused=video.paused;clearTimeout(startup);
    // No new Engine attempt in this session, even when fallback also fails.
    video.pause();video.removeAttribute('src');video.load();
    const stopping=cleanupSession();if(opts.isLive)liveStop=stopping;
    await stopping;revoke();
    if(!owns())return;
    try {
      downstream=await fallback();
      if(!owns()){downstream.destroy();return;}
      const resumed=()=>{if(!owns())return;if(!opts.isLive&&at>0)video.currentTime=at;pending=null;recovering=false;if(opts.isLive||!wasPaused)void video.play().catch(()=>{});};
      video.addEventListener('loadedmetadata',resumed,{once:true,signal:controller.signal});
      if(video.readyState>=1)resumed();
      video.dispatchEvent(new Event('desktopfallback'));
    }catch{recovering=false;video.dispatchEvent(new Event('error'));}
  };
  async function rescueLive(){
    if(!owns()||failed||rescueActive)return;
    rescueActive=true;recovering=true;clearTimeout(startup);
    video.pause();video.removeAttribute('src');video.load();
    try {
      for(let n=0;n<6;n++){
        const state=await request('/live/session/'+sessionId,undefined,1200);
        if(!owns())return;
        if(state.state==='FAILED'||state.state==='STOPPED')throw Error('Exhausted');
        if(!state.busy){
          const timer=setTimeout(()=>{timers.delete(timer);rescueActive=false;if(owns()) {load();void video.play().catch(()=>{});}},Math.min(4000,Math.max(0,state.retryAfterMs||0)));
          timers.add(timer);return;
        }
        await new Promise<void>(resolve=>{const timer=setTimeout(()=>{timers.delete(timer);resolve();},500);timers.add(timer);controller.signal.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});});
      }
      throw Error('Release timeout');
    }catch{if(owns())void recover();}finally{rescueActive=false;}
  }
  function onError(){if(owns()&&!failed)void (opts.isLive?rescueLive():recover());}
  function onPlaying(){clearTimeout(startup);}
  function onWaiting(){if(!owns()||failed||video.paused)return;clearTimeout(startup);startup=setTimeout(()=>{if(owns()&&video.readyState<3)void (opts.isLive?rescueLive():recover());},12000);}
  async function onTime(){
    if(!owns()||failed||!opts.isLive||video.paused||video.readyState<3||Date.now()-lastProgress<3000)return;
    lastProgress=Date.now();
    try {const state=await request('/live/session/'+sessionId,undefined,1200);if(!owns())return;
      if(state.state==='FAILED'||state.state==='STOPPED'){void recover();return;}
      if(state.state==='CONNECTED'&&state.busy)await request('/live/progress/'+sessionId,{attempt:state.attempt,position:video.currentTime},1200);
      // No backups are supplied by the current GTV contract. Never invent Fusion sources.
    }catch{if(owns())void recover();}
  }
  const mediaUrl=(path:string)=>base+path+(path.includes('?')?'&':'?')+'token='+encodeURIComponent(token);
  const load=(at=0)=>{
    if(!owns()||!plan)return;
    const generation=++mediaGeneration;
    pending=at;recovering=true;video.pause();
    const metadata=()=>{if(!owns()||failed||generation!==mediaGeneration)return;video.currentTime=at;pending=null;recovering=false;video.dispatchEvent(new Event('durationchange'));};
    video.addEventListener('loadedmetadata',metadata,{once:true,signal:controller.signal});
    video.crossOrigin='anonymous'; // Prevent local GTV cookies from reaching loopback Engine.
    video.src=mediaUrl(opts.isLive?plan.stream:plan.stream+'?offset='+at);video.load();
    clearTimeout(startup);startup=setTimeout(()=>{if(owns()&&video.readyState<3)void (opts.isLive?rescueLive():recover());},opts.isLive?24000:12000);
  };
  try {
    if(opts.signal?.aborted)throw Error('Cancelled');
    const discovery=await Promise.all(['/health','/handshake'].map(async path=>{
      const r=await fetch(base+path,{credentials:'omit',cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(550)])});if(!r.ok)throw Error('Unavailable');return r.json();
    }));
    if(!owns()||discovery[0].status!=='READY'||discovery.some(d=>d.protocol!=='gtv-engine/1'))throw Error('Incompatible');
    token=discovery[1].token;if(!/^[0-9A-F]{64}$/.test(token))throw Error('Incompatible');
    if(opts.isLive && !await liveStop)throw Error('Previous Live Stop unconfirmed');
    if(!owns())throw Error('Cancelled');
    binding=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
    const r=await fetch('/api/desktop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'grant',id,type,ext:source.searchParams.get('ext')||opts.ext||'mp4',binding}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(4500)])});
    if(!r.ok)throw Error('Unauthorized');const grant=await r.json();
    if(!owns()||grant.protocol!=='gtv-media/1')throw Error('Cancelled');
    const authorized=await request('/authorize',{ticket:grant.ticket,binding});url=authorized.url;
    if(!owns())throw Error('Cancelled');
    const probe=await request(opts.isLive?'/live/probe':'/probe',{url},7000);
    const media:Media=opts.isLive?probe.media:probe;
    if(!owns())throw Error('Cancelled');
    if(opts.isLive)liveDiagnostic(video)?.emit('desktop-probe-codecs', {
      videoCodecs: media.streams.filter(s=>s.codec_type==='video').slice(0,8).map(s=>diagnosticCodec(s.codec_name)),
      audioCodecs: media.streams.filter(s=>s.codec_type==='audio').slice(0,8).map(s=>diagnosticCodec(s.codec_name)),
    });
    // Current VOD/Live controls expose no track selection API. Preserve such media
    // through GTV instead of silently removing subtitles or additional audio.
    if(media.streams.some(s=>s.codec_type==='subtitle') || media.streams.filter(s=>s.codec_type==='audio').length>1)throw Error('Track controls incompatible');
    plan=await request(opts.isLive?'/live/play':'/play',{url,type:opts.isLive?'Live':'Auto',audio:-1,capabilities:report(video,media,-1,opts.isLive,id),...(opts.isLive?{probeId:probe.probeId}:{})},7000);
    sessionId=plan!.id;
    if(!owns()||!plan?.playable)throw Error('Incompatible');
    if(opts.isLive){const opened=await request('/live/open',{id:sessionId},5000);if(!owns())throw Error('Cancelled');plan.stream=opened.stream;}
    video.addEventListener('error',onError,true);video.addEventListener('playing',onPlaying);video.addEventListener('waiting',onWaiting);video.addEventListener('timeupdate',onTime);
    clearTimeout(setupTimer);load();
    const handle:EngineHandle={kind:'desktop',destroy,getDuration:()=>failed?(Number.isFinite(video.duration)?video.duration:0):Math.max(0,Number(plan?.media.format.duration||0)-Number(plan?.media.format.start_time||0)),getCurrentTime:position,isRecovering:()=>recovering,
      seek:(at:number)=>{if(failed||plan?.strategy==='DIRECT'){video.currentTime=at;return;}const paused=video.paused;load(at);if(!paused)void video.play().catch(()=>{});}};
    return handle;
  }catch{
    destroy();return null;
  }
}
