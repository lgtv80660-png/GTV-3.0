type Stream={index:number;codec_type:string;codec_name?:string;profile?:string;pix_fmt?:string;level?:number;width?:number;height?:number;sample_rate?:string;channels?:number;field_order?:string};
export type Media={streams:Stream[];format:{duration?:string|number;start_time?:string|number;format_name?:string}};
export function report(v:HTMLVideoElement,media:Media,selected=-1,live=false,channelId="") {
  const video=media.streams.find(s=>s.codec_type==='video');
  const audio=media.streams.find(s=>s.codec_type==='audio'&&s.index===selected)||media.streams.find(s=>s.codec_type==='audio');
  const vc=video?.codec_name||'',ac=audio?.codec_name||'',format=media.format?.format_name||'';
  const profiles:Record<string,string>={Baseline:'42','Constrained Baseline':'42',Main:'4D',High:'64'};
  const level=Number(video?.level),profile=profiles[video?.profile||''];
  const videoCodec=vc==='h264'&&video?.pix_fmt==='yuv420p'&&profile&&level>0?'avc1.'+profile+'00'+level.toString(16).padStart(2,'0'):vc==='hevc'&&['Main','Main 10'].includes(video?.profile||'')?(video?.pix_fmt==='yuv420p10le'?'hvc1.2.4.L':'hvc1.1.6.L')+(level>0?level:153)+'.B0':vc==='av1'&&video?.pix_fmt==='yuv420p'?'av01.0.08M.08':vc==='vp9'&&video?.pix_fmt==='yuv420p'?'vp09.00.41.08':'';
  const codecs:Record<string,string>={aac:'mp4a.40.2',mp3:'mp4a.6B',opus:'Opus',ac3:'ac-3',eac3:'ec-3',vorbis:'vorbis'};
  const audioCodec=ac==='aac'&&audio?.profile==='HE-AAC'?'mp4a.40.5':ac==='aac'&&audio?.profile==='HE-AACv2'?'mp4a.40.29':codecs[ac]||'';
  const supported=(mime:string,cs:string)=>!!cs&&!!v.canPlayType(`${mime}; codecs="${cs}"`);
  const mime=format.includes('mp4')?'video/mp4':format.includes('webm')?'video/webm':format==='ogg'?'video/ogg':'';
  // Local 2768 adaptation is automatic; other channels retain the Phase 5 opt-in.
  // The bounded Live probe omitted field_order for 2768; local segment decode proved tt.
  const confirmedInterlaced=channelId==="2768"&&vc==="h264"&&video?.profile==="High"&&video?.width===1920&&video?.height===1080&&ac==="mp2"&&(!video.field_order||video.field_order==="unknown");
  const adaptInterlaced=live&&['127.0.0.1','localhost'].includes(location.hostname)&&(channelId==="2768"||new URLSearchParams(location.search).get('liveInterlacedAdapt')==='5')&&vc==='h264'&&(['tt','bb','tb','bt'].includes(video?.field_order||'')||confirmedInterlaced);
  const videoOk=!vc||!adaptInterlaced&&supported('video/mp4',videoCodec);
  const audioOk=!ac||!!audioCodec&&supported('audio/mp4',audioCodec)&&supported('video/mp4',[videoOk?videoCodec:'avc1.640033',audioCodec].filter(Boolean).join(','));
  return {version:1,sourceKey:[format,vc,video?.profile||'',video?.pix_fmt||'',ac,audio?.index??-1,video?.level??'',video?.width??'',video?.height??'',audio?.profile??'',audio?.sample_rate??'',audio?.channels??''].join('|'),sourceSupported:!!mime&&(!vc||!!videoCodec)&&(!ac||!!audioCodec)&&supported(mime,[videoCodec,audioCodec].filter(Boolean).join(',')),mp4VideoSupported:videoOk,mp4AudioSupported:audioOk,h264Supported:supported('video/mp4','avc1.640033'),aacSupported:supported('audio/mp4','mp4a.40.2'),evidence:JSON.stringify({detector:'HTMLMediaElement.canPlayType',sourceMime:mime,videoCodec,audioCodec,fieldOrder:video?.field_order,adaptInterlaced,deinterlaceConfirmed:adaptInterlaced&&confirmedInterlaced})};
}
