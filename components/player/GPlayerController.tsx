"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from "lucide-react";



type Props = {
  video: HTMLVideoElement | null;
};




function formatTime(value:number){

  if(!Number.isFinite(value)){
    return "00:00";
  }


  const minutes =
    Math.floor(value / 60);

  const seconds =
    Math.floor(value % 60);


  return (
    `${String(minutes).padStart(2,"0")}:` +
    `${String(seconds).padStart(2,"0")}`
  );

}





export default function GPlayerController({
  video,
}:Props){


  const containerRef =
    useRef<HTMLDivElement|null>(null);



  const [
    playing,
    setPlaying
  ] =
  useState(false);



  const [
    muted,
    setMuted
  ] =
  useState(false);



  const [
    volume,
    setVolume
  ] =
  useState(1);



  const [
    current,
    setCurrent
  ] =
  useState(0);



  const [
    duration,
    setDuration
  ] =
  useState(0);



  const [
    fullscreen,
    setFullscreen
  ] =
  useState(false);







  useEffect(()=>{


    if(!video)
      return;



    const update = ()=>{

      setCurrent(
        video.currentTime
      );

      setDuration(
        video.duration || 0
      );

    };



    const play = ()=>{

      setPlaying(true);

    };



    const pause = ()=>{

      setPlaying(false);

    };



    video.addEventListener(
      "timeupdate",
      update
    );


    video.addEventListener(
      "durationchange",
      update
    );


    video.addEventListener(
      "play",
      play
    );


    video.addEventListener(
      "pause",
      pause
    );



    return()=>{

      video.removeEventListener(
        "timeupdate",
        update
      );


      video.removeEventListener(
        "durationchange",
        update
      );


      video.removeEventListener(
        "play",
        play
      );


      video.removeEventListener(
        "pause",
        pause
      );

    };


  },[
    video
  ]);







  const togglePlay =
    useCallback(()=>{


      if(!video)
        return;



      if(video.paused){

        video.play();

      }
      else{

        video.pause();

      }


    },[
      video
    ]);






  const seek =
    useCallback(
      (
        value:number
      )=>{


        if(!video)
          return;



        video.currentTime =
          value;


      },
      [
        video
      ]
    );







  const toggleMute =
    useCallback(()=>{


      if(!video)
        return;



      video.muted =
        !video.muted;



      setMuted(
        video.muted
      );


    },[
      video
    ]);







  const changeVolume =
    useCallback(
      (
        value:number
      )=>{


        if(!video)
          return;



        video.volume =
          value;



        setVolume(
          value
        );


      },
      [
        video
      ]
    );







  const toggleFullscreen =
    useCallback(()=>{


      const element =
        containerRef.current;



      if(!element)
        return;



      if(
        document.fullscreenElement
      ){

        document.exitFullscreen();

        setFullscreen(false);

      }
      else{

        element.requestFullscreen();

        setFullscreen(true);

      }


    },[]);







  return (

    <div

      ref={containerRef}

      className="
      absolute
      bottom-0
      left-0
      right-0
      z-50
      bg-gradient-to-t
      from-black
      to-transparent
      p-4
      "

    >



      <input

        type="range"

        min="0"

        max={duration || 0}

        value={current}

        onChange={
          e =>
            seek(
              Number(
                e.target.value
              )
            )
        }

        className="w-full"

      />




      <div

        className="
        mt-3
        flex
        items-center
        gap-4
        text-white
        "

      >



        <button
          onClick={togglePlay}
        >

          {
            playing

            ?

            <Pause size={22}/>

            :

            <Play size={22}/>

          }

        </button>





        <button

          onClick={
            ()=>seek(
              Math.max(
                0,
                current - 10
              )
            )
          }

        >

          <RotateCcw size={20}/>

        </button>





        <button

          onClick={
            ()=>seek(
              Math.min(
                duration,
                current + 10
              )
            )
          }

        >

          <RotateCw size={20}/>

        </button>





        <button
          onClick={toggleMute}
        >

          {
            muted

            ?

            <VolumeX size={22}/>

            :

            <Volume2 size={22}/>

          }

        </button>




        <input

          type="range"

          min="0"

          max="1"

          step="0.05"

          value={volume}

          onChange={
            e =>
              changeVolume(
                Number(
                  e.target.value
                )
              )
          }

          className="w-24"

        />




        <span className="ml-auto text-sm">

          {formatTime(current)}
          {" / "}
          {formatTime(duration)}

        </span>




        <button

          onClick={
            toggleFullscreen
          }

        >

          {
            fullscreen

            ?

            <Minimize size={22}/>

            :

            <Maximize size={22}/>

          }

        </button>



      </div>


    </div>

  );

}