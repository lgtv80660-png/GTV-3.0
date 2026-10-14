export type BeinRegion =
  | "france"
  | "mena";

export type BeinProgramme = {
  region: BeinRegion;
  channel: string;
  title: string;
  description?: string | null;
  category: string | null;
  start: string | null;
  end: string | null;
  live: boolean;
};

export type LiveChannel = {
  num: number;
  name: string;
  stream_id: number;
  stream_icon: string;
  category_id: string;
};

export type FixtureLike = {
  id: string;
  startingAt: string;

  home: {
    name: string;
  };

  away: {
    name: string;
  };
};

/* =========================================================
   TEXT
   ========================================================= */

export function normalizeGuideText(
  value:
    | string
    | null
    | undefined
) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /\+/g,
      " plus "
    )
    .replace(
      /&/g,
      " and "
    )
    .replace(
      /\b(hd|fhd|uhd|4k|hevc|h264|h265|live|direct|channel|chaine|tv)\b/g,
      " "
    )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

/* =========================================================
   TEAM ALIASES
   ========================================================= */

const TEAM_ALIASES:
  Record<
    string,
    string[]
  > = {
  algeria: [
    "algerie",
  ],

  algerie: [
    "algeria",
  ],

  morocco: [
    "maroc",
  ],

  maroc: [
    "morocco",
  ],

  tunisia: [
    "tunisie",
  ],

  tunisie: [
    "tunisia",
  ],

  egypt: [
    "egypte",
  ],

  egypte: [
    "egypt",
  ],

  germany: [
    "allemagne",
  ],

  allemagne: [
    "germany",
  ],

  spain: [
    "espagne",
  ],

  espagne: [
    "spain",
  ],

  england: [
    "angleterre",
  ],

  angleterre: [
    "england",
  ],

  italy: [
    "italie",
  ],

  italie: [
    "italy",
  ],

  turkey: [
    "turkiye",
    "turquie",
  ],

  turkiye: [
    "turkey",
    "turquie",
  ],

  turquie: [
    "turkey",
    "turkiye",
  ],

  netherlands: [
    "holland",
    "pays bas",
  ],

  holland: [
    "netherlands",
    "pays bas",
  ],

  "pays bas": [
    "netherlands",
    "holland",
  ],

  "cote d ivoire": [
    "ivory coast",
  ],

  "ivory coast": [
    "cote d ivoire",
  ],

  "guinea bissau": [
    "guinee bissau",
    "guinea-bissau",
    "guinee-bissau",
    "g bissau",
  ],

  "guinee bissau": [
    "guinea bissau",
    "guinea-bissau",
    "g bissau",
  ],

  "united states": [
    "usa",
    "us",
  ],

  usa: [
    "united states",
    "us",
  ],

  "south korea": [
    "korea republic",
    "republic of korea",
    "korea",
  ],

  "korea republic": [
    "south korea",
    "republic of korea",
  ],

  "northern ireland": [
    "n ireland",
  ],

  "bosnia and herzegovina": [
    "bosnia herzegovina",
    "bosnia",
  ],

  "cape verde": [
    "cabo verde",
  ],

  "cabo verde": [
    "cape verde",
  ],
};

/* =========================================================
   TEAM VARIANTS
   ========================================================= */

function variants(
  name: string
) {
  const base =
    normalizeGuideText(
      name
    );

  if (!base) {
    return [];
  }

  const generated =
    new Set<string>([
      base,

      ...(
        TEAM_ALIASES[
          base
        ] ?? []
      ),
    ]);

  const tokens =
    base
      .split(" ")
      .filter(Boolean);

  if (
    tokens.length >= 2
  ) {
    generated.add(
      tokens.join(" ")
    );

    if (
      tokens.every(
        (token) =>
          token.length >= 4
      )
    ) {
      generated.add(
        tokens
          .slice(-2)
          .join(" ")
      );
    }
  }

  return [
    ...generated,
  ]
    .map(
      normalizeGuideText
    )
    .filter(
      (value) =>
        value.length >= 3
    );
}

function hasAny(
  text: string,
  values: string[]
) {
  return values.some(
    (value) =>
      value.length >= 3 &&
      text.includes(
        value
      )
  );
}

function tokenOverlap(
  text: string,
  teamName: string
) {
  const textTokens =
    new Set(
      normalizeGuideText(
        text
      )
        .split(" ")
        .filter(
          (token) =>
            token.length >= 3
        )
    );

  const teamTokens =
    normalizeGuideText(
      teamName
    )
      .split(" ")
      .filter(
        (token) =>
          token.length >= 3
      );

  if (
    !teamTokens.length
  ) {
    return 0;
  }

  const common =
    teamTokens.filter(
      (token) =>
        textTokens.has(
          token
        )
    ).length;

  return (
    common /
    teamTokens.length
  );
}

/* =========================================================
   PROGRAMME ↔ FIXTURE
   ========================================================= */

