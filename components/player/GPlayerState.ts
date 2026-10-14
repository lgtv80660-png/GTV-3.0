// components/player/GPlayerState.ts


export type GPlayerStatus =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "buffering"
  | "ended"
  | "error";



export type GPlayerStateData = {

  status:GPlayerStatus;


  currentTime:number;


  duration:number;


  volume:number;


  muted:boolean;


  source:string | null;


  audioTrack:number;


  subtitleTrack:number;


  quality:string;


};





export class GPlayerState {



  private state:GPlayerStateData = {


    status:
      "idle",


    currentTime:
      0,


    duration:
      0,


    volume:
      1,


    muted:
      false,


    source:
      null,


    audioTrack:
      0,


    subtitleTrack:
      -1,


    quality:
      "auto",


  };







  setStatus(
    status:GPlayerStatus
  ){

    this.state.status =
      status;

  }





  setSource(
    source:string
  ){

    this.state.source =
      source;

  }





  setTime(
    time:number
  ){

    this.state.currentTime =
      time;

  }





  setDuration(
    duration:number
  ){

    this.state.duration =
      duration;

  }





  setVolume(
    volume:number
  ){

    this.state.volume =
      volume;

  }





  setMuted(
    muted:boolean
  ){

    this.state.muted =
      muted;

  }





  setAudioTrack(
    track:number
  ){

    this.state.audioTrack =
      track;

  }





  setSubtitleTrack(
    track:number
  ){

    this.state.subtitleTrack =
      track;

  }





  setQuality(
    quality:string
  ){

    this.state.quality =
      quality;

  }





  get(){

    return {
      ...this.state
    };

  }





  reset(){

    this.state = {

      status:
        "idle",

      currentTime:
        0,

      duration:
        0,

      volume:
        1,

      muted:
        false,

      source:
        null,

      audioTrack:
        0,

      subtitleTrack:
        -1,

      quality:
        "auto",

    };

  }


}