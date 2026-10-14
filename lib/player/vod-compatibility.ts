type Media = {
  duration: number; container: string; byteRanges: boolean;
  video: { codec: string; profile: string; level: number; pixelFormat: string; hdr: boolean };
  audio: { codec: string; profile: string; channels: number; default?: boolean }[];
};

/** Conservative admission; loadeddata and a finite timeline still verify the file. */
export function nativeVodSupported(media: Media | null, ext: string, canPlay: (mime: string) => string): boolean {
  if (!media?.byteRanges || !Number.isFinite(media.duration) || media.duration <= 0) return false;
  const video = media.video, audio = media.audio.find(a => a.default) || media.audio[0];
  const formats = media.container.split(',');
  let mime = '';
  const codecs: string[] = [];
  const mp4 = ['mp4', 'm4v', 'mov'].includes(ext.toLowerCase()) && formats.includes('mp4');
  const matroska = ext.toLowerCase() === 'mkv' && formats.includes('matroska');
  if (mp4 || matroska) {
    // MKV is only a candidate when this browser explicitly accepts its codecs;
    // engine.ts still verifies actual decoded data and the native timeline.
    mime = matroska ? 'video/x-matroska' : 'video/mp4';
    if (video.codec !== 'h264' || video.hdr || !['yuv420p', 'yuvj420p'].includes(video.pixelFormat)) return false;
    const profile = ({'Constrained Baseline':66, Baseline:66, Main:77, High:100} as Record<string, number>)[video.profile];
    if (!profile || !video.level) return false;
    codecs.push('avc1.' + profile.toString(16).padStart(2, '0') + '00' + video.level.toString(16).padStart(2, '0'));
    if (audio) {
      if (audio.codec !== 'aac' || audio.profile !== 'LC' || audio.channels < 1 || audio.channels > 6) return false;
      codecs.push('mp4a.40.2');
    }
  } else if (ext.toLowerCase() === 'webm' && formats.includes('webm')) {
    mime = 'video/webm';
    if (!['vp8', 'vp9'].includes(video.codec) || video.hdr || /10|12/.test(video.pixelFormat)) return false;
    codecs.push(video.codec === 'vp8' ? 'vp8' : 'vp9');
    if (audio) {
      if (!['opus', 'vorbis'].includes(audio.codec) || audio.channels < 1 || audio.channels > 2) return false;
      codecs.push(audio.codec);
    }
  } else return false;
  return !!canPlay(`${mime}; codecs="${codecs.join(',')}"`);
}
