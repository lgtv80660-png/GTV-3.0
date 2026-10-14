// components/player/GPlayerController.ts


import {
  GPlayerState,
} from "./GPlayerState";



export type PlayerEngine = {

  play?:()=>Promise<void>|void;

  pause?:()=>void;

  seek?:(
    time:number
  )=>void;

  destroy?:()=>void;

};





export class GPlayerController {


  private engine:
    PlayerEngine | null =
      null;


  private state:
    GPlayerState;



  constructor(){

    this.state =
      new GPlayerState();

  }






  attach(
    engine:PlayerEngine
  ){

    this.engine =
      engine;

  }







  setSource(
    source:string
  ){

    this.state.setSource(
      source
    );

  }







  async play(){

    if(!this.engine)
      return;


    await this.engine.play?.();


    this.state.setStatus(
      "playing"
    );

  }







  pause(){

    this.engine?.pause?.();


    this.state.setStatus(
      "paused"
    );

  }







  seek(
    time:number
  ){

    this.engine?.seek?.(
      time
    );


    this.state.setTime(
      time
    );

  }







  savePosition(){

    return this.state
      .get()
      .currentTime;

  }







  restorePosition(){

    const position =
      this.state
        .get()
        .currentTime;


    this.seek(
      position
    );

  }







  setVolume(
    volume:number
  ){

    this.state.setVolume(
      volume
    );

  }







  mute(
    value:boolean
  ){

    this.state.setMuted(
      value
    );

  }







  setAudioTrack(
    track:number
  ){

    this.state.setAudioTrack(
      track
    );

  }







  setSubtitleTrack(
    track:number
  ){

    this.state.setSubtitleTrack(
      track
    );

  }







  setQuality(
    quality:string
  ){

    this.state.setQuality(
      quality
    );

  }







  getState(){

    return this.state.get();

  }







  destroy(){

    this.engine?.destroy?.();


    this.engine =
      null;


    this.state.reset();

  }


}