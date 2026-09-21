"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, LogOut, X } from "lucide-react";

interface UserInfo {
  username?: string;
  status?: string;
  exp_date?: string | number;
  active_cons?: string | number;
  max_connections?: string | number;
}

export function Header() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

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
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("gtv_xtream_credentials");
    setIsOpen(false);
    router.push("/login");
  };

  const formatDate = (timestamp?: string | number) => {
    if (!timestamp) return "N/A";
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
    <header className="fixed top-4 right-4 z-40 flex items-center space-x-3">
      {/* Bouton d'ouverture du Profil */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-xl flex items-center justify-center text-white transition-all shadow-lg"
      >
        <User className="w-5 h-5" />
      </button>

      {/* Fenêtre Modale de Compte */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-2xl z-50 text-white animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold">Compte</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 text-sm mb-6">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Utilisateur</span>
              <span className="font-semibold text-white">{userInfo?.username || "Non connecté"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Statut</span>
              <span className="font-semibold text-emerald-400">{userInfo?.status || "Active"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Expire le</span>
              <span className="font-semibold text-white">{formatDate(userInfo?.exp_date)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Connexions</span>
              <span className="font-semibold text-white">
                {userInfo?.active_cons ?? 0} / {userInfo?.max_connections ?? 1}
              </span>
            </div>
          </div>

          {/* Bouton Déconnexion */}
          <button
            onClick={handleLogout}
            className="w-full py-2.5 bg-white/10 hover:bg-red-500/20 text-white hover:text-red-400 border border-white/10 hover:border-red-500/30 font-medium rounded-xl flex items-center justify-center space-x-2 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      )}
    </header>
  );
}