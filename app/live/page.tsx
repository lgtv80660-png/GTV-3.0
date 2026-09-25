"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe2,
  Heart,
  Loader2,
  Play,
  Radio,
  Search,
  Shield,
  Sparkles,
  Trophy,
  Tv,
  Users,
} from "lucide-react";

import { LivePlayer } from "@/components/player/LivePlayer";
import { channelLogoUrl } from "@/lib/channel-logo-url";
import {
  readAllCachedChannels,
  readLiveCache,
  writeLiveCache,
} from "@/lib/live-cache";
import {
  findXtreamChannelsForProgramme,
  programmeMatchScore,
  type BeinProgramme,
} from "@/lib/bein-guide";

/* =========================================================
   TYPES
========================================================= */

type Category = {
  category_id: string;
  category_name: string;
};

type Channel = {
  num: number;
  name: string;
  stream_id: number;
  stream_icon: string;
  category_id: string;
};

type FootballProvider = "espn" | "sportsrc";

type FootballTeam = {
  id: string;
  name: string;
  code: string | null;
  logo: string | null;
};

type FootballFixture = {
  id: string;
  provider: FootballProvider;
  providerMatchId: string;
  competitionId: string | null;
  startingAt: string;
  status: {
    short: string;
    long: string;
    live: boolean;
    finished: boolean;
  };
  league: {
    id: string | null;
    name: string;
    country: string | null;
    logo: string | null;
  };
  home: FootballTeam;
  away: FootballTeam;
  score: {
    home: number | null;
    away: number | null;
    display: string | null;
  };
};

type TodayResponse = {
  success: boolean;
  fixtures?: FootballFixture[];
  error?: string;
};

type BeinGuideResponse = {
  success: boolean;
  programmes?: BeinProgramme[];
  sources?: Array<{
    region: "france" | "mena";
    url: string;
    ok: boolean;
    count: number;
    error?: string;
  }>;
  error?: string;
};

type FixtureBroadcast = {
  programme: BeinProgramme;
  channels: Channel[];
};

type RegionFilter = "all" | "europe" | "africa";
type TeamSide = "home" | "away";

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
  team?: {
    name: string;
    code: string;
  };
  players?: FifaPlayer[];
  error?: string;
};

/* =========================================================
   CONFIG PERFORMANCE
========================================================= */

const CHANNEL_BATCH = 70;
const FIFA_SESSION_TTL = 24 * 60 * 60 * 1000;
const GUIDE_DELAY_MS = 250;

/* =========================================================
   HELPERS
========================================================= */

async function readJson<T>(response: Response): Promise<T> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`API ${response.status}: réponse invalide`);
  }
}

function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function getToday(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const y = parts.find((part) => part.type === "year")?.value;
    const m = parts.find((part) => part.type === "month")?.value;
    const d = parts.find((part) => part.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {}

  return new Date().toISOString().slice(0, 10);
}

function formatTime(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return "--:--";
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(hd|fhd|uhd|4k|540|720|1080|hevc|h265|h264|live)\b/g, " ")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function footballChannel(value: string | null | undefined) {
  if (!value) return false;
  const name = normalize(value);
  return [
    "bein sport",
    "bein sports",
    "dazn",
    "canal foot",
    "canal sport",
    "rmc sport",
    "sky sport",
    "supersport",
    "football",
    "foot",
  ].some((token) => name.includes(token));
}

function footballLogoUrl(url: string | null | undefined) {
  if (!url) return null;
  return `/api/football/logo?url=${encodeURIComponent(url)}`;
}

/* =========================================================
   GENERIC VERTICAL DRAG + MOMENTUM
   - boutons autorisés
   - souris + tactile + pen
   - roulette native conservée
========================================================= */

function attachVerticalDrag(ref: RefObject<HTMLDivElement | null>) {
  const element = ref.current;
  if (!element) return;

  let pressed = false;
  let dragged = false;
  let blockNextClick = false;
  let pointerId: number | null = null;

  let startY = 0;
  let startScrollTop = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;
  let raf = 0;

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const inertia = () => {
    stop();

    const tick = () => {
      if (Math.abs(velocity) < 0.14) {
        raf = 0;
        return;
      }

      element.scrollTop -= velocity;
      velocity *= 0.92;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
  };

  const down = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("input,textarea,select,a")) return;

    stop();

    pressed = true;
    dragged = false;
    blockNextClick = false;
    pointerId = event.pointerId;

    startY = event.clientY;
    startScrollTop = element.scrollTop;
    lastY = event.clientY;
    lastTime = performance.now();
    velocity = 0;

    // IMPORTANT : ne pas capturer le pointeur ici.
    // Un simple clic doit rester entièrement géré par le <button> enfant.
  };

  const move = (event: PointerEvent) => {
    if (!pressed) return;

    const deltaFromStart = event.clientY - startY;

    // On ne bascule en drag qu'après un vrai déplacement.
    if (!dragged && Math.abs(deltaFromStart) > 6) {
      dragged = true;
      blockNextClick = true;
      element.style.cursor = "grabbing";
      element.style.userSelect = "none";

      // Capture uniquement une fois qu'on sait que c'est un drag.
      try {
        element.setPointerCapture(event.pointerId);
      } catch {}
    }

    if (!dragged) return;

    if (event.cancelable) event.preventDefault();

    element.scrollTop = startScrollTop - deltaFromStart;

    const now = performance.now();
    const delta = event.clientY - lastY;
    const dt = Math.max(8, now - lastTime);
    const instant = (delta / dt) * 16;

    velocity = velocity * 0.58 + instant * 0.42;
    lastY = event.clientY;
    lastTime = now;
  };

  const end = (event?: PointerEvent) => {
    if (!pressed) return;

    pressed = false;
    element.style.cursor = "grab";
    element.style.userSelect = "";

    if (dragged && event && pointerId !== null) {
      try {
        if (element.hasPointerCapture(pointerId)) {
          element.releasePointerCapture(pointerId);
        }
      } catch {}
    }

    pointerId = null;

    if (dragged) inertia();
  };

  const clickCapture = (event: MouseEvent) => {
    // Bloquer uniquement le clic qui suit un vrai drag.
    if (!blockNextClick) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    blockNextClick = false;
    dragged = false;
  };

  const wheel = () => stop();

  element.style.cursor = "grab";
  element.style.touchAction = "pan-x";

  element.addEventListener("pointerdown", down);
  element.addEventListener("pointermove", move, { passive: false });
  element.addEventListener("pointerup", end);
  element.addEventListener("pointercancel", end);
  element.addEventListener("click", clickCapture, true);
  element.addEventListener("wheel", wheel, { passive: true });

  return () => {
    stop();
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", end);
    element.removeEventListener("pointercancel", end);
    element.removeEventListener("click", clickCapture, true);
    element.removeEventListener("wheel", wheel);
  };
}

