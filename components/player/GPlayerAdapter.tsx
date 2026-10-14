"use client";


import GPlayerVOD from "./GPlayerVOD";



type ResumeData = {

  id:
    string |
    number;


  seriesId?:
    string |
    number |
    null;


  season?:
    string |
    number |
    null;


  episode?:
    string |
    number |
    null;


  image?:
    string |
    null;


  title?:
    string |
    null;

};





type Props = {

  sources:string[];

  ext:string;

  isLive:boolean;

  title:string;


  poster?:string;
  titleLogo?:string;
  titleLogoReady?:boolean;


  channelIcon?:string;


  startTime?:number;


  resumeData?:ResumeData;


  onEnded?:()=>void;


  onProgress?:(
    position:number,
    duration:number
  )=>void;

};








export default function GPlayerAdapter({

  sources,

  ext,

  isLive,

  title,

  poster,
  titleLogo,
  titleLogoReady,

  startTime = 0,

  resumeData,

  onEnded,

  onProgress,

}:Props){





  /*
    LIVE RESTE SUR ANCIEN PLAYER
    pour ne pas casser
    */

  if(
    isLive
  ){

    return null;

  }





  const source =
    sources?.[0] || "";





  return (

    <GPlayerVOD

      ext={ext}

      id={
        String(
          resumeData?.id ??
          title
        )
      }


      src={
        source
      }


      title={
        title
      }


      poster={poster}
      titleLogo={titleLogo}
      titleLogoReady={titleLogoReady}
      startTime={startTime}
      onProgress={onProgress}

      onEnded={
        onEnded
      }

    />

  );

}
