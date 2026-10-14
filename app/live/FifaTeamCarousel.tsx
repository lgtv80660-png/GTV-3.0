"use client";

import { memo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, Loader2, Users } from "lucide-react";

type FootballTeam = {
  id: string;
  name: string;
  code: string | null;
};

type FifaPlayer = {
  id: string;
  name: string;
  fullName: string;
  number: number | null;
  position: "Gardien" | "Défenseur" | "Milieu" | "Attaquant";
  positionCode: "GK" | "DF" | "MF" | "FW";
  photo: string | null;
};

type FifaTeamResponse = {
  success: boolean;
  available?: boolean;
  team?: { name: string; code: string };
  players?: FifaPlayer[];
  error?: string;
};

const FIFA_SESSION_TTL = 24 * 60 * 60 * 1000;

async function readJson<T>(response: Response): Promise<T> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`API ${response.status}: réponse invalide`);
  }
}

function readFifaSession(key: string): FifaTeamResponse | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expires: number; value: FifaTeamResponse };
    if (!parsed?.expires || parsed.expires < Date.now()) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function writeFifaSession(key: string, value: FifaTeamResponse) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ expires: Date.now() + FIFA_SESSION_TTL, value }));
  } catch {}
}

const FifaPlayerCard = memo(function FifaPlayerCard({ player, teamCode }: { player: FifaPlayer; teamCode: string }) {
  return (
    <article className="group relative h-[224px] w-[138px] shrink-0 snap-start select-none overflow-hidden rounded-[22px] border border-white/[0.075] bg-[#0d111c] shadow-[0_12px_28px_rgba(0,0,0,.22)] sm:w-[146px] xl:w-[150px] [content-visibility:auto] [contain-intrinsic-size:224px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(123,82,255,.10),transparent_52%)]" />
      <div className="absolute left-2.5 top-2.5 z-20 flex items-center gap-1 rounded-full border border-white/[0.07] bg-black/50 px-2 py-1">
        <span className="text-[5.5px] font-black uppercase tracking-[0.12em] text-white/55">{teamCode}</span>
        {player.number !== null && <span className="text-[5.5px] font-black text-violet-200/75">#{player.number}</span>}
      </div>
      <div className="absolute inset-x-0 top-5 h-[158px]">
        {player.photo ? (
          <img src={player.photo} alt={player.name} loading="lazy" decoding="async" fetchPriority="low" draggable={false} className="pointer-events-none h-full w-full object-contain object-bottom drop-shadow-[0_12px_10px_rgba(0,0,0,.38)] transition-transform duration-200 group-hover:scale-[1.02]" />
        ) : (
          <div className="grid h-full place-items-center"><Users className="h-10 w-10 text-white/10" /></div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#070910] via-[#070910]/98 to-transparent px-3 pb-3 pt-10">
        <p className="truncate text-[8.5px] font-black text-white">{player.name}</p>
        <div className="mt-2 h-px bg-white/[0.07]" />
        <p className="mt-2 text-[5.5px] font-bold uppercase tracking-[0.14em] text-white/32">{player.position}</p>
      </div>
    </article>
  );
});

export default function FifaTeamCarousel({ team }: { team: FootballTeam }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FifaTeamResponse | null>(null);
  const drag = useRef({ active: false, startX: 0, startScrollLeft: 0, lastX: 0, lastTime: 0, velocity: 0, raf: 0 });

  useEffect(() => {
    const controller = new AbortController();
    const cacheKey = `gtv:fifa-team:${(team.code || team.name).toLowerCase()}`;
    const cached = readFifaSession(cacheKey);
    if (cached) {
      setData(cached); setError(null); setLoading(false);
      return () => controller.abort();
    }
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(null); setData(null);
      try {
        const params = new URLSearchParams({ team: team.name });
        if (team.code) params.set("code", team.code);
        const response = await fetch(`/api/football/fifa-team?${params.toString()}`, { cache: "force-cache", signal: controller.signal });
        const json = await readJson<FifaTeamResponse>(response);
        if (!response.ok || !json.success) throw new Error(json.error || "Équipe FIFA indisponible");
        if (!controller.signal.aborted) { setData(json); writeFifaSession(cacheKey, json); }
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") setError(cause instanceof Error ? cause.message : "Équipe FIFA indisponible");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [team.id, team.name, team.code]);

  useEffect(() => () => cancelAnimationFrame(drag.current.raf), []);

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rail = railRef.current; if (!rail) return;
    cancelAnimationFrame(drag.current.raf);
    drag.current = { ...drag.current, active: true, startX: event.clientX, startScrollLeft: rail.scrollLeft, lastX: event.clientX, lastTime: performance.now(), velocity: 0 };
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rail = railRef.current; if (!rail || !drag.current.active) return;
    const dx = event.clientX - drag.current.startX;
    if (Math.abs(dx) > 6) { if (event.cancelable) event.preventDefault(); try { rail.setPointerCapture(event.pointerId); } catch {} }
    rail.scrollLeft = drag.current.startScrollLeft - dx;
    const now = performance.now(); const delta = event.clientX - drag.current.lastX; const dt = Math.max(8, now - drag.current.lastTime);
    drag.current.velocity = drag.current.velocity * 0.58 + (delta / dt) * 16 * 0.42;
    drag.current.lastX = event.clientX; drag.current.lastTime = now;
  };
  const pointerEnd = () => {
    const rail = railRef.current; if (!rail) return;
    drag.current.active = false; let velocity = drag.current.velocity;
    const tick = () => { if (Math.abs(velocity) < 0.14) return; rail.scrollLeft -= velocity; velocity *= 0.92; drag.current.raf = requestAnimationFrame(tick); };
    drag.current.raf = requestAnimationFrame(tick);
  };
  const move = (direction: -1 | 1) => railRef.current?.scrollBy({ left: direction * 310, behavior: "smooth" });

  if (loading) return <div className="grid h-[250px] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-violet-200/70" /><p className="mt-3 text-[6px] uppercase tracking-[0.14em] text-white/25">Chargement FIFA</p></div></div>;
  if (error || !data?.available || !data.players?.length) return <div className="grid min-h-[220px] place-items-center rounded-[18px] border border-white/[0.05] bg-black/10 px-8 text-center"><div><Users className="mx-auto h-8 w-8 text-white/12" /><p className="mt-4 text-[9px] font-bold text-white/38">Équipe FIFA indisponible</p><p className="mt-2 text-[6.5px] leading-5 text-white/18">{error || "Aucun effectif FIFA trouvé pour cette équipe."}</p></div></div>;

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div><p className="text-[10px] font-black">Équipe</p><p className="mt-1 text-[5.5px] uppercase tracking-[0.15em] text-white/22">{data.players.length} joueurs · FIFA</p></div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => move(-1)} className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.07] bg-white/[0.025] text-white/45 hover:bg-white/[0.06]"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => move(1)} className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.07] bg-white/[0.025] text-white/45 hover:bg-white/[0.06]"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div ref={railRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} className="flex touch-pan-y cursor-grab snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-3 pr-20 active:cursor-grabbing [scrollbar-width:thin] [scrollbar-color:rgba(139,92,246,.35)_transparent]">
        {data.players.map((player) => <FifaPlayerCard key={player.id} player={player} teamCode={data.team?.code || team.code || ""} />)}
      </div>
    </div>
  );
}
