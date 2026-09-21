"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Tv,
  Search,
  Loader2,
  ChevronRight,
  Maximize,
  Volume2,
  VolumeX,
  ArrowLeft,
  Play,
  Radio,
} from "lucide-react";

interface Category {
  category_id: string;
  category_name: string;
}

interface Channel {
  num: number;
  name: string;
  stream_id: number;
  stream_icon: string;
  category_id: string;
}

export default function HomePage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);

  const [creds, setCreds] = useState<{ username: string; password: string } | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const catContainerRef = useRef<HTMLDivElement>(null);
  const chanContainerRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Initialisation Authentification
  useEffect(() => {
    const rawCreds = localStorage.getItem("gtv_xtream_credentials");
    if (!rawCreds) {
      router.push("/login");
      return;
    }

    try {
      const parsed = JSON.parse(rawCreds);
      if (!parsed.username || !parsed.password) {
        router.push("/login");
        return;
      }
      const userCreds = { username: parsed.username, password: parsed.password };
      setCreds(userCreds);

      fetchCategories(userCreds.username, userCreds.password);
    } catch (e) {
      router.push("/login");
    }
  }, [router]);

  async function fetchCategories(u: string, p: string) {
    try {
      const res = await fetch(
        `/api/xtream?action=get_live_categories&username=${encodeURIComponent(
          u
        )}&password=${encodeURIComponent(p)}`
      );
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        setCategories(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCategories(false);
    }
  }

  // Chargement des chaînes de la catégorie sélectionnée
  useEffect(() => {
    if (!selectedCategory || !creds) return;

    const activeUser = creds.username;
    const activePass = creds.password;

    async function fetchChannels() {
      setLoadingChannels(true);
      try {
        const res = await fetch(
          `/api/xtream?action=get_live_streams&username=${encodeURIComponent(
            activeUser
          )}&password=${encodeURIComponent(
            activePass
          )}&category_id=${selectedCategory?.category_id}`
        );
        const data = await res.json();

        if (Array.isArray(data)) {
          setChannels(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingChannels(false);
      }
    }

    fetchChannels();
  }, [selectedCategory, creds]);

  const handleSelectCategory = (cat: Category) => {
    setSelectedCategory(cat);
  };

  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel);

    const lastWatched = {
      id: channel.stream_id,
      title: channel.name,
      poster: channel.stream_icon || "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=500&q=80",
      progress: 100,
      type: "live",
    };
    localStorage.setItem("gtv_last_watched", JSON.stringify(lastWatched));
  };

  const handleTriggerFullScreen = async () => {
    if (!playerContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        if (playerContainerRef.current.requestFullscreen) {
          await playerContainerRef.current.requestFullscreen();
        }

        if (typeof window !== "undefined" && window.screen?.orientation && "lock" in window.screen.orientation) {
          // @ts-ignore
          await window.screen.orientation.lock("landscape").catch(() => {});
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        if (typeof window !== "undefined" && window.screen?.orientation && "unlock" in window.screen.orientation) {
          // @ts-ignore
          window.screen.orientation.unlock();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const enableDragScroll = (ref: React.RefObject<HTMLDivElement | null>) => {
    let isDown = false;
    let startY: number;
    let scrollTop: number;

    const container = ref.current;
    if (!container) return;

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      startY = e.pageY - container.offsetTop;
      scrollTop = container.scrollTop;
    };

    const onMouseLeaveOrUp = () => {
      isDown = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const y = e.pageY - container.offsetTop;
      const walk = (y - startY) * 1.5;
      container.scrollTop = scrollTop - walk;
    };

    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("mouseleave", onMouseLeaveOrUp);
    container.addEventListener("mouseup", onMouseLeaveOrUp);
    container.addEventListener("mousemove", onMouseMove);

    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mouseleave", onMouseLeaveOrUp);
      container.removeEventListener("mouseup", onMouseLeaveOrUp);
      container.removeEventListener("mousemove", onMouseMove);
    };
  };

  useEffect(() => {
    const cleanCat = enableDragScroll(catContainerRef);
    const cleanChan = enableDragScroll(chanContainerRef);
    return () => {
      if (cleanCat) cleanCat();
      if (cleanChan) cleanChan();
    };
  }, [loadingCategories, loadingChannels, selectedCategory]);

  const filteredChannels = channels.filter((ch) =>
    ch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const streamUrl =
    selectedChannel && creds
      ? `/api/xtream?action=stream_live&username=${encodeURIComponent(
          creds.username
        )}&password=${encodeURIComponent(creds.password)}&stream_id=${selectedChannel.stream_id}`
      : null;

  return (
    <div className="h-full w-full bg-[#080b10] text-white flex flex-col md:flex-row p-2 md:p-4 gap-3 md:gap-4 overflow-hidden font-sans select-none relative pb-16 md:pb-0">
      
      {/* ========================================================= */}
      {/* LECTEUR APERÇU (HAUT SUR MOBILE 40% / DERNIER SUR DESKTOP)  */}
      {/* ========================================================= */}
      <div
        ref={playerContainerRef}
        onDoubleClick={handleTriggerFullScreen}
        className="w-full md:w-auto md:flex-1 h-[38vh] md:h-full bg-[#0e121a]/90 backdrop-blur-2xl border border-white/10 rounded-2xl md:rounded-3xl flex flex-col z-20 md:z-10 shadow-2xl overflow-hidden relative group/player flex-shrink-0 md:order-last"
      >
        {/* Header Player */}
        <div className="h-12 md:h-16 border-b border-white/10 px-3 md:px-6 flex items-center justify-between bg-white/5 flex-shrink-0">
          <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
            {selectedChannel ? (
              <>
                <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg bg-black border border-white/15 p-1 flex items-center justify-center shadow-md flex-shrink-0">
                  <img
                    src={selectedChannel.stream_icon}
                    alt={selectedChannel.name}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xs font-extrabold text-white tracking-wide truncate">
                    {selectedChannel.name}
                  </h1>
                  <p className="text-[9px] md:text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                    <Radio className="w-2.5 h-2.5 animate-pulse" /> Direct HD
                  </p>
                </div>
              </>
            ) : (
              <span className="text-xs text-zinc-400 font-semibold">G-TV Aperçu Direct</span>
            )}
          </div>

          <div className="flex items-center space-x-1.5 md:space-x-2 flex-shrink-0">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 md:p-2.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg md:rounded-xl text-zinc-300 hover:text-white transition-all active:scale-95"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleTriggerFullScreen}
              className="p-1.5 md:p-2.5 bg-white text-black font-bold border border-white rounded-lg md:rounded-xl transition-all active:scale-95 flex items-center space-x-1.5 text-xs shadow-lg"
            >
              <Maximize className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Plein Écran</span>
            </button>
          </div>
        </div>

        {/* Écran Vidéo */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          {selectedChannel ? (
            <iframe
              src={`${streamUrl}${isMuted ? "&muted=1" : ""}`}
              className="w-full h-full border-none"
              allow="autoplay; encrypted-media; fullscreen"
            />
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2 text-zinc-600 p-4 text-center">
              <Tv className="w-8 h-8 md:w-10 md:h-10 stroke-1" />
              <p className="text-[11px] md:text-xs font-semibold">
                Sélectionnez une chaîne pour lancer l'aperçu
              </p>
            </div>
          )}

          <div className="absolute bottom-3 bg-black/80 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-[10px] font-bold text-white opacity-0 group-hover/player:opacity-100 transition-opacity duration-300 shadow-2xl pointer-events-none flex items-center space-x-1.5">
            <Play className="w-3 h-3 fill-white" />
            <span>Double-cliquez pour Plein Écran</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CONTENU NAVIGATION (CATÉGORIES ➔ CHAÎNES)                */}
      {/* ========================================================= */}
      <div className="flex-1 md:flex-initial h-[62vh] md:h-full flex gap-3 md:gap-4 overflow-hidden min-w-0 relative md:order-first">
        
        {/* PANNEAU 1 : CATÉGORIES */}
        <div
          className={`h-full bg-[#0e121a]/90 backdrop-blur-2xl border border-white/10 rounded-2xl md:rounded-3xl flex flex-col z-10 shadow-2xl overflow-hidden transition-all duration-300 ${
            selectedCategory
              ? "hidden md:flex md:w-64 lg:w-72 flex-shrink-0"
              : "w-full md:w-72 flex-shrink-0"
          }`}
        >
          <div className="p-3 md:p-4 border-b border-white/10 flex items-center justify-between h-12 md:h-16 flex-shrink-0 bg-white/5">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-white text-black flex items-center justify-center font-black text-xs shadow-lg">
                G
              </div>
              <h2 className="text-xs font-extrabold tracking-wider uppercase text-white">
                Catégories
              </h2>
            </div>
            <span className="text-[10px] font-extrabold bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full border border-white/10">
              {categories.length}
            </span>
          </div>

          <div
            ref={catContainerRef}
            className="flex-1 overflow-y-auto p-2 md:p-3 space-y-1.5 scrollbar-none cursor-grab active:cursor-grabbing touch-pan-y"
          >
            {loadingCategories ? (
              <div className="flex flex-col items-center justify-center h-32 text-zinc-500 space-y-2">
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                <span className="text-xs font-medium">Chargement...</span>
              </div>
            ) : (
              categories.map((cat) => {
                const isSelected = selectedCategory?.category_id === cat.category_id;
                return (
                  <button
                    key={cat.category_id}
                    onClick={() => handleSelectCategory(cat)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl text-xs transition-all duration-300 text-left active:scale-98 ${
                      isSelected
                        ? "bg-white text-black font-black shadow-[0_10px_25px_rgba(255,255,255,0.2)]"
                        : "text-zinc-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10"
                    }`}
                  >
                    <span className="truncate pr-2">{cat.category_name}</span>
                    <ChevronRight
                      className={`w-4 h-4 flex-shrink-0 transition-transform ${
                        isSelected ? "text-black translate-x-0.5" : "text-zinc-500 group-hover:text-white"
                      }`}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* PANNEAU 2 : CHAÎNES */}
        {selectedCategory && (
          <div className="w-full md:w-72 lg:w-80 h-full bg-[#0e121a]/90 backdrop-blur-2xl border border-white/10 rounded-2xl md:rounded-3xl flex flex-col flex-shrink-0 z-10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 md:slide-in-from-left-4 duration-300">
            <div className="p-3 md:p-4 border-b border-white/10 space-y-2 h-20 md:h-24 flex-shrink-0 justify-center flex flex-col bg-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 text-white transition-all flex items-center justify-center flex-shrink-0"
                    title="Retour aux catégories"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <h3 className="text-xs font-extrabold text-white truncate">
                    {selectedCategory.category_name}
                  </h3>
                </div>
                <span className="text-[10px] text-zinc-400 font-bold bg-white/5 px-2 py-0.5 rounded-md border border-white/10 ml-2 flex-shrink-0">
                  {filteredChannels.length}
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Chercher une chaîne..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-1 pl-8 pr-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-all"
                />
              </div>
            </div>

            <div
              ref={chanContainerRef}
              className="flex-1 overflow-y-auto p-2 md:p-3 space-y-1.5 scrollbar-none cursor-grab active:cursor-grabbing touch-pan-y"
            >
              {loadingChannels ? (
                <div className="flex flex-col items-center justify-center h-32 text-zinc-500 space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span className="text-xs font-medium">Chargement...</span>
                </div>
              ) : filteredChannels.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-zinc-500 text-xs font-medium">
                  Aucune chaîne disponible
                </div>
              ) : (
                filteredChannels.map((channel) => {
                  const isSelected = selectedChannel?.stream_id === channel.stream_id;
                  return (
                    <button
                      key={channel.stream_id}
                      onClick={() => handleSelectChannel(channel)}
                      onDoubleClick={handleTriggerFullScreen}
                      className={`w-full flex items-center space-x-3 p-2 md:p-2.5 rounded-xl md:rounded-2xl transition-all duration-300 text-left relative active:scale-98 ${
                        isSelected
                          ? "bg-white text-black font-black shadow-[0_10px_20px_rgba(255,255,255,0.2)]"
                          : "hover:bg-white/10 border border-transparent hover:border-white/10 text-zinc-300"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-black border border-white/15 p-1 flex items-center justify-center flex-shrink-0 pointer-events-none">
                        {channel.stream_icon ? (
                          <img
                            src={channel.stream_icon}
                            alt={channel.name}
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <Tv className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pointer-events-none space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-extrabold ${isSelected ? "text-zinc-700" : "text-zinc-500"}`}>
                            #{channel.num}
                          </span>
                          {isSelected && (
                            <span className="text-[8px] font-black text-black uppercase tracking-widest bg-black/10 px-1.5 py-0.5 rounded">
                              Direct
                            </span>
                          )}
                        </div>
                        <p className={`text-xs truncate ${isSelected ? "text-black font-black" : "text-zinc-200 font-bold"}`}>
                          {channel.name}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}