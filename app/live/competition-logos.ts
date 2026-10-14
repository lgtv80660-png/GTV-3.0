import type { FootballFixture } from "./live-types";

// Verified local files; see public/football/competitions/sources.json.
export const COMPETITION_LOGOS: Readonly<Record<string, string>> = {
  "uefa.champions": "/football/competitions/uefa.champions.png",
  "uefa.europa": "/football/competitions/uefa.europa.png",
  "uefa.europa.conf": "/football/competitions/uefa.europa.conf.png",
  "eng.1": "/football/competitions/eng.1.png",
  "esp.1": "/football/competitions/esp.1.png",
  "ita.1": "/football/competitions/ita.1.png",
  "ger.1": "/football/competitions/ger.1.png",
  "fra.1": "/football/competitions/fra.1.png",
  "uefa.nations": "/football/competitions/uefa.nations.png",
  "africa": "/football/competitions/africa.png",
};

export function fixtureCompetitionLogo(fixture: FootballFixture): string | null {
  const id = fixture.league.id ?? fixture.competitionId ?? "";
  const local = COMPETITION_LOGOS[id] ??
    (id === "caf.nations" || /africa cup of nations|coupe d.afrique des nations/i.test(fixture.league.name)
      ? COMPETITION_LOGOS.africa : undefined);
  // SportsRC can also supply other African competitions: never label those CAN.
  return local ?? (fixture.league.logo ? `/api/football/logo?url=${encodeURIComponent(fixture.league.logo)}` : null);
}
