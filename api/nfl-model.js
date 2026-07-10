// api/nfl-model.js — NFL probability model (no external API)
// Uses team power ratings based on 2025 season + offseason changes
// Home advantage: NFL home field is significant (~57% win rate)

// ── NFL team power ratings (2025 season + 2026 offseason) ─────────────────────
const NFL_RATINGS = {
  // AFC
  'Kansas City Chiefs':      96, 'Buffalo Bills':        93,
  'Baltimore Ravens':        91, 'Cincinnati Bengals':   87,
  'Los Angeles Chargers':    85, 'Miami Dolphins':       83,
  'Pittsburgh Steelers':     81, 'Houston Texans':       82,
  'Jacksonville Jaguars':    76, 'Cleveland Browns':     74,
  'New York Jets':           72, 'Tennessee Titans':     70,
  'Indianapolis Colts':      71, 'Denver Broncos':       73,
  'Las Vegas Raiders':       68, 'New England Patriots': 66,
  // NFC
  'San Francisco 49ers':     95, 'Philadelphia Eagles':  92,
  'Dallas Cowboys':          89, 'Detroit Lions':        90,
  'New Orleans Saints':      84, 'Tampa Bay Buccaneers': 83,
  'Los Angeles Rams':        86, 'Seattle Seahawks':     80,
  'Minnesota Vikings':       82, 'Green Bay Packers':    85,
  'Washington Commanders':   79, 'New York Giants':      71,
  'Chicago Bears':           75, 'Atlanta Falcons':      77,
  'Carolina Panthers':       65, 'Arizona Cardinals':    67,
}

// ── Week 1 2026 fixtures (approx — exact schedule TBC) ────────────────────────
// NFL 2026 season opens first Thursday Sep 4 2026
const NFL_FIXTURES = [
  // Opening week (Sep 4-8 2026) — placeholder matchups
  { home: 'Kansas City Chiefs',   away: 'Baltimore Ravens',     date: '2026-09-04T00:20:00Z' },
  { home: 'Philadelphia Eagles',  away: 'Dallas Cowboys',       date: '2026-09-06T17:00:00Z' },
  { home: 'San Francisco 49ers',  away: 'Detroit Lions',        date: '2026-09-06T20:25:00Z' },
  { home: 'Buffalo Bills',        away: 'Los Angeles Chargers', date: '2026-09-07T17:00:00Z' },
  { home: 'Green Bay Packers',    away: 'Chicago Bears',        date: '2026-09-07T17:00:00Z' },
  { home: 'Minnesota Vikings',    away: 'New York Giants',      date: '2026-09-07T20:25:00Z' },
  { home: 'Los Angeles Rams',     away: 'Seattle Seahawks',     date: '2026-09-07T20:25:00Z' },
  { home: 'Cincinnati Bengals',   away: 'Pittsburgh Steelers',  date: '2026-09-08T17:00:00Z' },
  { home: 'Houston Texans',       away: 'Miami Dolphins',       date: '2026-09-08T20:15:00Z' },
]

function nflWinProb(home, away) {
  const rH = NFL_RATINGS[home] ?? 75
  const rA = NFL_RATINGS[away] ?? 75
  const homeAdv = 3.5 // NFL home field ~3.5 rating points
  return 1 / (1 + Math.pow(10, -((rH + homeAdv) - rA) / 12))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { competitionKey } = req.query
  if (competitionKey !== 'nfl') return res.status(200).json({ fixtures: [], debug: 'competitionKey must be nfl' })

  const now = new Date()
  const cutoff = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)

  const upcoming = NFL_FIXTURES
    .filter(f => { const d = new Date(f.date); return d > now && d <= cutoff })
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  if (!upcoming.length) {
    return res.status(200).json({
      fixtures: [],
      debug: 'No NFL fixtures in next 21 days',
      nextFixture: '2026-09-04T00:20:00Z',
      seasonOpens: '2026-09-04',
    })
  }

  const fixtures = upcoming.map(f => {
    const winProb = nflWinProb(f.home, f.away)
    return {
      name: `${f.home} vs ${f.away}`,
      kickoff: f.date,
      outcomes: [f.home, f.away],
      probabilities: [
        Math.round(winProb * 1000) / 1000,
        0,
        Math.round((1 - winProb) * 1000) / 1000,
      ],
      format: 'three_way_no_draw',
      meta: {
        homeRating: NFL_RATINGS[f.home] || null,
        awayRating: NFL_RATINGS[f.away] || null,
      },
    }
  })

  return res.status(200).json({ fixtures, competition: 'NFL 2026', count: fixtures.length })
}
