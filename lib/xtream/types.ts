export type StreamKind = "live" | "movie" | "series";

export interface XtreamCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface LiveCategory {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

export interface VodCategory {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

export interface SeriesCategory {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

export interface LiveStream {
  num?: number;
  name?: string;
  title?: string;
  stream_type?: string;
  stream_id: string | number;
  stream_icon?: string;
  epg_channel_id?: string;
  added?: string;
  category_id?: string;
  custom_sid?: string;
  direct_source?: string;
  [key: string]: any;
}

export interface VodStream {
  num?: number;
  name?: string;
  title?: string;
  stream_type?: string;
  stream_id: string | number;
  stream_icon?: string;
  cover?: string;
  rating?: string | number;
  year?: string | number;
  added?: string;
  category_id?: string;
  container_extension?: string;
  custom_sid?: string;
  direct_source?: string;
  [key: string]: any;
}

export interface SeriesItem {
  num?: number;
  name?: string;
  title?: string;
  series_id: string | number;
  cover?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  releaseDate?: string;
  last_modified?: string;
  rating?: string | number;
  category_id?: string;
  backdrop_path?: string[];
  youtube_trailer?: string;
  episode_run_time?: string;
  [key: string]: any;
}

export interface EpisodeInfo {
  duration_secs?: number;
  duration?: string;
  video?: Record<string, any>;
  audio?: Record<string, any>;
  bitrate?: number;
  rating?: number | string;
  season?: number | string;
  movie_image?: string;
  plot?: string;
  releasedate?: string;
  [key: string]: any;
}

export interface Episode {
  id: string;
  episode_num: number | string;
  title?: string;
  container_extension?: string;
  info?: EpisodeInfo;
  custom_sid?: string;
  added?: string;
  season?: number | string;
  [key: string]: any;
}

export interface SeriesDetails {
  seasons?: any[];
  info?: Record<string, any>;
  series_info?: Record<string, any>;
  episodes?: Record<string, Episode[]>;
  [key: string]: any;
}