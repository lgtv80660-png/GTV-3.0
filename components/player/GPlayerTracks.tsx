"use client";

import {
  useEffect,
  useState,
} from "react";


type GAudioTrack = {
  enabled: boolean;
  label?: string;
  language?: string;
};


interface GVideoElement extends HTMLVideoElement {

  audioTracks?: {
    length:number;

    [index:number]: GAudioTrack;

  };

}



type AudioTrackItem = {

  id:number;

  label:string;

  language?:string;

};



type SubtitleTrackItem = {

  id:number;

  label:string;

  language?:string;

};



type Props = {

  video:GVideoElement | null;

};



export default function GPlayerTracks({
  video,
}:Props) {


  const [
    audios,
    setAudios
  ] =
  useState<AudioTrackItem[]>([]);



  const [
    subtitles,
    setSubtitles
  ] =
  useState<SubtitleTrackItem[]>([]);




  useEffect(()=>{


    if(!video)
      return;



    /*
      AUDIO TRACKS
    */


    const audioTracks =
      Array.from(
        {
          length:
            video.audioTracks?.length || 0
        },
        (_, index)=>{


          const track =
            video.audioTracks?.[index];


          return {

            id:index,

            label:
              track?.label ||
              `Audio ${index + 1}`,

            language:
              track?.language,

          };


        }
      );



    setAudios(
      audioTracks
    );




    /*
      SUBTITLES
    */


    const subtitleTracks =
      Array.from(
        video.textTracks || []
      )
      .map(
        (
          track,
          index
        )=>({

          id:index,

          label:
            track.label ||
            `Subtitle ${index + 1}`,

          language:
            track.language ||
            undefined,

        })
      );



    setSubtitles(
      subtitleTracks
    );



  },[
    video
  ]);






  function changeAudio(
    id:number
  ){


    if(!video?.audioTracks)
      return;



    for(
      let i = 0;
      i < video.audioTracks.length;
      i++
    ){

      video.audioTracks[i].enabled =
        i === id;

    }

  }





  function changeSubtitle(
    id:number
  ){


    if(!video)
      return;



    for(
      let i = 0;
      i < video.textTracks.length;
      i++
    ){

      video.textTracks[i].mode =
        i === id
          ? "showing"
          : "hidden";

    }

  }






  return (

    <div
      className="
      absolute
      top-20
      right-5
      z-50
      space-y-3
      "
    >


      {
        audios.length > 0 && (

          <div
            className="
            rounded-xl
            bg-black/70
            p-3
            text-white
            "
          >

            <div
              className="
              mb-2
              text-xs
              opacity-60
              "
            >
              Audio
            </div>


            {
              audios.map(
                (audio)=>(

                  <button
                    key={
                      audio.id
                    }

                    onClick={()=>
                      changeAudio(
                        audio.id
                      )
                    }

                    className="
                    block
                    w-full
                    text-left
                    py-1
                    "
                  >

                    {audio.label}

                  </button>

                )
              )
            }


          </div>

        )
      }




      {
        subtitles.length > 0 && (

          <div
            className="
            rounded-xl
            bg-black/70
            p-3
            text-white
            "
          >

            <div
              className="
              mb-2
              text-xs
              opacity-60
              "
            >
              Sous-titres
            </div>


            {
              subtitles.map(
                (sub)=>(

                  <button
                    key={
                      sub.id
                    }

                    onClick={()=>
                      changeSubtitle(
                        sub.id
                      )
                    }

                    className="
                    block
                    w-full
                    text-left
                    py-1
                    "
                  >

                    {sub.label}

                  </button>

                )
              )
            }


          </div>

        )
      }


    </div>

  );

}