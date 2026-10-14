const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const ts=require(root+'/node_modules/typescript');
const modules=new Map();
function load(file){
 if(modules.has(file))return modules.get(file).exports;
 const m=new Module(file);modules.set(file,m);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
 m.require=id=>id==='./desktop'?{tryDesktop:async()=>{throw Error('VOD must not call Engine');}}:id.startsWith('.')?load(path.resolve(path.dirname(file),id+'.ts')):require(id);
 m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);return m.exports;
}
global.location={origin:'http://localhost:3200'};
const {nativeVodSupported}=load(root+'/lib/player/vod-compatibility.ts');
const {attach}=load(root+'/lib/player/engine.ts');
const media={duration:120,container:'mov,mp4,m4a,3gp,3g2,mj2',byteRanges:true,video:{codec:'h264',profile:'High',level:40,pixelFormat:'yuv420p',hdr:false},audio:[{codec:'aac',profile:'LC',channels:2,default:true}]};
class Video extends EventTarget {
 constructor(fail=false){super();this._src='';this.duration=120;this.currentTime=0;this.readyState=0;this.videoWidth=1920;this.paused=false;this.fail=fail;}
 canPlayType(){return 'probably';}
 set src(value){this._src=value;setImmediate(()=>{if(this._src!==value)return;if(this.fail&&value.includes('vod-direct')){this.dispatchEvent(new Event('error'));return;}this.readyState=4;this.dispatchEvent(new Event('loadedmetadata'));this.dispatchEvent(new Event('loadeddata'));});}
 get src(){return this._src;}
 removeAttribute(){this._src='';this.readyState=0;}
 load(){} pause(){this.paused=true;} async play(){this.paused=false;}
}
let requests=[],seekSignals=[];
global.fetch=async(url,options)=>{requests.push(url);if(url.includes('t='))seekSignals.push(options.signal);return {ok:true,status:200,json:async()=>({media,seekStart:10})};};
const opts={url:'/api/vod-direct?type=movie&id=1&ext=mp4',ext:'mp4',isLive:false};
async function flush(){await new Promise(r=>setImmediate(r));}
(async()=>{
 assert(nativeVodSupported(media,'mp4',()=> 'probably'));
 for(const changed of [{byteRanges:false},{container:'matroska,webm'},{video:{...media.video,codec:'hevc'}},{audio:[{codec:'ac3',profile:'',channels:6}]},{video:{...media.video,pixelFormat:'yuv420p10le'}}])assert(!nativeVodSupported({...media,...changed},'mp4',()=> 'probably'));
 assert(!nativeVodSupported(media,'mkv',()=> 'probably'));assert(!nativeVodSupported(media,'mp4',()=>''));
 assert(nativeVodSupported({...media,audio:[{codec:'aac',profile:'LC',channels:6}]},'mp4',()=> 'probably'));
 assert(!nativeVodSupported({...media,audio:[{codec:'aac',profile:'LC',channels:8}]},'mp4',()=> 'probably'));
 assert(nativeVodSupported({...media,container:'matroska,webm'},'mkv',()=> 'probably'));
 assert(!nativeVodSupported({...media,container:'matroska,webm'},'mkv',()=>''));
 const direct=new Video();let handle=await attach(direct,opts);assert(direct.src.includes('vod-direct'));assert.equal(handle.getDuration(),120);handle.seek(35);assert.equal(direct.currentTime,35);direct.dispatchEvent(new Event('seeked'));handle.destroy();
 const failed=new Video(true);handle=await attach(failed,opts);await flush();assert(failed.src.includes('stream-vod'));handle.seek(15);handle.seek(20);await flush();assert(seekSignals.at(-2).aborted);assert(failed.src.includes('t=20'));assert.equal(handle.getDuration(),120);handle.destroy();
 const later=new Video();handle=await attach(later,opts);later.currentTime=40;later.dispatchEvent(new Event('error'));await flush();assert(later.src.includes('stream-vod'));await flush();handle.destroy();
 const aborted=new AbortController();aborted.abort();await assert.rejects(attach(new Video(),{...opts,signal:aborted.signal}),{name:'AbortError'});
 console.log('PASS: native admission, audio/container/Range rejection, direct seek, startup fallback, late fallback, latest-seek cancellation, abort; no Engine call.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});