export function programmeMatchScore(
  programme:
    BeinProgramme,

  fixture:
    FixtureLike
) {
  const title =
    normalizeGuideText(
      programme.title
    );

  const description =
    normalizeGuideText(
      programme.description ||
        ""
    );

  const category =
    normalizeGuideText(
      programme.category ||
        ""
    );

  const text =
    `${title} ${description} ${category}`
      .trim();

  if (!text) {
    return 0;
  }

  const homeVariants =
    variants(
      fixture.home.name
    );

  const awayVariants =
    variants(
      fixture.away.name
    );

  const homeInTitle =
    hasAny(
      title,
      homeVariants
    );

  const awayInTitle =
    hasAny(
      title,
      awayVariants
    );

  const homeAnywhere =
    homeInTitle ||
    hasAny(
      text,
      homeVariants
    );

  const awayAnywhere =
    awayInTitle ||
    hasAny(
      text,
      awayVariants
    );

  if (
    homeInTitle &&
    awayInTitle
  ) {
    return programme.live
      ? 180
      : 165;
  }

  if (
    homeAnywhere &&
    awayAnywhere
  ) {
    return programme.live
      ? 165
      : 150;
  }

  const homeOverlap =
    tokenOverlap(
      text,
      fixture.home.name
    );

  const awayOverlap =
    tokenOverlap(
      text,
      fixture.away.name
    );

  if (
    homeOverlap >= 0.99 &&
    awayOverlap >= 0.99
  ) {
    return programme.live
      ? 155
      : 140;
  }

  /*
   * Une seule équipe ne suffit jamais.
   */
  return 0;
}

/* =========================================================
   CHANNEL SIGNATURE
   ========================================================= */

type ChannelFamily =
  | "fr"
  | "en"
  | "max"
  | "xtra"
  | "main"
  | "4k"
  | "unknown";

type ChannelSignature = {
  family:
    ChannelFamily;

  number:
    string | null;

  text:
    string;

  isBein:
    boolean;
};

function normalizeChannelNumber(
  value:
    | string
    | undefined
    | null
) {
  if (!value) {
    return null;
  }

  const parsed =
    Number.parseInt(
      value,
      10
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return null;
  }

  return String(
    parsed
  );
}

