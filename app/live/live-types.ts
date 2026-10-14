import type { BeinProgramme } from "@/lib/bein-guide";

export type Category = {
  category_id: string;
  category_name: string;
};

export type Channel = {
  num: number;
  name: string;
  stream_id: number;
  stream_icon: string;
  category_id: string;
};

export type FootballProvider = "espn" | "sportsrc";

export type FootballTeam = {
  id: string;
  name: string;
  code: string | null;
  logo: string | null;
};

export type FootballFixture = {
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

export type TodayResponse = {
  success: boolean;
  fixtures?: FootballFixture[];
  error?: string;
};

export type BeinGuideResponse = {
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

export type FixtureBroadcast = {
  programme: BeinProgramme;
  channels: Channel[];
};

export type RegionFilter = "all" | "europe" | "africa";
export type TeamSide = "home" | "away";
