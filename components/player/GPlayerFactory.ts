import {
  GPlayerMediaEngine,
  type GMediaSource,
  type GEngineType,
} from "./GPlayerMediaEngine";


import {
  GPlayerMKVEngine,
} from "./engines/GPlayerMKVEngine";


import {
  GPlayerHLSEngine,
} from "./engines/GPlayerHLSEngine";



export type GPlayerEngine =
  | GPlayerMKVEngine
  | GPlayerHLSEngine
  | HTMLVideoElement;



export class GPlayerFactory {



  static async create(

    video: HTMLVideoElement,

    source: GMediaSource

  ): Promise<{

    type:GEngineType;

    engine:GPlayerEngine;

  }> {



    const selected =
      GPlayerMediaEngine.selectEngine(
        source
      );



    switch(
      selected.engine
    ) {





      /*
        MKV DIRECT ENGINE
      */

      case "mkv":
      {


        const engine =
          new GPlayerMKVEngine(
            video
          );


        engine.load(
          {
            url:
              source.url,
          }
        );


        return {

          type:
            "mkv",

          engine,

        };

      }





      /*
        HLS ENGINE

        VOD fallback HLS
        ou futur usage Live
      */

      case "hls":
      {


        const engine =
          new GPlayerHLSEngine(
            video,
            {

              lowLatency:false,

              maxBufferLength:30,

            }
          );



        await engine.load(
          source.url
        );



        return {

          type:
            "hls",

          engine,

        };


      }





      /*
        MP4 / NATIVE
      */


      case "native":
      {


        video.src =
          source.url;


        video.load();



        return {

          type:
            "native",


          engine:
            video,

        };

      }





      /*
        FALLBACK
      */


      case "fallback":

      default:
      {


        video.src =
          source.url;


        video.load();



        return {

          type:
            "fallback",


          engine:
            video,

        };


      }


    }


  }



}