/* =========================================================
   PREMIUM TEAM LOGO
========================================================= */

const PremiumTeamLogo = memo(function PremiumTeamLogo({
  team,
  side = "home",
  size = "small",
}: {
  team: FootballTeam | null;
  side?: "home" | "away";
  size?: "small" | "medium";
}) {
  const source = footballLogoUrl(team?.logo);
  const shell = size === "medium" ? "h-[76px] w-[76px] rounded-[22px]" : "h-[50px] w-[50px] rounded-[15px]";
  const logo = size === "medium" ? "max-h-[58px] max-w-[58px]" : "max-h-[37px] max-w-[37px]";

  return (
    <div className={`relative grid ${shell} shrink-0 place-items-center border border-white/[0.08] bg-[#101420] shadow-[0_12px_30px_rgba(0,0,0,.28)]`}>
      <div className={`pointer-events-none absolute inset-0 rounded-[inherit] ${side === "home" ? "bg-violet-500/[0.06]" : "bg-blue-500/[0.06]"}`} />
      {source ? (
        <img
          src={source}
          alt={team?.name || ""}
          draggable={false}
          loading="lazy"
          decoding="async"
          className={`${logo} relative z-10 object-contain drop-shadow-[0_9px_8px_rgba(0,0,0,.5)]`}
        />
      ) : (
        <Shield className="relative z-10 h-6 w-6 text-white/12" />
      )}
    </div>
  );
});

/* =========================================================
   CHANNEL ROW (memo)
========================================================= */

