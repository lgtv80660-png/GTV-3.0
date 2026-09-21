"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Tv, Film, MonitorPlay, Search, Heart, LogOut, ShieldCheck, Calendar, Play } from "lucide-react";

interface UserInfo {
  username?: string;
  status?: string;
  exp_date?: string | number;
}

interface ContinueItem {
  id: string | number;
  title: string;
  poster: string;
  progress: number;
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
  const [lastWatched, setLastWatched] = useState<ContinueItem | null>(null);

  useEffect(() => {
    const creds = localStorage.getItem("gtv_xtream_credentials");
    if (creds) {
      try {
        setUserInfo(JSON.parse(creds).userInfo);
      } catch (e) {}
    }

    const savedProgress = localStorage.getItem("gtv_last_watched");
    if (savedProgress) {
      try {
        setLastWatched(JSON.parse(savedProgress));
      } catch (e) {}
    }
  }, []);

  if (pathname === "/login") return null;

  const handleLogout = () => {
    localStorage.removeItem("gtv_xtream_credentials");
    router.push("/login");
  };

  return (
    <nav className="hidden md:flex flex-col w-16 hover:w-60 h-screen bg-[#080b10] border-r border-white/10 z-50 transition-all duration-300 ease-in-out group flex-shrink-0 select-none overflow-hidden">
      
      {/* Logo G-TV */}
      <div className="h-16 flex items-center px-4 flex-shrink-0 border-b border-white/5">
        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center font-black text-black shadow-lg flex-shrink-0">
          G
        </div>
        <span className="ml-3 font-extrabold text-white text-base tracking-wider opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          -TV <span className="text-xs text-blue-400 font-normal">3.0</span>
        </span>
      </div>

      {/* Menu principal */}
      <div className="flex-1 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center h-11 px-4 transition-all relative ${
                isActive
                  ? "text-white bg-white/10"
                  : item.isFavorite
                  ? "text-red-500/80 hover:text-red-400 hover:bg-white/5"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
              )}
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="ml-4 text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Continuer à regarder */}
      {lastWatched && (
        <div className="px-3 my-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group/card cursor-pointer" onClick={() => router.push(`/watch/${lastWatched.id}`)}>
            <img src={lastWatched.poster} alt={lastWatched.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
          </div>
        </div>
      )}

      {/* Profil Utilisateur */}
      <div className="p-3 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/20 flex items-center justify-center font-bold text-xs text-white flex-shrink-0">
            {userInfo?.username?.charAt(0).toUpperCase() || "U"}
          </div>
          <span className="text-xs font-bold text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
            {userInfo?.username || "Client"}
          </span>
        </div>
        <button onClick={handleLogout} title="Déconnexion" className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

    </nav>
  );
}