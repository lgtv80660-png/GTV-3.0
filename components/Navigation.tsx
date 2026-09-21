"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tv, Film, MonitorPlay, Search, Heart, Settings } from "lucide-react";

const navItems = [
  { name: "Live TV", href: "/", icon: Tv },
  { name: "Films", href: "/movies", icon: Film },
  { name: "Séries", href: "/series", icon: MonitorPlay },
  { name: "Recherche", href: "/search", icon: Search },
  { name: "Favoris", href: "/favorites", icon: Heart, isFavorite: true },
];

export function Navigation() {
  const pathname = usePathname();

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
      </nav>

      {/* DESKTOP : SIDEBAR DARK GLASS MINIMALISTE */}
      <nav className="hidden md:flex flex-col fixed inset-y-4 left-4 w-16 hover:w-60 h-[calc(100vh-2rem)] bg-black/30 backdrop-blur-xl border border-white/10 rounded-3xl z-50 transition-all duration-300 ease-out group shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] overflow-hidden">
        
        {/* Logo */}
        <div className="h-20 flex items-center px-4 flex-shrink-0">
          <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-white flex items-center justify-center font-black text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            G
          </div>
          <span className="ml-4 text-lg font-bold tracking-wider text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            -TV
          </span>
        </div>

        {/* Liens de navigation */}
        <div className="flex-1 flex flex-col gap-3 py-4 relative">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center h-12 px-5 transition-all duration-300 relative ${
                  isActive
                    ? "text-white"
                    : item.isFavorite
                    ? "text-red-500/70 hover:text-red-400"
                    : "text-white/30 hover:text-white/80"
                }`}
              >
                {/* Ligne blanche d'activation */}
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

        {/* Paramètres */}
        <div className="p-2 mb-2 flex-shrink-0">
          <Link
            href="/settings"
            className="flex items-center h-12 px-3 text-white/30 hover:text-white/80 transition-all duration-200"
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span className="ml-4 text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Paramètres
            </span>
          </Link>
        </div>
      </nav>
    </>
  );
}