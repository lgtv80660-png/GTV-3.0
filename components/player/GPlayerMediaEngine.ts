// components/player/GPlayerMediaEngine.ts


export type GMediaType =
  | "mp4"
  | "mkv"
  | "hls"
  | "unknown";



export type GEngineType =
  | "native"
  | "mkv"
  | "hls"
  | "fallback";



export type GMediaSource = {

  url:string;

  ext?:string;

};



export type GEngineResult = {

  engine:GEngineType;

  source:GMediaSource;

};






export class GPlayerMediaEngine {



  /*
    DETECTION FORMAT
  */


  static detectType(
    source:GMediaSource
  ):GMediaType {


    const url =
      source.url
        .toLowerCase();



    const ext =
      (
        source.ext ||
        ""
      )
      .replace(
        ".",
        ""
      )
      .toLowerCase();



    if(
      ext === "m3u8" ||
      url.includes(
        ".m3u8"
      )
    ){

      return "hls";

    }



    if(
      ext === "mp4" ||
      url.includes(
        ".mp4"
      )
    ){

      return "mp4";

    }



    if(
      ext === "mkv" ||
      url.includes(
        ".mkv"
      )
    ){

      return "mkv";

    }



    return "unknown";


  }







  /*
    CHOIX ENGINE
  */


  static selectEngine(
    source:GMediaSource
  ):GEngineResult {



    const type =
      this.detectType(
        source
      );




    switch(type){



      case "mp4":

        return {

          engine:
            "native",

          source,

        };




      case "mkv":

        return {

          engine:
            "mkv",

          source,

        };





      case "hls":

        return {

          engine:
            "hls",

          source,

        };





      default:

        return {

          engine:
            "fallback",

          source,

        };


    }


  }







  /*
    FUTURE GPLAYER V20

    Ici viendra :

    - WebCodecs
    - MKV parser
    - audio tracks
    - subtitles
    - chapters

  */


  static supportsMKV(){

    return false;

  }




  static supportsHEVC(){

    return false;

  }



  static supportsAV1(){

    return false;

  }



}