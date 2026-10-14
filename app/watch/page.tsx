"use client";

import {
  Suspense,
  useCallback,
  useMemo,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { useQuery } from "@tanstack/react-query";

import { VideoPlayer } from "@/components/player/VideoPlayer";
import { resolveSrc } from "@/lib/api";
import { useSeriesInfo } from "@/lib/hooks";

import type {
  Episode,
  StreamKind,
} from "@/lib/xtream/types";


/* =========================================================
   TYPES
========================================================= */

type VodType = "movie" | "series";


type EpisodeLike = Episode & {

  id?: string | number;

  episode_id?: string | number;

  stream_id?: string | number;


  title?: string;

  name?: string;


  container_extension?: string;

  ext?: string;


  season?: string | number;

  season_number?: string | number;


  episode_num?: string | number;

  episode_number?: string | number;


  info?: {

    movie_image?: string;

    cover_big?: string;

    cover?: string;

  };

};



/* =========================================================
   HELPERS
========================================================= */

function normalizeVodType(
  value: string | null
): VodType {

  return value === "series"
    ? "series"
    : "movie";

}



function parsePositiveNumber(
  value: string | null
): number {

  if (!value) {
    return 0;
  }


  const parsed =
    Number(value);


  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {

    return 0;

  }


  return parsed;

}



function getEpisodeId(
  episode: Episode
): string {

  const item =
    episode as EpisodeLike;


  return String(

    item.id ??

    item.episode_id ??

    item.stream_id ??

    ""

  );

}



function getEpisodeTitle(
  episode: Episode
): string {

  const item =
    episode as EpisodeLike;


  return (

    item.title ||

    item.name ||

    "Épisode"

  );

}



function getEpisodeExtension(
  episode: Episode
): string {

  const item =
    episode as EpisodeLike;


  return (

    item.container_extension ||

    item.ext ||

    "mkv"

  );

}



function getEpisodeSeason(
  episode: Episode
): string | null {

  const item =
    episode as EpisodeLike;


  const value =

    item.season ??

    item.season_number;



  if (

    value === undefined ||

    value === null ||

    value === ""

  ) {

    return null;

  }



  return String(value);

}



function getEpisodeNumber(
  episode: Episode
): string | null {

  const item =
    episode as EpisodeLike;


  const value =

    item.episode_num ??

    item.episode_number;



  if (

    value === undefined ||

    value === null

  ) {

    return null;

  }



  return String(value);

}



function getEpisodeImage(
  episode: Episode
): string | null {

  const item =
    episode as EpisodeLike;


  return (

    item.info?.movie_image ||

    item.info?.cover_big ||

    item.info?.cover ||

    null

  );

}



/* =========================================================
   WATCH PLAYER
========================================================= */

function WatchPlayer() {

  const router =
    useRouter();


  const searchParams =
    useSearchParams();


  const type =
    normalizeVodType(
      searchParams.get("type")
    );


  const id =
    searchParams
      .get("id")
      ?.trim() || "";


  const ext =
    searchParams
      .get("ext")
      ?.trim() || "mkv";


  const titleParam =
    searchParams
      .get("title")
      ?.trim() || "";


  const seriesId =
    searchParams
      .get("series")
      ?.trim() || "";


  const seasonParam =
    searchParams.get("season");


  const episodeParam =
    searchParams.get("episode");


  const imageParam =
    searchParams.get("image");


  const resumeParam =
    searchParams.get("resume");


  const isSeries =
    type === "series";
  const startTime =
    useMemo(() => {

      const resume =
        parsePositiveNumber(
          resumeParam
        );


      /*
        On ignore les toutes
        premières secondes
      */

      if (resume <= 15) {

        return 0;

      }


      return Math.floor(resume);


    }, [
      resumeParam
    ]);



  /* =======================================================
     SERIES INFO
  ======================================================= */


  const {
    data: seriesInfo,
  } = useSeriesInfo(
    isSeries && seriesId
      ? seriesId
      : ""
  );



  /* =======================================================
     FLAT EPISODES
  ======================================================= */


  const episodes =
    useMemo<Episode[]>(() => {

      if (
        !isSeries ||
        !seriesInfo?.episodes
      ) {

        return [];

      }


      const episodesObject =
        seriesInfo.episodes;



      return Object.keys(
        episodesObject
      )

        .map(Number)

        .filter(
          Number.isFinite
        )

        .sort(
          (a, b) =>
            a - b
        )

        .flatMap(
          (seasonNumber) =>
            episodesObject[
              String(seasonNumber)
            ] || []
        );


    }, [
      isSeries,
      seriesInfo,
    ]);



  /* =======================================================
     CURRENT EPISODE
  ======================================================= */


  const currentEpisode =
    useMemo(() => {

      if (
        !isSeries ||
        !id ||
        episodes.length === 0
      ) {

        return null;

      }


      return (

        episodes.find(
          (episode) =>
            getEpisodeId(
              episode
            ) === id
        )

        || null

      );


    }, [
      isSeries,
      id,
      episodes,
    ]);



  /* =======================================================
     NEXT EPISODE
  ======================================================= */


  const nextEpisode =
    useMemo(() => {

      if (
        !isSeries ||
        !currentEpisode
      ) {

        return null;

      }


      const index =
        episodes.findIndex(
          (episode) =>
            getEpisodeId(
              episode
            ) === id
        );


      if (index < 0) {

        return null;

      }


      return (
        episodes[index + 1]
        || null
      );


    }, [
      isSeries,
      currentEpisode,
      episodes,
      id,
    ]);



  /* =======================================================
     TITLE
  ======================================================= */


  const title =
    useMemo(() => {


      if (titleParam) {

        return titleParam;

      }


      if (
        isSeries &&
        currentEpisode
      ) {

        return getEpisodeTitle(
          currentEpisode
        );

      }


      if (isSeries) {

        return "Épisode";

      }


      return "Film";


    }, [
      titleParam,
      isSeries,
      currentEpisode,
    ]);



  /* =======================================================
     POSTER
  ======================================================= */


  const poster =
    useMemo(() => {


      if (imageParam) {

        return imageParam;

      }


      if (currentEpisode) {

        return (
          getEpisodeImage(
            currentEpisode
          )
          ||
          undefined
        );

      }


      return undefined;


    }, [
      imageParam,
      currentEpisode,
    ]);



  /* =======================================================
     RESOLVE SOURCE
  ======================================================= */


  const streamKind =
    type as StreamKind;



  const {
    data: resolved,
  } = useQuery({

    queryKey: [
      "resolve",
      type,
      id,
      ext,
    ],


    queryFn: () =>
      resolveSrc(
        streamKind,
        id,
        ext
      ),


    enabled:
      Boolean(id),


    staleTime:
      60 * 1000,


    retry:
      1,


    refetchOnWindowFocus:
      false,

  });



  /* =======================================================
     VIDEO SOURCE
     
     GTV VOD HLS PIPELINE

     Xtream MKV
          |
          |
       /api/vod-hls
          |
          |
       FFmpeg Railway
          |
          |
       m3u8 + segments
  ======================================================= */


  const videoSrc =
    useMemo(() => {


      if (!id) {

        return "";

      }



      /*
        On garde une URL directe
        si elle est réellement
        compatible.
      */

      if (
        resolved?.directOk &&
        resolved?.url
      ) {

        return resolved.url;

      }



      const params =
        new URLSearchParams();



      params.set(
        "type",
        type
      );


      params.set(
        "id",
        id
      );


      params.set(
        "ext",
        ext
      );



      return (
        `/api/vod-hls?` +
        params.toString()
      );


    }, [
      id,
      type,
      ext,
      resolved,
    ]);
  /* =======================================================
     NEXT EPISODE NAVIGATION
  ======================================================= */


  const handleNext =
    useCallback(() => {


      if (
        !nextEpisode ||
        !seriesId
      ) {

        return;

      }



      const params =
        new URLSearchParams();



      params.set(
        "type",
        "series"
      );


      params.set(
        "id",
        getEpisodeId(
          nextEpisode
        )
      );


      params.set(
        "ext",
        getEpisodeExtension(
          nextEpisode
        )
      );


      params.set(
        "series",
        seriesId
      );



      params.set(
        "title",
        getEpisodeTitle(
          nextEpisode
        )
      );



      const season =
        getEpisodeSeason(
          nextEpisode
        );


      const episode =
        getEpisodeNumber(
          nextEpisode
        );



      if (season) {

        params.set(
          "season",
          season
        );

      }



      if (episode) {

        params.set(
          "episode",
          episode
        );

      }



      const image =
        getEpisodeImage(
          nextEpisode
        );


      if (image) {

        params.set(
          "image",
          image
        );

      }



      router.replace(
        `/watch?${params.toString()}`
      );


    }, [
      nextEpisode,
      seriesId,
      router,
    ]);




  const handleEnded =
    useCallback(() => {


      if (
        isSeries &&
        nextEpisode
      ) {

        handleNext();

      }


    }, [
      isSeries,
      nextEpisode,
      handleNext,
    ]);





  /* =======================================================
     EMPTY
  ======================================================= */


  if (!id) {

    return (

      <div className="flex h-full w-full items-center justify-center bg-black text-white">

        Média introuvable

      </div>

    );

  }




  /* =======================================================
     PLAYER
  ======================================================= */


  return (

    <div className="relative h-full w-full bg-black">


      <VideoPlayer

        sources={[
          videoSrc
        ]}



        ext={
          ext
        }



        isLive={
          false
        }



        mediaType={
          isSeries
            ? "series"
            : "movie"
        }



        title={
          title
        }



        poster={
          poster
        }



        startTime={
          startTime
        }



        hasNext={
          Boolean(
            isSeries &&
            nextEpisode
          )
        }



        onNext={
          nextEpisode
            ? handleNext
            : undefined
        }



        onEnded={
          handleEnded
        }



        onBack={
          () =>
            router.back()
        }



        resumeData={{

          id,


          seriesId:
            isSeries
              ? seriesId
              : null,


          season:
            isSeries
              ? seasonParam
              : null,


          episode:
            isSeries
              ? episodeParam
              : null,


          image:
            poster || null,

        }}


      />


    </div>

  );

}





/* =========================================================
   PAGE
========================================================= */


export default function WatchPage() {


  return (

    <main className="h-screen w-full overflow-hidden bg-black text-white">


      <Suspense>


        <WatchPlayer />


      </Suspense>


    </main>

  );


}