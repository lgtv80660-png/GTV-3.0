"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Tv, Film, MonitorPlay, Search, Heart, LogOut, ShieldCheck, Calendar, Play } from "lucide-react";

interface UserInfo {
  username?: string;
  status?: string;
  exp_date?: string | number;
  active_cons?: string | number;
  max_connections?: string | number;
}

interface ContinueItem {
  id: string | number;
  title: string;
  poster: string;
  progress: number;
  type: "movie" | "series" | "live";
}

const navItems = [
  { name: "Live TV", href: "/", icon: Tv },
  { name: "Films", href: "/movies", icon: Film },
  { name: "Séries", href: "/series", icon: MonitorPlay },
  { name: "Recherche", href: "/search", icon: Search },
  { name: "Favoris", href: "/favorites", icon: Heart, isFavorite: true },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [lastWatched, setLastWatched] = useState<ContinueItem | null>(null);

  useEffect(() => {
    const creds = localStorage.getItem("gtv_xtream_credentials");
    if (creds) {
      try {
        const parsed = JSON.parse(creds);
        setUserInfo(parsed.userInfo);
      } catch (e) {
        console.error(e);
      }
    }

    const savedProgress = localStorage.getItem("gtv_last_watched");
    if (savedProgress) {
      try {
        setLastWatched(JSON.parse(savedProgress));
      } catch (e) {
        console.error(e);
      }
    } else {
      setLastWatched({
        id: "157336",
        title: "Interstellar",
        poster: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
        progress: 68,
        type: "movie",
      });
    }
  }, []);

  if (pathname === "/login") {
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem("gtv_xtream_credentials");
    router.push("/login");
  };

  const formatDate = (timestamp?: string | number) => {
    if (!timestamp) return "Illimité";
    const date = new Date(Number(timestamp) * 1000);
    return isNaN(date.getTime())
      ? timestamp.toString()
      : date.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  };

  return (
    <>
      {/* MOBILE : BOTTOM BAR GLASS */}
      <nav className="md:hidden fixed bottom-4 inset-x-4 h-16 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl z-50 flex items-center justify-around px-2 shadow-2xl">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 ${
                isActive
                  ? "text-white scale-105"
                  : item.isFavorite
                  ? "text-red-500/70 hover:text-red-500"
                  : "text-white/30 hover:text-white/80"
              }`}
            >
              <Icon
                className={`w-5 h-5 ${
                  item.isFavorite
                    ? isActive
                      ? "text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                      : "text-red-500/80"
                    : ""
                }`}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className="text-[10px] font-medium tracking-wide">
                {item.name}
              </span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center w-full h-full text-white/30 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-wide">Déco</span>
        </button>
      </nav>

      {/* DESKTOP : SIDEBAR DARK GLASS APPLE TV */}
      <nav className="hidden md:flex flex-col fixed inset-y-4 left-4 w-16 hover:w-64 h-[calc(100vh-2rem)] bg-black/30 backdrop-blur-xl border border-white/10 rounded-3xl z-50 transition-all duration-300 ease-out group shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] overflow-hidden">
        
        {/* Logo G-TV */}
        <div className="h-20 flex items-center px-4 flex-shrink-0">
          <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-white flex items-center justify-center font-black text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            G
          </div>
          <span className="ml-4 text-lg font-bold tracking-wider text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            -TV
          </span>
        </div>

        {/* Navigation */}
        <div className="flex-col gap-2 py-2 relative">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center h-11 px-5 transition-all duration-300 relative ${
                  isActive
                    ? "text-white"
                    : item.isFavorite
                    ? "text-red-500/70 hover:text-red-400"
                    : "text-white/30 hover:text-white/80"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1 bottom-1 w-1 bg-white rounded-r-full shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
                )}

                <Icon
                  className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                    isActive ? "scale-110" : ""
                  } ${
                    item.isFavorite
                      ? isActive
                        ? "text-red-500 fill-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                        : "text-red-500"
                      : ""
                  }`}
                />
                <span className="ml-4 text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>

        {/* WIDGET : CONTINUER À REGARDER AVEC GRANDE AFFICHE */}
        {lastWatched && (
          <div className="mx-3 my-auto opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">
              <span>Continuer à regarder</span>
              <span className="text-blue-400">{lastWatched.progress}%</span>
            </div>

            <div
              onClick={() => router.push(`/watch/${lastWatched.id}`)}
              className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-white/15 bg-zinc-900 group/card cursor-pointer shadow-2xl transition-all hover:scale-[1.02] hover:border-white/30"
            >
              {/* Image de fond de grande taille */}
              <img
                src={lastWatched.poster}
                alt={lastWatched.title}
                className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-500"
              />

              {/* Gradient d'ombrage du bas */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

              {/* Bouton Play au centre */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white group-hover/card:scale-110 transition-all shadow-lg">
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                </div>
              </div>

              {/* Titre & Barre de progression */}
              <div className="absolute bottom-2 inset-x-3 space-y-1.5">
                <span className="text-xs font-bold text-white truncate block drop-shadow">
                  {lastWatched.title}
                </span>

                <div className="w-full h-1.5 bg-white/20 backdrop-blur-sm rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                    style={{ width: `${lastWatched.progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section Profil & Expiration */}
        <div className="p-3 mb-2 flex-shrink-0 border-t border-white/10 relative mt-auto">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowProfileCard(!showProfileCard)}
              className="flex items-center space-x-3 text-left w-full overflow-hidden hover:opacity-80 transition-opacity"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-400 flex-shrink-0 flex items-center justify-center font-bold text-white shadow-md border border-white/20">
                {userInfo?.username ? userInfo.username.charAt(0).toUpperCase() : "U"}
              </div>
              
              <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                <span className="text-sm font-bold text-white truncate">
                  {userInfo?.username || "Utilisateur"}
                </span>
                
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3" />
                    {userInfo?.status || "Actif"}
                  </span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-zinc-400 flex items-center gap-0.5">
                    <Calendar className="w-3 h-3 text-zinc-500" />
                    {formatDate(userInfo?.exp_date)}
                  </span>
                </div>
              </div>
            </button>

            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="opacity-0 group-hover:opacity-100 p-2 text-white/40 hover:text-red-400 hover:bg-white/10 rounded-xl transition-all flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {showProfileCard && (
            <div className="absolute bottom-16 left-2 w-60 bg-zinc-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-4 shadow-2xl z-50 text-white animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="text-xs font-bold text-zinc-400 mb-3 uppercase tracking-wider">
                Abonnement Premium
              </div>
              <div className="space-y-2 text-xs mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Statut</span>
                  <span className="font-semibold text-emerald-400">{userInfo?.status || "Actif"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Expire le</span>
                  <span className="font-semibold text-white">{formatDate(userInfo?.exp_date)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Écrans autorisés</span>
                  <span className="font-semibold text-white">
                    {userInfo?.active_cons ?? 0} / {userInfo?.max_connections ?? 1}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-medium text-xs rounded-xl flex items-center justify-center space-x-2 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Se déconnecter</span>
              </button>
            </div>
          )}
        </div>

      </nav>
    </>
  );
}