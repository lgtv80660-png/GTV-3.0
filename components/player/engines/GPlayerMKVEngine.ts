// components/player/engines/GPlayerMKVEngine.ts


export type MKVSource = {

  url:string;

};



export type MKVEngineState =

  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "error";




export class GPlayerMKVEngine {



  private video:
    HTMLVideoElement;



  private source:
    MKVSource | null = null;



  private state:
    MKVEngineState =
      "idle";



  constructor(
    video:HTMLVideoElement
  ){

    this.video =
      video;

  }





  /*
    LOAD MKV

    V1:
    prépare le pipeline.

    V20:
    ici viendra :
    - MKV parser
    - WebCodecs
    - FFmpeg WASM fallback
    - audio tracks
    - subtitles
  */


  load(
    source:MKVSource
  ){

    this.source =
      source;


    this.state =
      "loading";



    /*
      Pour l'instant :

      on laisse le navigateur
      essayer la lecture native.

      Le moteur MKV complet
      remplacera cette partie.
    */


    this.video.src =
      source.url;


    this.video.load();



  }





  async play(){

    try {

      await this.video.play();


      this.state =
        "playing";


    } catch {

      this.state =
        "error";

    }

  }






  pause(){

    this.video.pause();


    this.state =
      "paused";

  }






  seek(
    time:number
  ){

    if(
      Number.isFinite(time)
    ){

      this.video.currentTime =
        time;

    }

  }






  getPosition(){

    return (
      this.video.currentTime ||
      0
    );

  }






  getDuration(){

    return (
      this.video.duration ||
      0
    );

  }






  destroy(){

    this.video.pause();


    this.video.removeAttribute(
      "src"
    );


    this.video.load();



    this.source =
      null;


    this.state =
      "idle";

  }






  getState(){

    return this.state;

  }



}