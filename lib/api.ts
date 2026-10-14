import type {
  Category,
  VodStream,
  StreamKind,
} from "./xtream/types";


type AuthResponse = any;
type LiveStream = any;
type VodInfo = any;
type Series = any;
type SeriesInfo = any;
type EpgListing = any;



async function getJson<T>(
  url: string
): Promise<T> {

  const res =
    await fetch(
      url,
      {
        credentials:
          "same-origin",
      }
    );


  if (!res.ok) {

    let msg =
      `Request failed (${res.status})`;


    try {

      const json =
        await res.json();


      if (json?.error) {
        msg = json.error;
      }

    } catch {}


    const error =
      new Error(msg) as Error & {
        status:number;
      };


    error.status =
      res.status;


    throw error;

  }


  return res.json() as Promise<T>;

}



const x = (
  action:string,
  params:Record<
    string,
    string | number | undefined
  > = {}
) => {

  const sp =
    new URLSearchParams({
      action,
    });


  for (
    const [key,value]
    of Object.entries(params)
  ) {

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {

      sp.set(
        key,
        String(value)
      );

    }

  }


  return `/api/xtream?${sp.toString()}`;

};



export const api = {


  session: () =>
    getJson<{
      authenticated:boolean;
      baseUrl?:string;
      username?:string;
      user_info?:AuthResponse["user_info"];
      server_info?:AuthResponse["server_info"];
    }>("/api/auth"),



  login:
  async (
    baseUrl:string,
    username:string,
    password:string
  ) => {

    const res =
      await fetch(
        "/api/auth",
        {
          method:"POST",

          headers:{
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              baseUrl,
              username,
              password,
            }),

          credentials:
            "same-origin",
        }
      );


    const data =
      await res.json();


    if(!res.ok){

      throw new Error(
        data?.error ||
        "Login failed"
      );

    }


    return data as {
      ok:true;
      user_info:
        AuthResponse["user_info"];
      server_info:
        AuthResponse["server_info"];
    };

  },



  logout:() =>
    fetch(
      "/api/auth",
      {
        method:"DELETE",
        credentials:
          "same-origin",
      }
    ),



  liveCategories:
    () =>
      getJson<Category[]>(
        x(
          "get_live_categories"
        )
      ),



  liveStreams:
    (
      categoryId?:string
    ) =>
      getJson<LiveStream[]>(
        x(
          "get_live_streams",
          {
            category_id:
              categoryId,
          }
        )
      ),



  vodCategories:
    () =>
      getJson<Category[]>(
        x(
          "get_vod_categories"
        )
      ),



  vodStreams:
    (
      categoryId?:string
    ) =>
      getJson<VodStream[]>(
        x(
          "get_vod_streams",
          {
            category_id:
              categoryId,
          }
        )
      ),



  vodInfo:
    (
      id:string|number
    ) =>
      getJson<VodInfo>(
        x(
          "get_vod_info",
          {
            vod_id:id,
          }
        )
      ),



  seriesCategories:
    () =>
      getJson<Category[]>(
        x(
          "get_series_categories"
        )
      ),



  getSeriesCategories:
    () =>
      getJson<Category[]>(
        x(
          "get_series_categories"
        )
      ),



  series:
    (
      categoryId?:string
    ) =>
      getJson<Series[]>(
        x(
          "get_series",
          {
            category_id:
              categoryId,
          }
        )
      ),



  getSeries:
    (
      categoryId?:string
    ) =>
      getJson<Series[]>(
        x(
          "get_series",
          {
            category_id:
              categoryId,
          }
        )
      ),



  seriesInfo:
    (
      id:string|number
    ) =>
      getJson<SeriesInfo>(
        x(
          "get_series_info",
          {
            series_id:id,
          }
        )
      ),



  epg:
    (
      streamId:string|number,
      limit=8
    ) =>
      getJson<{
        epg_listings:EpgListing[];
      }>(
        `/api/epg?stream_id=${streamId}&limit=${limit}`
      ),

};




export function streamSrc(
  kind:StreamKind,
  id:string|number,
  ext?:string
):string {


  if(kind==="live"){

    return `/api/live?id=${id}`;

  }



  const targetExt =
    !ext ||
    ext.toLowerCase()==="mkv"
      ? "mkv"
      : ext;



  return (
    `/api/vod-hls` +
    `?type=${kind}` +
    `&id=${id}` +
    `&ext=${encodeURIComponent(targetExt)}`
  );

}




export function transcodeSrc(
  kind:StreamKind,
  id:string|number,
  ext:string
):string {

  return streamSrc(
    kind,
    id,
    ext
  );

}




export async function resolveSrc(
  kind:StreamKind,
  id:string|number,
  ext:string
):Promise<{
  url:string|null;
  directOk:boolean;
  ext?:string;
}> {

  try {

    const res =
      await fetch(
        `/api/resolve?type=${kind}&id=${id}&ext=${encodeURIComponent(ext)}`,
        {
          credentials:
            "same-origin",
        }
      );


    if(!res.ok){

      return {
        url:null,
        directOk:false,
        ext,
      };

    }


    const data =
      await res.json();


    return {

      url:null,

      directOk:false,

      ext:
        data?.ext ||
        ext,

    };


  } catch {


    return {

      url:null,

      directOk:false,

      ext,

    };

  }

}