function channelSignature(
  name: string
): ChannelSignature {
  let text =
    normalizeGuideText(
      name
    );

  /*
   * Provider suffix :
   *
   * BeIN Sport 02 (540)
   * BeIN Sport 02 [720]
   *
   * → BeIN Sport 02
   */
  text =
    text
      .replace(
        /\b\d{3,4}\b/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  const isBein =
    /\bbein\b/.test(
      text
    );

  if (!isBein) {
    return {
      family:
        "unknown",

      number:
        null,

      text,

      isBein:
        false,
    };
  }

  if (
    /\bbein\s*(sport)?\s*4k\b/.test(
      text
    ) ||
    /\bbein\s*4k\b/.test(
      text
    )
  ) {
    return {
      family:
        "4k",

      number:
        null,

      text,

      isBein:
        true,
    };
  }

  let match =
    /\bbein\s+sport\s+fr\s*0*(\d+)\b/.exec(
      text
    );

  if (!match) {
    match =
      /\bbein\s+sport\s*0*(\d+)\s+fr\b/.exec(
        text
      );
  }

  if (match) {
    return {
      family:
        "fr",

      number:
        normalizeChannelNumber(
          match[1]
        ),

      text,

      isBein:
        true,
    };
  }

  match =
    /\bbein\s+sport\s+en\s*0*(\d+)\b/.exec(
      text
    );

  if (!match) {
    match =
      /\bbein\s+sport\s*0*(\d+)\s+en\b/.exec(
        text
      );
  }

  if (match) {
    return {
      family:
        "en",

      number:
        normalizeChannelNumber(
          match[1]
        ),

      text,

      isBein:
        true,
    };
  }

  match =
    /\bbein\s+sport\s+max\s*0*(\d+)\b/.exec(
      text
    );

  if (!match) {
    match =
      /\bbein\s+max\s*0*(\d+)\b/.exec(
        text
      );
  }

  if (match) {
    return {
      family:
        "max",

      number:
        normalizeChannelNumber(
          match[1]
        ),

      text,

      isBein:
        true,
    };
  }

  match =
    /\bbein\s+sport\s+xtra\s*0*(\d+)\b/.exec(
      text
    );

  if (!match) {
    match =
      /\bbein\s+xtra\s*0*(\d+)\b/.exec(
        text
      );
  }

  if (match) {
    return {
      family:
        "xtra",

      number:
        normalizeChannelNumber(
          match[1]
        ),

      text,

      isBein:
        true,
    };
  }

  /*
   * BeIN Sport 02
   * BeIN Sports 2
   * BeIN 2
   */
  match =
    /\bbein\s+(?:sport\s+)?0*(\d+)\b/.exec(
      text
    );

  if (match) {
    return {
      family:
        "main",

      number:
        normalizeChannelNumber(
          match[1]
        ),

      text,

      isBein:
        true,
    };
  }

  return {
    family:
      "unknown",

    number:
      null,

    text,

    isBein:
      true,
  };
}

/* =========================================================
   LANGUAGE
   ========================================================= */

function looksFrench(
  text: string
) {
  return (
    /\bfr\b/.test(
      text
    ) ||
    /\bfrench\b/.test(
      text
    ) ||
    /\bfrance\b/.test(
      text
    )
  );
}

function looksEnglish(
  text: string
) {
  return (
    /\ben\b/.test(
      text
    ) ||
    /\benglish\b/.test(
      text
    )
  );
}

function looksArabic(
  text: string
) {
  return (
    /\bar\b/.test(
      text
    ) ||
    /\barab\b/.test(
      text
    ) ||
    /\barabic\b/.test(
      text
    ) ||
    /\bmena\b/.test(
      text
    )
  );
}

/* =========================================================
   GUIDE CHANNEL ↔ XTREAM
   ========================================================= */

export function channelMatchScore(
  guideChannel:
    string,

  xtreamChannel:
    LiveChannel,

  region:
    BeinRegion,

  categoryName = ""
) {
  const guide =
    channelSignature(
      guideChannel
    );

  const xtream =
    channelSignature(
      xtreamChannel.name
    );

  if (
    !guide.isBein ||
    !xtream.isBein
  ) {
    return 0;
  }

  const xtreamText =
    normalizeGuideText(
      xtreamChannel.name
    );

  const category =
    normalizeGuideText(
      categoryName
    );

  let score = 0;

  /*
   * Numéro strict.
   */
  if (
    guide.number &&
    xtream.number
  ) {
    if (
      guide.number ===
      xtream.number
    ) {
      score += 130;
    } else {
      return 0;
    }
  }

  /*
   * Famille exacte.
   */
  if (
    guide.family ===
    xtream.family
  ) {
    score += 90;
  }

  /*
   * FR/EN ↔ MAIN autorisé
   * uniquement si le numéro est identique.
   */
  if (
    guide.number &&
    xtream.number &&
    guide.number ===
      xtream.number
  ) {
    const compatible =
      (
        guide.family ===
          "fr" &&
        xtream.family ===
          "main"
      ) ||
      (
        guide.family ===
          "main" &&
        xtream.family ===
          "fr"
      ) ||
      (
        guide.family ===
          "en" &&
        xtream.family ===
          "main"
      ) ||
      (
        guide.family ===
          "main" &&
        xtream.family ===
          "en"
      );

    if (compatible) {
      score += 45;
    }
  }

  /*
   * MAX/XTRA strict.
   */
  if (
    (
      guide.family ===
        "max" ||
      guide.family ===
        "xtra"
    ) &&
    guide.family !==
      xtream.family
  ) {
    score -= 100;
  }

  if (
    (
      xtream.family ===
        "max" ||
      xtream.family ===
        "xtra"
    ) &&
    guide.family !==
      xtream.family
  ) {
    score -= 100;
  }

  /*
   * 4K strict.
   */
  if (
    guide.family ===
      "4k" ||
    xtream.family ===
      "4k"
  ) {
    if (
      guide.family ===
      xtream.family
    ) {
      score += 140;
    } else {
      return 0;
    }
  }

  if (
    guide.text ===
    xtream.text
  ) {
    score += 100;
  }

  if (
    guide.text &&
    xtream.text &&
    (
      xtream.text.includes(
        guide.text
      ) ||
      guide.text.includes(
        xtream.text
      )
    )
  ) {
    score += 35;
  }

  const combined =
    `${xtreamText} ${category}`;

  if (
    guide.family ===
    "fr"
  ) {
    if (
      looksFrench(
        combined
      )
    ) {
      score += 40;
    }

    if (
      looksEnglish(
        combined
      )
    ) {
      score -= 25;
    }
  }

  if (
    guide.family ===
    "en"
  ) {
    if (
      looksEnglish(
        combined
      )
    ) {
      score += 40;
    }

    if (
      looksFrench(
        combined
      )
    ) {
      score -= 25;
    }
  }

  if (
    region === "mena" &&
    looksArabic(
      combined
    )
  ) {
    score += 20;
  }

  return Math.max(
    0,
    score
  );
}

/* =========================================================
   PROGRAMME → XTREAM
   ========================================================= */

export function findXtreamChannelsForProgramme(
  programme:
    BeinProgramme,

  channels:
    LiveChannel[],

  categoryName = ""
) {
  const matches =
    channels
      .map(
        (channel) => ({
          channel,

          score:
            channelMatchScore(
              programme.channel,
              channel,
              programme.region,
              categoryName
            ),
        })
      )
      .filter(
        (item) =>
          item.score >= 120
      )
      .sort(
        (a, b) =>
          b.score -
          a.score
      );

  if (
    !matches.length
  ) {
    return [];
  }

  const bestScore =
    matches[0].score;

  return matches
    .filter(
      (item) =>
        item.score >=
        bestScore - 45
    )
    .slice(
      0,
      8
    )
    .map(
      (item) =>
        item.channel
    );
}