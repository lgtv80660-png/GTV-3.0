"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Tv, Film, MonitorPlay, Search, Heart, LogOut } from "lucide-react";

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

  if (pathname === "/login") return null;

  const handleLogout = () => {
    localStorage.removeItem("gtv_xtream_credentials");
    router.push("/login");
  };

  return (
    <>
      {/* DESKTOP : NAVIGATION SIDEBAR */}
      <nav className="hidden md:flex flex-col w-16 hover:w-60 h-full bg-[#080b10] border-r border-white/10 z-50 transition-all duration-300 ease-in-out group flex-shrink-0 select-none overflow-hidden">
        <div className="h-16 flex items-center px-4 flex-shrink-0 border-b border-white/5">
          <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center font-black text-black shadow-lg flex-shrink-0">
            G
          </div>
          <span className="ml-3 font-extrabold text-white text-base tracking-wider opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            -TV <span className="text-xs text-blue-400 font-normal">3.0</span>
          </span>
        </div>

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
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full" />
                )}
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="ml-4 text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="p-3 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={handleLogout}
            title="Déconnexion"
            className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* MOBILE : BOTTOM NAVIGATION BAR FLOANTEE EN BAS */}
      <div className="md:hidden fixed bottom-2 left-2 right-2 h-16 bg-[#0e121a]/95 backdrop-blur-2xl border border-white/15 rounded-2xl z-50 flex items-center justify-around px-2 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${
                isActive
                  ? "bg-white text-black font-black scale-105 shadow-md"
                  : item.isFavorite
                  ? "text-red-400 opacity-80"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-extrabold mt-0.5">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}