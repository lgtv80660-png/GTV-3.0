export default function Home() {
  return (
    <div className="min-h-screen p-8 pl-24 md:pl-28 space-y-8 bg-gradient-to-br from-slate-950 via-sky-950 to-slate-900">
      
      {/* Banner de test avec de la couleur */}
      <div className="w-full h-64 rounded-3xl bg-gradient-to-r from-sky-500 to-indigo-600 p-8 flex flex-col justify-end shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-60 h-60 bg-white/10 rounded-full blur-2xl" />
        <h1 className="text-4xl font-black text-white mb-2">G-TV V3 Hybrid</h1>
        <p className="text-sky-100 text-lg">Passe ta souris sur la barre de gauche pour voir l'effet de verre flouté iOS sur cette bannière.</p>
      </div>

      {/* Grille de cartes de démonstration */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
          <div key={item} className="h-40 rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col justify-between hover:bg-white/10 transition-all">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 font-bold">
              {item}
            </div>
            <p className="text-sm font-semibold text-white/80">Affiche Film #{item}</p>
          </div>
        ))}
      </div>

    </div>
  );
}