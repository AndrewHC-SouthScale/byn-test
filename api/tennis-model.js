// api/tennis-model.js — Tennis probability model (no external API)
// Covers: Wimbledon (ATP + WTA combined), US Open, Australian Open, Roland Garros
//
// Model: ATP/WTA ranking points → surface-adjusted win probability
// Wimbledon: grass surface bonus applied to serve-dominant/grass specialists

// ── ATP Rankings (July 2026) ───────────────────────────────────────────────────
const ATP_RANKINGS = {
  'Jannik Sinner':        1,  'Carlos Alcaraz':    2,  'Novak Djokovic':   3,
  'Felix Auger-Aliassime':3,  'Alexander Zverev':  4,  'Daniil Medvedev':  5,
  'Holger Rune':          6,  'Andrey Rublev':     7,  'Casper Ruud':      8,
  'Taylor Fritz':         9,  'Stefanos Tsitsipas':10, 'Tommy Paul':       11,
  'Jan-Lennard Struff':   30, 'Arthur Fery':       80,
}

// ── WTA Rankings (July 2026) ───────────────────────────────────────────────────
const WTA_RANKINGS = {
  'Aryna Sabalenka':  1, 'Iga Swiatek':      2, 'Coco Gauff':       3,
  'Elena Rybakina':   4, 'Jessica Pegula':   5, 'Mirra Andreeva':   6,
  'Jasmine Paolini':  7, 'Naomi Osaka':      8, 'Karolina Muchova': 9,
  'Emma Navarro':    10, 'Marta Kostyuk':   11, 'Madison Keys':     12,
  'Paula Badosa':    13, 'Marketa Vondrousova': 14, 'Barbora Krejcikova': 15,
}

// Grass court specialists (Wimbledon bonus)
const GRASS_SPECIALISTS = new Set([
  'Novak Djokovic', 'Felix Auger-Aliassime', 'Carlos Alcaraz',
  'Elena Rybakina', 'Barbora Krejcikova', 'Marketa Vondrousova',
])

// ── Tournament schedules ───────────────────────────────────────────────────────
const TOURNAMENTS = {
  wimbledon_2026: {
    surface: 'grass',
    // Combined [M]/[W] — remaining matches as of July 9 2026
    fixtures: [
      // Women's Semi-finals — July 9
      { home: '[W] Coco Gauff',     away: '[W] Naomi Osaka',      date: '2026-07-09T11:00:00Z', gender: 'W' },
      { home: '[W] Marta Kostyuk',  away: '[W] Jasmine Paolini',  date: '2026-07-09T13:30:00Z', gender: 'W' },
      // Men's Semi-finals — July 10
      { home: '[M] Novak Djokovic', away: '[M] Jannik Sinner',    date: '2026-07-10T13:00:00Z', gender: 'M' },
      { home: '[M] Carlos Alcaraz', away: '[M] Felix Auger-Aliassime', date: '2026-07-10T15:30:00Z', gender: 'M' },
      // Women's Final — July 11
      { home: '[W] TBD SF1 winner', away: '[W] TBD SF2 winner',   date: '2026-07-11T14:00:00Z', gender: 'W', tbd: true },
      // Men's Final — July 12
      { home: '[M] TBD SF1 winner', away: '[M] TBD SF2 winner',   date: '2026-07-12T14:00:00Z', gender: 'M', tbd: true },
    ],
  },
  us_open_2026: {
    surface: 'hard',
    fixtures: [
      // Placeholder — update with actual draw when available (late Aug)
      { home: '[M] TBD', away: '[M] TBD', date: '2026-08-31T17:00:00Z', gender: 'M', tbd: true },
    ],
  },
}

// Map BYN competition key to tournament
const COMP_TOURNAMENT = {
  tennis: 'wimbledon_2026',
}

function rankPos(player, rankings) {
  return rankings[player] ?? 50
}

function tennisMatchProb(p1Name, p2Name, surface = 'hard') {
  const allRankings = { ...ATP_RANKINGS, ...WTA_RANKINGS }
  const r1Raw = rankPos(p1Name, allRankings)
  const r2Raw = rankPos(p2Name, allRankings)

  // Convert rank to rating (higher rank = lower number = better)
  // Rating formula: 1000 / rank → rank 1 = 1000, rank 10 = 100, rank 50 = 20
  let r1 = 1000 / r1Raw
  let r2 = 1000 / r2Raw

  // Grass surface bonus for specialists
  if (surface === 'grass') {
    if (GRASS_SPECIALISTS.has(p1Name)) r1 *= 1.15
    if (GRASS_SPECIALISTS.has(p2Name)) r2 *= 1.15
  }

  return r1 / (r1 + r2)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { competitionKey } = req.query
  if (!competitionKey) return res.status(400).json({ error: 'competitionKey required' })

  const tournamentKey = COMP_TOURNAMENT[competitionKey]
  if (!tournamentKey) return res.status(200).json({ fixtures: [], debug: `No tournament mapping for ${competitionKey}` })

  const tournament = TOURNAMENTS[tournamentKey]
  const now = new Date()
  const cutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days for tennis

  const upcoming = (tournament.fixtures || [])
    .filter(f => {
      if (f.tbd) return false // skip TBD finals until we know the players
      const d = new Date(f.date)
      return d > now && d <= cutoff
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  if (!upcoming.length) {
    // If no upcoming non-TBD matches, show TBD finals
    const upcomingFinals = (tournament.fixtures || [])
      .filter(f => f.tbd && new Date(f.date) > now)
    if (upcomingFinals.length) {
      return res.status(200).json({
        fixtures: [],
        debug: 'Finals TBD — semi-final results needed',
        nextFixture: upcomingFinals[0].date,
        upcomingFinals: upcomingFinals.map(f => ({ date: f.date, stage: 'Final' })),
      })
    }
    return res.status(200).json({
      fixtures: [],
      debug: 'Tournament complete or no upcoming matches',
      nextFixture: null,
    })
  }

  const fixtures = upcoming.map(f => {
    // Strip [M]/[W] prefix for player lookup
    const p1 = f.home.replace(/^\[.\] /, '')
    const p2 = f.away.replace(/^\[.\] /, '')

    const winProb = tennisMatchProb(p1, p2, tournament.surface)
    const probs = [
      Math.round(winProb * 1000) / 1000,
      0,
      Math.round((1 - winProb) * 1000) / 1000,
    ]

    return {
      name: `${f.home} vs ${f.away}`,
      kickoff: f.date,
      outcomes: [f.home, f.away],
      probabilities: probs,
      format: 'three_way_no_draw',
      meta: {
        surface: tournament.surface,
        gender: f.gender,
        p1Rank: rankPos(p1, { ...ATP_RANKINGS, ...WTA_RANKINGS }),
        p2Rank: rankPos(p2, { ...ATP_RANKINGS, ...WTA_RANKINGS }),
      },
    }
  })

  return res.status(200).json({ fixtures, tournament: tournamentKey, count: fixtures.length })
}
