"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    console.error("Erreur critique interceptée :", error);
  }, [error]);

  return (
    <div className="flex flex-col h-screen w-full items-center justify-center bg-[#0d0e12] text-white p-6 text-center">
      <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-2xl max-w-2xl w-full shadow-2xl">
        <h2 className="text-2xl font-bold text-red-500 mb-4">Le composant a planté !</h2>
        <p className="text-gray-300 mb-4">Voici le message d'erreur technique exact :</p>
        <div className="bg-black/80 p-4 rounded-xl text-left overflow-auto mb-6 text-sm text-red-400 font-mono border border-red-500/20 whitespace-pre-wrap">
          {error.message || "Erreur inconnue (vérifie la console du navigateur)."}
        </div>
        <button
          onClick={() => reset()}
          className="bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-xl transition font-medium border border-white/10"
        >
          Recharger la page
        </button>
      </div>
    </div>
  );
}
