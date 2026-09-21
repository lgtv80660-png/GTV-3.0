export type StreamKind = "live" | "movie" | "series";

export interface XtreamCredentials {
  baseUrl?: string;
  url?: string;
  serverUrl?: string;
  username?: string;
  user?: string;
  password?: string;
  pass?: string;
}

export interface AuthResponse {
  user_info?: any;
  server_info?: any;
}

export interface Category {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

export type VodCategory = Category;
export type SeriesCategory = Category;
export type LiveCategory = Category;

export interface LiveStream {
  stream_id: number | string;
  name?: string;
  stream_icon?: string;
  epg_channel_id?: string;
  added?: string;
  category_id?: string;
  custom_sid?: string;
  tv_archive?: number;
  direct_source?: string;
  tv_archive_duration?: number;
}

export interface VodStream {
  stream_id: number | string;
  name?: string;
  title?: string;
  stream_icon?: string;
  cover?: string;
  container_extension?: string;
  rating?: string | number;
  year?: string | number;
  added?: string | number;
  category_id?: string;
}

export interface SeriesItem {
  series_id: number | string;
  name?: string;
  title?: string;
  cover?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  releaseDate?: string;
  rating?: string | number;
  category_id?: string;
  youtube_trailer?: string;
  backdrop_path?: string[];
}

export type Series = SeriesItem;

export interface Episode {
  id: string | number;
  episode_num: number;
  title?: string;
  container_extension?: string;
  info?: {
    movie_image?: string;
    plot?: string;
    duration?: string;
    duration_secs?: number;
  };
}

export interface SeriesDetails {
  info?: SeriesItem;
  episodes?: Record<string, Episode[]>;
}

export type SeriesInfo = SeriesDetails;

export interface VodInfo {
  info?: any;
  movie_data?: any;
}

export interface EpgListing {
  id?: string;
  epg_id?: string;
  title?: string;
  lang?: string;
  start?: string;
  end?: string;
  description?: string;
  channel_id?: string;
  start_timestamp?: number;
  stop_timestamp?: number;
}
