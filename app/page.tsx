"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Tv,
  Search,
  Loader2,
  Radio,
  ChevronRight,
  Maximize,
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

  // 1. Initialisation Authentification
  useEffect(() => {
    const rawCreds = localStorage.getItem("gtv_xtream_credentials");
    if (!rawCreds) {
      router.push("/login");
      return;
    }

    try {
      const parsed = JSON.parse(rawCreds);
      setCreds({ username: parsed.username, password: parsed.password });

      fetchCategories(parsed.username, parsed.password);
    } catch (e) {
      router.push("/login");
    }
  }, [router]);

  // Chargement des catégories
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
        setSelectedCategory(data[0]);
      }
    } catch (err) {
      console.error(err);
    } font
    finally {
      setLoadingCategories(false);
    }
  }

  // 2. Chargement des chaînes de la catégorie choisie
  useEffect(() => {
    if (!selectedCategory || !creds) return;

    async function fetchChannels() {
      setLoadingChannels(true);
      try {
        const res = await fetch(
          `/api/xtream?action=get_live_streams&username=${encodeURIComponent(
            creds!.username
          )}&password=${encodeURIComponent(
            creds!.password
          )}&category_id=${selectedCategory?.category_id}`
        );
        const data = await res.json();

        if (Array.isArray(data)) {
          setChannels(data);
          if (data.length > 0) {
            handleSelectChannel(data[0]);
          } else {
            setSelectedChannel(null);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingChannels(false);
      }
    }

    fetchChannels();
  }, [selectedCategory, creds]);

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

  const filteredChannels = channels.filter((ch) =>
    ch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // URL du flux direct
  const streamUrl =
    selectedChannel && creds
      ? `/api/xtream?action=stream_live&username=${encodeURIComponent(
          creds.username
        )}&password=${encodeURIComponent(creds.password)}&stream_id=${selectedChannel.stream_id}`
      : null;

  return (
    <div className="h-screen w-screen bg-[#080b10] text-white flex overflow-hidden font-sans select-none">
      
      {/* ========================================================= */}
      {/* PANNEAU 1 : BARRE DES CATÉGORIES (GAUCHE)                 */}
      {/* ========================================================= */}
      <div className="w-64 h-full bg-[#0d1117] border-r border-white/10 flex flex-col flex-shrink-0 z-20">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Tv className="w-4 h-4 text-blue-500" />
            <h2 className="text-xs font-black tracking-wider uppercase text-zinc-300">
              Catégories
            </h2>
          </div>
          <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
            {categories.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-none">
          {loadingCategories ? (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-500 space-y-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-xs">Chargement...</span>
            </div>
          ) : (
            categories.map((cat) => {
              const isSelected = selectedCategory?.category_id === cat.category_id;
              return (
                <button
                  key={cat.category_id}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                    isSelected
                      ? "bg-white text-black shadow-lg"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="truncate">{cat.category_name}</span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 ${
                      isSelected ? "text-black" : "text-zinc-600"
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* PANNEAU 2 : BARRE DES CHAÎNES (MILIEU)                   */}
      {/* ========================================================= */}
      <div className="w-72 h-full bg-[#0a0d14] border-r border-white/10 flex flex-col flex-shrink-0 z-10">
        <div className="p-4 border-b border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white truncate">
              {selectedCategory?.category_name}
            </h3>
            <span className="text-[10px] text-zinc-500">
              {filteredChannels.length} chaîne(s)
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Chercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-none">
          {loadingChannels ? (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-500 space-y-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-xs">Chargement...</span>
            </div>
          ) : (
            filteredChannels.map((channel) => {
              const isSelected = selectedChannel?.stream_id === channel.stream_id;
              return (
                <button
                  key={channel.stream_id}
                  onClick={() => handleSelectChannel(channel)}
                  className={`w-full flex items-center space-x-3 p-2 rounded-xl transition-all text-left ${
                    isSelected
                      ? "bg-blue-600/20 border border-blue-500/40 text-white"
                      : "hover:bg-white/5 border border-transparent text-zinc-300"
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-black border border-white/10 p-1 flex items-center justify-center flex-shrink-0">
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
                      <Tv className="w-4 h-4 text-zinc-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-zinc-500 block">
                      #{channel.num}
                    </span>
                    <p className="text-xs font-bold truncate">{channel.name}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* ZONE 3 : LECTEUR DIRECT EN TEMPS RÉEL (DROITE)             */}
      {/* ========================================================= */}
      <div className="flex-1 h-full flex flex-col bg-black relative">
        
        {/* Header Direct */}
        <div className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-[#080b10]">
          {selectedChannel ? (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-black border border-white/15 p-1 flex items-center justify-center">
                <img
                  src={selectedChannel.stream_icon}
                  alt={selectedChannel.name}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-xs font-bold text-white">
                  {selectedChannel.name}
                </h1>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse" /> En Direct
                </p>
              </div>
            </div>
          ) : (
            <span className="text-xs text-zinc-500">Aucune chaîne active</span>
          )}

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                } else {
                  document.documentElement.requestFullscreen();
                }
              }}
              className="p-2 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Écran Lecteur Vidéo */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          {selectedChannel ? (
            <iframe
              src={streamUrl || ""}
              className="w-full h-full border-none"
              allow="autoplay; encrypted-media; fullscreen"
            />
          ) : (
            <div className="flex flex-col items-center space-y-2 text-zinc-600">
              <Tv className="w-10 h-10 stroke-1" />
              <p className="text-xs">Sélectionnez une chaîne pour démarrer la lecture</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}