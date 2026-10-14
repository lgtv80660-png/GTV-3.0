// components/player/engines/GPlayerHLSEngine.ts


export type HLSConfig = {

  lowLatency?: boolean;

  maxBufferLength?: number;

};



export class GPlayerHLSEngine {


  private video:
    HTMLVideoElement;


  private hls:
    any = null;


  private config:
    HLSConfig;



  constructor(

    video: HTMLVideoElement,

    config:HLSConfig = {}

  ){

    this.video =
      video;


    this.config =
      config;

  }





  async load(

    url:string

  ){


    /*
      Safari / Apple

      HLS natif
    */


    const nativeSupport =
      this.video.canPlayType(
        "application/vnd.apple.mpegurl"
      )
      ||
      this.video.canPlayType(
        "application/x-mpegURL"
      );



    if(nativeSupport){


      this.video.src =
        url;


      this.video.load();


      return;

    }





    /*
      Chrome / Android / Edge

      hls.js
    */


    const Hls =
      (
        await import(
          "hls.js"
        )
      )
      .default;



    if(
      Hls.isSupported()
    ){


      this.hls =
        new Hls({

          enableWorker:true,


          lowLatencyMode:
            this.config.lowLatency
            ??
            false,


          maxBufferLength:
            this.config.maxBufferLength
            ??
            30,

        });



      this.hls.loadSource(
        url
      );


      this.hls.attachMedia(
        this.video
      );



      this.hls.on(
        Hls.Events.ERROR,
        (
          _event:any,
          data:any
        )=>{


          if(
            !data.fatal
          )
            return;



          if(
            data.type ===
            Hls.ErrorTypes.NETWORK_ERROR
          ){

            try {

              this.hls.startLoad();

            } catch {}

            return;

          }




          if(
            data.type ===
            Hls.ErrorTypes.MEDIA_ERROR
          ){

            try {

              this.hls.recoverMediaError();

            } catch {}


            return;

          }



          this.destroy();


        }
      );


      return;

    }





    /*
      Dernier fallback

      navigateur natif
    */


    this.video.src =
      url;


    this.video.load();

  }







  play(){

    return this.video.play();

  }






  pause(){

    this.video.pause();

  }






  seek(
    time:number
  ){

    this.video.currentTime =
      time;

  }






  getPosition(){

    return (
      this.video.currentTime ||
      0
    );

  }






  destroy(){


    if(this.hls){

      try {

        this.hls.destroy();

      } catch {}

      this.hls =
        null;

    }



    try {

      this.video.pause();

      this.video.removeAttribute(
        "src"
      );

      this.video.load();

    } catch {}

  }


}