const ChannelRow = memo(function ChannelRow({
  channel,
  active,
  onSelect,
}: {
  channel: Channel;
  active: boolean;
  onSelect: (channel: Channel) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(channel)}
      className={`group flex min-h-[58px] w-full items-center gap-3 rounded-[16px] border px-2.5 py-2 text-left transition [content-visibility:auto] [contain-intrinsic-size:58px] ${
        active
          ? "border-violet-400/50 bg-violet-500/[0.10]"
          : "border-white/[0.04] bg-white/[0.015] hover:border-white/[0.08] hover:bg-white/[0.035]"
      }`}
    >
      <div className="grid h-10 w-[50px] shrink-0 place-items-center overflow-hidden rounded-[11px] border border-white/[0.05] bg-[#111523] p-1.5">
        <img
          src={channelLogoUrl(channel.name, channel.stream_icon)}
          alt={channel.name}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          draggable={false}
          className="h-full w-full object-contain"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-[9.5px] font-bold ${active ? "text-white" : "text-white/70"}`}>
          {channel.name}
        </p>
        <p className="mt-1 text-[6px] uppercase tracking-[0.12em] text-white/18">
          #{channel.num || channel.stream_id}
        </p>
      </div>

      <Heart className={`h-3.5 w-3.5 ${active ? "text-violet-200/80" : "text-white/12"}`} />
    </button>
  );
});

/* =========================================================
   FIFA TEAM SESSION CACHE
========================================================= */

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
    sessionStorage.setItem(
      key,
      JSON.stringify({ expires: Date.now() + FIFA_SESSION_TTL, value })
    );
  } catch {}
}

/* =========================================================
   FIFA PLAYER CARD
========================================================= */

const FifaPlayerCard = memo(function FifaPlayerCard({
  player,
  teamCode,
}: {
  player: FifaPlayer;
  teamCode: string;
}) {
  return (
    <article className="group relative h-[224px] w-[138px] shrink-0 snap-start select-none overflow-hidden rounded-[22px] border border-white/[0.075] bg-[#0d111c] shadow-[0_16px_38px_rgba(0,0,0,.28)] sm:w-[146px] xl:w-[150px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(123,82,255,.13),transparent_52%)]" />

      <div className="absolute left-2.5 top-2.5 z-20 flex items-center gap-1 rounded-full border border-white/[0.07] bg-black/30 px-2 py-1 backdrop-blur-md">
        <span className="text-[5.5px] font-black uppercase tracking-[0.12em] text-white/55">{teamCode}</span>
        {player.number !== null && <span className="text-[5.5px] font-black text-violet-200/75">#{player.number}</span>}
      </div>

      <div className="absolute inset-x-0 top-5 h-[158px]">
        {player.photo ? (
          <img
            src={player.photo}
            alt={player.name}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="pointer-events-none h-full w-full object-contain object-bottom drop-shadow-[0_16px_12px_rgba(0,0,0,.48)] transition duration-300 group-hover:scale-[1.025]"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <Users className="h-10 w-10 text-white/10" />
          </div>
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

/* =========================================================
   FIFA TEAM CAROUSEL
========================================================= */

function FifaTeamCarousel({ team }: { team: FootballTeam }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FifaTeamResponse | null>(null);

  const drag = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    raf: 0,
  });

  useEffect(() => {
    const controller = new AbortController();
    const cacheKey = `gtv:fifa-team:${(team.code || team.name).toLowerCase()}`;
    const cached = readFifaSession(cacheKey);

    if (cached) {
      setData(cached);
      setError(null);
      setLoading(false);
      return () => controller.abort();
    }

    async function load() {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const params = new URLSearchParams({ team: team.name });
        if (team.code) params.set("code", team.code);

        const response = await fetch(`/api/football/fifa-team?${params.toString()}`, {
          cache: "force-cache",
          signal: controller.signal,
        });
        const json = await readJson<FifaTeamResponse>(response);
        if (!response.ok || !json.success) {
          throw new Error(json.error || "Équipe FIFA indisponible");
        }

        if (!controller.signal.aborted) {
          setData(json);
          writeFifaSession(cacheKey, json);
        }
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") {
          setError(cause instanceof Error ? cause.message : "Équipe FIFA indisponible");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    const timer = window.setTimeout(load, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [team.id, team.name, team.code]);

  useEffect(() => () => cancelAnimationFrame(drag.current.raf), []);

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rail = railRef.current;
    if (!rail) return;

    cancelAnimationFrame(drag.current.raf);
    drag.current.active = true;
    drag.current.startX = event.clientX;
    drag.current.startScrollLeft = rail.scrollLeft;
    drag.current.lastX = event.clientX;
    drag.current.lastTime = performance.now();
    drag.current.velocity = 0;
    try {
      rail.setPointerCapture(event.pointerId);
    } catch {}
  };

  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    if (!rail || !drag.current.active) return;

    const dx = event.clientX - drag.current.startX;
    if (Math.abs(dx) > 3 && event.cancelable) event.preventDefault();
    rail.scrollLeft = drag.current.startScrollLeft - dx;

    const now = performance.now();
    const delta = event.clientX - drag.current.lastX;
    const dt = Math.max(8, now - drag.current.lastTime);
    drag.current.velocity = drag.current.velocity * 0.58 + (delta / dt) * 16 * 0.42;
    drag.current.lastX = event.clientX;
    drag.current.lastTime = now;
  };

  const pointerEnd = () => {
    const rail = railRef.current;
    if (!rail) return;
    drag.current.active = false;
    let velocity = drag.current.velocity;

    const tick = () => {
      if (Math.abs(velocity) < 0.14) return;
      rail.scrollLeft -= velocity;
      velocity *= 0.92;
      drag.current.raf = requestAnimationFrame(tick);
    };
    drag.current.raf = requestAnimationFrame(tick);
  };

  const move = (direction: -1 | 1) => {
    railRef.current?.scrollBy({ left: direction * 310, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="grid h-[250px] place-items-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-violet-200/70" />
          <p className="mt-3 text-[6px] uppercase tracking-[0.14em] text-white/25">Chargement FIFA</p>
        </div>
      </div>
    );
  }

  if (error || !data?.available || !data.players?.length) {
    return (
      <div className="grid min-h-[220px] place-items-center rounded-[18px] border border-white/[0.05] bg-black/10 px-8 text-center">
        <div>
          <Users className="mx-auto h-8 w-8 text-white/12" />
          <p className="mt-4 text-[9px] font-bold text-white/38">Équipe FIFA indisponible</p>
          <p className="mt-2 text-[6.5px] leading-5 text-white/18">{error || "Aucun effectif FIFA trouvé pour cette équipe."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black">Équipe</p>
          <p className="mt-1 text-[5.5px] uppercase tracking-[0.15em] text-white/22">{data.players.length} joueurs · FIFA</p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="hidden items-center gap-1 rounded-full border border-violet-300/10 bg-violet-400/[0.04] px-2.5 py-1.5 text-[5.5px] font-bold uppercase tracking-[0.12em] text-violet-100/45 sm:flex">
            <ChevronLeft className="h-2.5 w-2.5" /> Glisser <ChevronRight className="h-2.5 w-2.5" />
          </span>
          <button type="button" onClick={() => move(-1)} className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.07] bg-white/[0.025] text-white/45 hover:bg-white/[0.06]">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => move(1)} className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.07] bg-white/[0.025] text-white/45 hover:bg-white/[0.06]">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute bottom-2 right-0 top-0 z-20 w-12 bg-gradient-to-l from-[#090c15] to-transparent" />
        <div
          ref={railRef}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
          onPointerCancel={pointerEnd}
          className="flex touch-pan-y cursor-grab snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-3 pr-20 active:cursor-grabbing [scrollbar-width:thin] [scrollbar-color:rgba(139,92,246,.35)_transparent] [&::-webkit-scrollbar]:h-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-violet-400/30"
        >
          {data.players.map((player) => (
            <FifaPlayerCard
              key={player.id}
              player={player}
              teamCode={data.team?.code || team.code || ""}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function LivePage() {
  const router = useRouter();

  const [timeZone, setTimeZone] = useState("UTC");
  const [categories, setCategories] = useState<Category[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [search, setSearch] = useState("");
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelLimit, setChannelLimit] = useState(CHANNEL_BATCH);

  const [fixtures, setFixtures] = useState<FootballFixture[]>([]);
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [fixturesError, setFixturesError] = useState<string | null>(null);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  const [selectedTeamSide, setSelectedTeamSide] = useState<TeamSide>("home");

  const [guide, setGuide] = useState<BeinProgramme[]>([]);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [guideSources, setGuideSources] = useState<BeinGuideResponse["sources"]>([]);

  const categoryRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<HTMLDivElement>(null);
  const matchRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => setTimeZone(getTimeZone()), []);

  /* CATEGORIES */
  useEffect(() => {
    let cancelled = false;
    const cached = readLiveCache<Category[]>("live-categories");

    if (cached?.length) {
      setCategories(cached);
      setLoadingCategories(false);
      return;
    }

    async function load() {
      setLoadingCategories(true);
      try {
        const response = await fetch("/api/xtream?action=get_live_categories", { cache: "no-store" });
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        const data = await response.json();
        if (cancelled || !Array.isArray(data)) return;

        const compact: Category[] = data.map((item: any) => ({
          category_id: String(item.category_id ?? ""),
          category_name: String(item.category_name ?? ""),
        }));
        setCategories(compact);
        writeLiveCache("live-categories", compact, 30 * 60 * 1000);
      } catch (error) {
        console.error("[Live categories]", error);
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  /* CHANNELS */
  useEffect(() => {
    setChannelLimit(CHANNEL_BATCH);
    if (!selectedCategory) {
      setChannels([]);
      return;
    }

    const categoryId = selectedCategory.category_id;
    const cacheKey = `live-channels:${categoryId}`;
    const cached = readLiveCache<Channel[]>(cacheKey);

    if (cached?.length) {
      setChannels(cached);
      setLoadingChannels(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setLoadingChannels(true);
      try {
        const response = await fetch(
          `/api/xtream?action=get_live_streams&category_id=${encodeURIComponent(categoryId)}`,
          { cache: "no-store", signal: controller.signal }
        );
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        const data = await response.json();
        if (cancelled || !Array.isArray(data)) return;

        const compact: Channel[] = data
          .map((item: any) => ({
            num: Number(item.num) || 0,
            name: String(item.name || ""),
            stream_id: Number(item.stream_id),
            stream_icon: String(item.stream_icon || ""),
            category_id: String(item.category_id || categoryId),
          }))
          .filter((item: Channel) => Number.isFinite(item.stream_id));

        setChannels(compact);
        writeLiveCache(cacheKey, compact, 15 * 60 * 1000);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("[Live channels]", error);
          if (!cancelled) setChannels([]);
        }
      } finally {
        if (!cancelled) setLoadingChannels(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedCategory, router]);

  const chooseCategory = useCallback((category: Category) => {
    setSelectedCategory(category);
    setSearch("");
  }, []);

  const chooseChannel = useCallback((channel: Channel) => {
    setSelectedChannel(channel);
    try {
      localStorage.setItem(
        "gtv_last_watched",
        JSON.stringify({
          id: channel.stream_id,
          title: channel.name,
          poster: channel.stream_icon,
          progress: 100,
          type: "live",
        })
      );
    } catch {}
  }, []);

  const launchChannel = useCallback(
    (channel: Channel) => {
      const targetCategory = categories.find((item) => item.category_id === channel.category_id);
      if (targetCategory && targetCategory.category_id !== selectedCategory?.category_id) {
        const cached = readLiveCache<Channel[]>(`live-channels:${targetCategory.category_id}`);
        if (cached?.length) setChannels(cached);
        setSelectedCategory(targetCategory);
      }
      chooseChannel(channel);
    },
    [categories, selectedCategory?.category_id, chooseChannel]
  );

  const filteredChannels = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return channels;
    return channels.filter((channel) => channel.name.toLowerCase().includes(query));
  }, [channels, search]);

  useEffect(() => setChannelLimit(CHANNEL_BATCH), [search, selectedCategory?.category_id]);

  const renderedChannels = useMemo(
    () => filteredChannels.slice(0, channelLimit),
    [filteredChannels, channelLimit]
  );

  const onChannelScroll = useCallback(() => {
    const el = channelRef.current;
    if (!el || channelLimit >= filteredChannels.length) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 220) {
      setChannelLimit((current) => Math.min(current + CHANNEL_BATCH, filteredChannels.length));
    }
  }, [channelLimit, filteredChannels.length]);

  const channelIndex = filteredChannels.findIndex(
    (channel) => channel.stream_id === selectedChannel?.stream_id
  );
  const hasNext = channelIndex >= 0 && channelIndex < filteredChannels.length - 1;
  const nextChannel = () => {
    if (!hasNext) return;
    const channel = filteredChannels[channelIndex + 1];
    if (channel) chooseChannel(channel);
  };

  /* FOOTBALL TODAY - indépendant de la chaîne sélectionnée */
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setFixturesLoading(true);
      setFixturesError(null);
      try {
        const date = getToday(timeZone);
        const response = await fetch(
          `/api/football/today?date=${encodeURIComponent(date)}&timezone=${encodeURIComponent(timeZone)}`,
          { cache: "no-store", signal: controller.signal }
        );
        const data = await readJson<TodayResponse>(response);
        if (!response.ok || !data.success) throw new Error(data.error || "Football indisponible");

        const list = data.fixtures ?? [];
        setFixtures(list);
        setSelectedFixtureId((current) =>
          current && list.some((item) => item.id === current)
            ? current
            : list.find((item) => item.status.live)?.id ?? list[0]?.id ?? null
        );
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setFixtures([]);
          setFixturesError(error instanceof Error ? error.message : "Erreur football");
        }
      } finally {
        if (!controller.signal.aborted) setFixturesLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [timeZone]);

  const filteredFixtures = useMemo(() => {
    if (regionFilter === "europe") return fixtures.filter((fixture) => fixture.provider === "espn");
    if (regionFilter === "africa") return fixtures.filter((fixture) => fixture.provider === "sportsrc");
    return fixtures;
  }, [fixtures, regionFilter]);

  useEffect(() => {
    if (!filteredFixtures.length) {
      setSelectedFixtureId(null);
      return;
    }
    if (!filteredFixtures.some((fixture) => fixture.id === selectedFixtureId)) {
      setSelectedFixtureId(filteredFixtures.find((item) => item.status.live)?.id ?? filteredFixtures[0].id);
    }
  }, [filteredFixtures, selectedFixtureId]);

  const selectedFixture = useMemo(
    () => fixtures.find((fixture) => fixture.id === selectedFixtureId) ?? null,
    [fixtures, selectedFixtureId]
  );

  useEffect(() => setSelectedTeamSide("home"), [selectedFixture?.id]);

  /* beIN guide: chargé une seule fois par journée dès que des matchs existent. */
  useEffect(() => {
    setGuideError(null);

    if (fixtures.length === 0) {
      setGuide([]);
      setGuideSources([]);
      setGuideLoading(false);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setGuideLoading(true);
      try {
        const date = getToday(timeZone);
        const response = await fetch(`/api/football/bein-guide?date=${encodeURIComponent(date)}`, {
          cache: "force-cache",
          signal: controller.signal,
        });
        const data = await readJson<BeinGuideResponse>(response);
        if (!response.ok || !data.success) throw new Error(data.error || "Guide beIN indisponible");
        if (!controller.signal.aborted) {
          setGuide(data.programmes ?? []);
          setGuideSources(data.sources ?? []);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setGuideError(error instanceof Error ? error.message : "Guide beIN indisponible");
        }
      } finally {
        if (!controller.signal.aborted) setGuideLoading(false);
      }
    }, GUIDE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fixtures.length, timeZone]);

  const allKnownChannels = useMemo(() => {
    const map = new Map<number, Channel>();
    for (const item of readAllCachedChannels()) map.set(item.stream_id, item);
    for (const item of channels) map.set(item.stream_id, item);
    return [...map.values()];
  }, [channels, selectedCategory?.category_id]);

  const fixtureBroadcasts = useMemo(() => {
    const result: Record<string, FixtureBroadcast[]> = {};
    if (!guide.length) return result;

    const categoryName = selectedCategory?.category_name || "";
    for (const fixture of filteredFixtures) {
      result[fixture.id] = guide
        .map((programme) => ({ programme, score: programmeMatchScore(programme, fixture) }))
        .filter((item) => item.score >= 100)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(({ programme }) => ({
          programme,
          channels: findXtreamChannelsForProgramme(programme, allKnownChannels, categoryName),
        }));
    }
    return result;
  }, [guide, filteredFixtures, allKnownChannels, selectedCategory?.category_name]);

  useEffect(() => {
    const cleanup = [
      attachVerticalDrag(categoryRef),
      attachVerticalDrag(channelRef),
      attachVerticalDrag(matchRef),
      attachVerticalDrag(detailRef),
    ];
    return () => cleanup.forEach((fn) => fn?.());
  }, [selectedCategory, selectedFixtureId, loadingCategories, loadingChannels, fixturesLoading]);

  const streamUrl = selectedChannel ? `/api/hls?id=${selectedChannel.stream_id}` : null;
  const mobileWatching = !!selectedChannel;

  // Les données football/beIN restent préchargées en arrière-plan,
  // mais l'interface Football ne s'affiche que dans un contexte sportif.
  const showFootball = useMemo(() => {
    if (!selectedChannel) return false;
    const categoryName = selectedCategory?.category_name || "";
    const normalizedCategory = normalize(categoryName);
    return (
      footballChannel(selectedChannel.name) ||
      footballChannel(categoryName) ||
      normalizedCategory.includes("sport") ||
      normalizedCategory.includes("football")
    );
  }, [selectedChannel?.name, selectedCategory?.category_name]);

  const europeCount = fixtures.filter((fixture) => fixture.provider === "espn").length;
  const africaCount = fixtures.filter((fixture) => fixture.provider === "sportsrc").length;

  const selectedBroadcasts = selectedFixture ? fixtureBroadcasts[selectedFixture.id] ?? [] : [];
  const firstLaunchableChannel = selectedBroadcasts.flatMap((entry) => entry.channels).find(Boolean) ?? null;
  const fifaSelectedTeam = selectedFixture
    ? selectedTeamSide === "home"
      ? selectedFixture.home
      : selectedFixture.away
    : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050711] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-15%,rgba(105,66,220,.08),transparent_35%)]" />

      <div className="relative z-10 flex h-full min-h-0 flex-col p-2.5 pb-20 md:p-3.5 md:pb-3.5">
        {/* TOP BAR */}
        <header className="mb-2.5 flex h-[56px] shrink-0 items-center gap-3 rounded-[20px] border border-white/[0.055] bg-[#090c16]/90 px-3.5 backdrop-blur-xl">
          <div className="flex min-w-[150px] items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-[12px] border border-violet-300/12 bg-violet-500/10">
              <Radio className="h-4 w-4 text-violet-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[13px] font-black">Live TV</h1>
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[5.5px] font-black uppercase tracking-[0.16em] text-red-300">Direct</span>
              </div>
              <p className="mt-0.5 max-w-[190px] truncate text-[6px] uppercase tracking-[0.14em] text-white/24">
                {selectedCategory?.category_name || timeZone}
              </p>
            </div>
          </div>

          <div className="relative mx-auto hidden w-full max-w-[480px] md:block">
            <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/22" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une chaîne..."
              className="h-9 w-full rounded-full border border-white/[0.07] bg-white/[0.025] pl-10 pr-4 text-[9px] outline-none placeholder:text-white/18 focus:border-violet-400/25"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-2 xl:flex">
              <Globe2 className="h-3 w-3 text-violet-200/50" />
              <span className="text-[6px] uppercase tracking-[0.1em] text-white/28">{timeZone}</span>
            </div>

            {selectedCategory && (
              <button
                type="button"
                onClick={() => {
                  setSelectedChannel(null);
                  setSelectedCategory(null);
                  setChannels([]);
                  setSearch("");
                }}
                className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-3 text-[7px] text-white/45 hover:bg-white/[0.05]"
              >
                <ArrowLeft className="h-3 w-3" /> Catégories
              </button>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-[180px_260px_minmax(420px,1fr)_minmax(370px,430px)] lg:gap-2.5 lg:overflow-hidden">
          {/* CATEGORIES */}
          <section className={`relative h-full min-h-[500px] overflow-hidden rounded-[22px] border border-white/[0.055] bg-[#0a0d16]/92 lg:min-h-0 ${selectedCategory ? "hidden lg:block" : "block"}`}>
            <div className="absolute inset-x-0 top-0 z-10 flex h-[62px] items-center justify-between border-b border-white/[0.045] bg-[#0a0d16]/98 px-3.5">
              <div>
                <p className="text-[11px] font-black">Catégories</p>
                <p className="mt-1 text-[5.5px] uppercase tracking-[0.14em] text-white/18">Glisser pour parcourir</p>
              </div>
              <span className="rounded-full bg-white/[0.03] px-2 py-1 text-[6px] text-white/30">{categories.length}</span>
            </div>

            <div ref={categoryRef} className="absolute inset-x-0 bottom-0 top-[62px] cursor-grab touch-pan-x overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin] [scrollbar-color:rgba(139,92,246,.26)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-violet-400/25">
              {loadingCategories ? (
                <div className="grid h-28 place-items-center"><Loader2 className="h-4 w-4 animate-spin text-violet-200/70" /></div>
              ) : (
                <div className="space-y-1.5">
                  {categories.map((category, index) => {
                    const active = selectedCategory?.category_id === category.category_id;
                    const sport = footballChannel(category.category_name) || normalize(category.category_name).includes("sport");
                    return (
                      <button
                        key={category.category_id}
                        type="button"
                        onClick={() => chooseCategory(category)}
                        className={`flex min-h-[46px] w-full items-center gap-2.5 rounded-[14px] border px-2.5 text-left transition ${active ? "border-violet-400/42 bg-violet-500/[0.11]" : "border-white/[0.035] bg-white/[0.014] hover:bg-white/[0.035]"}`}
                      >
                        <div className="grid h-7.5 w-7.5 shrink-0 place-items-center rounded-[9px] bg-white/[0.03]">
                          {sport ? <Trophy className="h-3.5 w-3.5 text-violet-200/75" /> : index === 0 ? <Sparkles className="h-3.5 w-3.5 text-white/35" /> : <Tv className="h-3.5 w-3.5 text-white/30" />}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-[8.5px] font-semibold text-white/58">{category.category_name}</span>
                        <ChevronRight className="h-3 w-3 text-white/12" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* CHANNELS */}
          {selectedCategory && (
            <section className={`relative h-full min-h-[500px] overflow-hidden rounded-[22px] border border-white/[0.055] bg-[#0a0d16]/92 lg:min-h-0 ${mobileWatching ? "hidden lg:block" : "block"}`}>
              <div className="absolute inset-x-0 top-0 z-10 h-[82px] border-b border-white/[0.045] bg-[#0a0d16]/98 p-3">
                <p className="truncate text-[11px] font-black">Chaînes <span className="font-medium text-white/25">({selectedCategory.category_name})</span></p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[5.5px] uppercase tracking-[0.13em] text-white/18">{filteredChannels.length} disponibles</p>
                  {filteredChannels.length > renderedChannels.length && <span className="text-[5.5px] text-violet-200/40">chargement progressif</span>}
                </div>
              </div>

              <div
                ref={channelRef}
                onScroll={onChannelScroll}
                className="absolute inset-x-0 bottom-0 top-[82px] cursor-grab touch-pan-x overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin] [scrollbar-color:rgba(139,92,246,.26)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-violet-400/25"
              >
                {loadingChannels ? (
                  <div className="grid h-28 place-items-center"><Loader2 className="h-4 w-4 animate-spin text-violet-200/70" /></div>
                ) : (
                  <div className="space-y-1.5">
                    {renderedChannels.map((channel) => (
                      <ChannelRow
                        key={channel.stream_id}
                        channel={channel}
                        active={selectedChannel?.stream_id === channel.stream_id}
                        onSelect={chooseChannel}
                      />
                    ))}
                    {renderedChannels.length < filteredChannels.length && (
                      <div className="py-4 text-center text-[6px] uppercase tracking-[0.12em] text-white/18">Glisse vers le bas pour charger la suite</div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* CENTER */}
          <section className="flex min-h-0 flex-col gap-2.5 lg:col-start-3">
            {selectedChannel && streamUrl ? (
              <div className="relative shrink-0 overflow-hidden rounded-[22px] border border-violet-400/18 bg-black shadow-[0_16px_45px_rgba(0,0,0,.35)]">
                <div className="aspect-video">
                  <LivePlayer
                    categories={categories}
                    channels={channels}
                    selectedCategory={selectedCategory}
                    selectedChannelId={selectedChannel.stream_id}
                    loadingChannels={loadingChannels}
                    onSelectCategory={chooseCategory}
                    onSelectChannel={chooseChannel}
                    onBackToCategories={() => {}}
                    sources={[streamUrl]}
                    ext="m3u8"
                    title={selectedChannel.name}
                    channelIcon={channelLogoUrl(selectedChannel.name, selectedChannel.stream_icon)}
                    hasNext={hasNext}
                    onNext={nextChannel}
                    onBack={() => setSelectedChannel(null)}
                  />
                </div>
              </div>
            ) : (
              <div className="grid min-h-[190px] shrink-0 place-items-center rounded-[22px] border border-white/[0.055] bg-[#090c15]/88 text-center lg:min-h-[220px]">
                <div>
                  <Tv className="mx-auto h-8 w-8 text-white/12" />
                  <p className="mt-3 text-[9px] font-semibold text-white/40">Choisissez une chaîne</p>
                  <p className="mt-1 text-[6px] text-white/18">Les matchs restent disponibles ci-dessous.</p>
                </div>
              </div>
            )}

            {showFootball && (
            <section className="min-h-[300px] flex-1 overflow-hidden rounded-[22px] border border-white/[0.055] bg-[#090c15]/92">
              <div className="flex h-[62px] items-center justify-between border-b border-white/[0.045] px-3.5">
                <div>
                  <p className="text-[11px] font-black">Football aujourd’hui</p>
                  <p className="mt-1 flex items-center gap-1 text-[5.5px] uppercase tracking-[0.12em] text-white/18"><CalendarDays className="h-2.5 w-2.5" /> {timeZone}</p>
                </div>
                <div className="flex items-center gap-2">
                  {guideLoading && <Loader2 className="h-3 w-3 animate-spin text-violet-200/45" />}
                  <span className="rounded-full bg-white/[0.03] px-2.5 py-1 text-[6px] text-white/30">{filteredFixtures.length}</span>
                </div>
              </div>

              <div className="flex gap-1.5 border-b border-white/[0.04] px-3 py-2">
                {[
                  { key: "all" as const, label: `Tous ${fixtures.length}` },
                  { key: "europe" as const, label: `Europe ${europeCount}` },
                  { key: "africa" as const, label: `Afrique ${africaCount}` },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setRegionFilter(filter.key)}
                    className={`rounded-full border px-3 py-1.5 text-[6.5px] font-bold transition ${regionFilter === filter.key ? "border-violet-400/35 bg-violet-600 text-white" : "border-white/[0.055] bg-white/[0.02] text-white/34 hover:bg-white/[0.045]"}`}
                  >
                    {filter.label}
                  </button>
                ))}
                <span className="ml-auto hidden items-center gap-1 text-[5.5px] uppercase text-white/16 xl:flex">
                  <BadgeCheck className="h-3 w-3 text-emerald-300/45" />
                  {guideLoading ? "beIN…" : guide.length ? "beIN actif" : "beIN"}
                </span>
              </div>

              <div ref={matchRef} className="h-[calc(100%-101px)] cursor-grab touch-pan-x overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin] [scrollbar-color:rgba(139,92,246,.26)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-violet-400/25">
                {fixturesLoading ? (
                  <div className="grid h-36 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-violet-200/70" /></div>
                ) : fixturesError ? (
                  <div className="grid h-36 place-items-center px-8 text-center text-[8px] text-red-300/55">{fixturesError}</div>
                ) : !filteredFixtures.length ? (
                  <div className="grid h-36 place-items-center text-[8px] text-white/22">Aucun match.</div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredFixtures.map((fixture) => {
                      const active = fixture.id === selectedFixtureId;
                      const detected = fixtureBroadcasts[fixture.id] ?? [];
                      const launchable = detected.flatMap((entry) => entry.channels).find(Boolean) ?? null;

                      return (
                        <button
                          key={fixture.id}
                          type="button"
                          onClick={() => setSelectedFixtureId(fixture.id)}
                          className={`w-full rounded-[17px] border p-2.5 text-left transition [content-visibility:auto] [contain-intrinsic-size:110px] ${active ? "border-violet-400/48 bg-violet-500/[0.085]" : "border-white/[0.045] bg-white/[0.012] hover:bg-white/[0.03]"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[6.5px] font-bold text-white/48">{fixture.league.name}</p>
                              <p className="mt-0.5 text-[5px] uppercase tracking-[0.1em] text-white/16">{fixture.provider === "sportsrc" ? "Afrique" : "Europe"}</p>
                            </div>
                            <span className="text-[10px] font-black text-violet-100">{fixture.status.live || fixture.status.finished ? fixture.score.display || "-" : formatTime(fixture.startingAt, timeZone)}</span>
                          </div>

                          <div className="mt-2.5 grid grid-cols-[1fr_34px_1fr] items-center gap-2">
                            <div className="flex min-w-0 items-center gap-2"><PremiumTeamLogo team={fixture.home} /><p className="truncate text-[7.5px] font-bold text-white/75">{fixture.home.name}</p></div>
                            <span className="text-center text-[5.5px] font-black text-white/18">VS</span>
                            <div className="flex min-w-0 items-center justify-end gap-2"><p className="truncate text-right text-[7.5px] font-bold text-white/75">{fixture.away.name}</p><PremiumTeamLogo team={fixture.away} side="away" /></div>
                          </div>

                          <div className="mt-2 flex items-center justify-between border-t border-white/[0.04] pt-2">
                            <span className="truncate text-[5.5px] text-white/18">
                              {detected[0]?.programme.title || (guideLoading ? "Recherche du diffuseur…" : guideError ? "Guide beIN indisponible" : "Diffuseur en recherche")}
                            </span>
                            {launchable && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  launchChannel(launchable);
                                }}
                                className="ml-3 flex h-7 shrink-0 items-center gap-1 rounded-full bg-violet-600 px-2.5 text-[5.5px] font-black text-white"
                              >
                                <Play className="h-2.5 w-2.5 fill-current" /> Regarder
                              </button>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
            )}
          </section>

          {/* RIGHT PANEL */}
          {showFootball && selectedFixture && (
            <aside className="mt-2.5 min-h-[520px] overflow-hidden rounded-[22px] border border-white/[0.055] bg-[#090c15]/94 lg:col-start-4 lg:mt-0 lg:min-h-0">
              <div ref={detailRef} className="h-full cursor-grab touch-pan-x overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(139,92,246,.22)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-violet-400/20">
                <div className="border-b border-white/[0.045] p-3.5">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-3.5 w-3.5 text-amber-300/65" />
                    <p className="min-w-0 flex-1 truncate text-[9px] font-black">{selectedFixture.league.name}</p>
                    <Clock3 className="h-3 w-3 text-white/18" />
                  </div>

                  <div className="mt-4 grid grid-cols-[1fr_72px_1fr] items-center gap-2">
                    <div className="flex min-w-0 flex-col items-center"><PremiumTeamLogo team={selectedFixture.home} size="medium" /><p className="mt-2 max-w-full truncate text-[8.5px] font-black">{selectedFixture.home.name}</p></div>
                    <div className="text-center"><p className="text-[20px] font-black">{selectedFixture.status.live || selectedFixture.status.finished ? selectedFixture.score.display || "-" : formatTime(selectedFixture.startingAt, timeZone)}</p><p className="mt-1 truncate text-[5px] uppercase tracking-[0.1em] text-white/16">{selectedFixture.status.long}</p></div>
                    <div className="flex min-w-0 flex-col items-center"><PremiumTeamLogo team={selectedFixture.away} side="away" size="medium" /><p className="mt-2 max-w-full truncate text-[8.5px] font-black">{selectedFixture.away.name}</p></div>
                  </div>
                </div>

                <div className="p-3">
                  <div className="rounded-[16px] border border-white/[0.05] bg-white/[0.015] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div><p className="text-[5.5px] uppercase tracking-[0.13em] text-white/18">Diffusion</p><p className="mt-1 text-[8px] font-bold text-white/58">beIN France + MENA</p></div>
                      <div className="flex gap-1">{(guideSources ?? []).map((source) => <span key={source.region} className={`rounded-full px-1.5 py-1 text-[5px] font-bold ${source.ok ? "bg-emerald-400/[0.07] text-emerald-200/55" : "bg-red-400/[0.07] text-red-200/50"}`}>{source.region === "france" ? "FR" : "MENA"} {source.ok ? source.count : "!"}</span>)}</div>
                    </div>
                    {guideError && <p className="mt-2 text-[5.5px] text-red-300/50">{guideError}</p>}
                    {firstLaunchableChannel && (
                      <button type="button" onClick={() => launchChannel(firstLaunchableChannel)} className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-[12px] bg-violet-600 text-[6.5px] font-black text-white"><Play className="h-3 w-3 fill-current" /> Lancer la chaîne</button>
                    )}
                  </div>
                </div>

                <div className="border-t border-white/[0.045] p-3">
                  <div className="mb-3 flex items-center gap-2"><Users className="h-3.5 w-3.5 text-violet-200/60" /><h2 className="text-[10px] font-black">Équipe</h2><span className="ml-auto text-[5px] uppercase tracking-[0.12em] text-white/18">FIFA 2026</span></div>

                  <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-[13px] border border-white/[0.045] bg-black/15 p-1.5">
                    <button type="button" onClick={() => setSelectedTeamSide("home")} className={`h-8 truncate rounded-[9px] px-2.5 text-[6.5px] font-black transition ${selectedTeamSide === "home" ? "bg-violet-600 text-white" : "text-white/28 hover:bg-white/[0.035]"}`}>{selectedFixture.home.name}</button>
                    <button type="button" onClick={() => setSelectedTeamSide("away")} className={`h-8 truncate rounded-[9px] px-2.5 text-[6.5px] font-black transition ${selectedTeamSide === "away" ? "bg-violet-600 text-white" : "text-white/28 hover:bg-white/[0.035]"}`}>{selectedFixture.away.name}</button>
                  </div>

                  {fifaSelectedTeam && <FifaTeamCarousel team={fifaSelectedTeam} />}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
