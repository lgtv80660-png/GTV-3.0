"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  cachedList,
  fetchCategories,
  fetchChannels,
  LiveAuthenticationError,
  saveList,
} from "./live-catalog";

import type {
  Category,
  Channel,
} from "./live-types";


/* =========================================================
   TYPES
   ========================================================= */

type ListState<T> = {
  key: string | null;
  data: T[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};


/* =========================================================
   CACHED LIST
   ========================================================= */

function useCachedList<T>(
  key: string | null,
  loader: (
    signal: AbortSignal
  ) => Promise<T[]>,
  ttl: number
) {
  const router =
    useRouter();

  const [
    revision,
    setRevision,
  ] = useState(0);

  const [
    state,
    setState,
  ] = useState<ListState<T>>({
    key: null,
    data: [],
    loading: false,
    refreshing: false,
    error: null,
  });


  /* =======================================================
     REFRESH
     ======================================================= */

  const refresh =
    useCallback(() => {
      setRevision(
        (value) =>
          value + 1
      );
    }, []);


  /* =======================================================
     EFFECT
     ======================================================= */

  useEffect(() => {
    if (key === null) {
      return;
    }


    /*
     * Stable non-null key for async callbacks.
     */

    const activeKey: string =
      key;


    /*
     * We still provide an AbortSignal to the loaders because
     * fetchCategories / fetchChannels expect one.
     *
     * We intentionally do NOT abort it during cleanup.
     *
     * Some browser inspectors/extensions report a normal
     * fetch abort as a console error.
     */

    const controller =
      new AbortController();


    /*
     * disposed prevents an obsolete request from updating
     * React state after:
     *
     * - component unmount
     * - category change
     * - effect recreation
     * - manual refresh
     */

    let disposed =
      false;


    /*
     * Prevent multiple simultaneous requests for this
     * mounted effect.
     */

    let pending =
      false;


    /* =====================================================
       CACHE
       ===================================================== */

    const cached =
      cachedList<T>(
        activeKey
      );


    setState(
      (previous) => {
        const previousData =
          previous.key ===
          activeKey
            ? previous.data
            : [];


        const data =
          cached ??
          previousData;


        return {
          key:
            activeKey,

          data,

          loading:
            cached === null &&
            previousData.length ===
              0,

          refreshing:
            true,

          error:
            null,
        };
      }
    );


    /* =====================================================
       REVALIDATE
       ===================================================== */

    async function revalidate() {
      if (
        disposed ||
        pending
      ) {
        return;
      }


      pending =
        true;


      setState(
        (previous) => {
          if (
            disposed ||
            previous.key !==
              activeKey
          ) {
            return previous;
          }


          return {
            ...previous,

            refreshing:
              true,

            error:
              null,
          };
        }
      );


      try {
        /* ===============================================
           FETCH
           =============================================== */

        const data =
          await loader(
            controller.signal
          );


        /*
         * The request may have completed after this effect
         * became obsolete.
         */

        if (disposed) {
          return;
        }


        /* ===============================================
           CACHE
           =============================================== */

        saveList(
          activeKey,
          data,
          ttl
        );


        /*
         * Check again before touching state.
         */

        if (disposed) {
          return;
        }


        /* ===============================================
           SUCCESS
           =============================================== */

        setState({
          key:
            activeKey,

          data,

          loading:
            false,

          refreshing:
            false,

          error:
            null,
        });
      } catch (
        error: unknown
      ) {
        /*
         * If this effect is obsolete, ignore everything
         * returned by its old request.
         */

        if (disposed) {
          return;
        }


        /* ===============================================
           AUTH
           =============================================== */

        if (
          error instanceof
          LiveAuthenticationError
        ) {
          router.push(
            "/login"
          );

          return;
        }


        /* ===============================================
           ERROR
           =============================================== */

        const message =
          error instanceof
          Error
            ? error.message
            : "Connexion indisponible.";


        setState(
          (previous) => {
            if (
              disposed ||
              previous.key !==
                activeKey
            ) {
              return previous;
            }


            /*
             * Cached data is preserved.
             */

            return {
              ...previous,

              loading:
                false,

              refreshing:
                false,

              error:
                message,
            };
          }
        );
      } finally {
        pending =
          false;


        /*
         * Never update state from an obsolete effect.
         */

        if (disposed) {
          return;
        }


        setState(
          (previous) => {
            if (
              previous.key !==
              activeKey
            ) {
              return previous;
            }


            return {
              ...previous,

              loading:
                false,

              refreshing:
                false,
            };
          }
        );
      }
    }


    /* =====================================================
       FOCUS / VISIBILITY
       ===================================================== */

    const onVisible =
      () => {
        if (disposed) {
          return;
        }


        if (
          document
            .visibilityState !==
          "visible"
        ) {
          return;
        }


        void revalidate();
      };


    /* =====================================================
       INITIAL NETWORK REVALIDATION
       ===================================================== */

    void revalidate();


    /* =====================================================
       EVENTS
       ===================================================== */

    window.addEventListener(
      "focus",
      onVisible
    );

    document.addEventListener(
      "visibilitychange",
      onVisible
    );


    /* =====================================================
       CLEANUP
       ===================================================== */

    return () => {
      /*
       * Mark this complete effect as obsolete BEFORE
       * removing listeners.
       *
       * We deliberately don't call controller.abort().
       *
       * The old request is allowed to finish silently,
       * but it can no longer:
       *
       * - write to cache
       * - update React state
       * - redirect
       * - display an error
       */

      disposed =
        true;


      window.removeEventListener(
        "focus",
        onVisible
      );

      document.removeEventListener(
        "visibilitychange",
        onVisible
      );
    };
  }, [
    key,
    loader,
    ttl,
    revision,
    router,
  ]);


  /* =======================================================
     CURRENT STATE
     ======================================================= */

  /*
   * Never expose channels from the previous category.
   */

  const current:
    ListState<T> =
      key !== null &&
      state.key === key
        ? state
        : {
            key,

            data:
              [] as T[],

            loading:
              key !== null,

            refreshing:
              false,

            error:
              null,
          };


  return {
    ...current,
    refresh,
  };
}


/* =========================================================
   LIVE CATEGORIES
   ========================================================= */

export function useLiveCategories() {
  return useCachedList<Category>(
    "live-categories",

    fetchCategories,

    30 *
      60 *
      1000
  );
}


/* =========================================================
   LIVE CHANNELS
   ========================================================= */

export function useLiveChannels(
  categoryId:
    | string
    | null
) {
  const loader =
    useCallback(
      (
        signal:
          AbortSignal
      ): Promise<
        Channel[]
      > => {
        if (
          categoryId ===
          null
        ) {
          return Promise.resolve(
            []
          );
        }


        return fetchChannels(
          categoryId,
          signal
        );
      },

      [
        categoryId,
      ]
    );


  const key =
    categoryId === null
      ? null
      : `live-channels:${categoryId}`;


  return useCachedList<Channel>(
    key,

    loader,

    15 *
      60 *
      1000
  );
}