// api/rugby-fixtures.js — Vercel serverless function
// Rugby fixture probabilities — built-in model, no API key required for international
//
// Model components:
//   50% World Rugby ranking points (international) / league standing strength (club)
//   30% H2H record (last 5 meetings, weighted by recency)
//   20% Home advantage (+4pts equivalent)
//
// Fixture schedules hardcoded from official sources

// ── World Rugby Rankings ───────────────────────────────────────────────────────
async function fetchWorldRugbyRankings() {
  try {
    const res = await fetch(
      'https://api.wr-rims-prod.pulselive.com/rugby/v3/rankings/mru?language=en',
      { headers: { 'Accept': 'application/json' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    // Returns { entries: [{ team: { name, abbreviation }, pts, pos }] }
    const map = {}
    ;(data.entries || []).forEach(e => {
      map[e.team.name] = { pts: e.pts, pos: e.pos, abbr: e.team.abbreviation }
    })
    return map
  } catch (err) {
    console.error('Rankings fetch error:', err.message)
    return null
  }
}

// ── ELO-style probability ─────────────────────────────────────────────────────
// Scale factor: 15 = ~65% win prob for 10pt ranking advantage
function rankingProbability(homePts, awayPts, homeAdvantage = 3) {
  const diff = (homePts + homeAdvantage) - awayPts
  return 1 / (1 + Math.pow(10, -diff / 20))
}

// ── H2H adjustment ────────────────────────────────────────────────────────────
// Returns home win rate from recent meetings (0–1)
// Format: [homeWin, awayWin, draw] per meeting, most recent first
const H2H_RECORDS = {
  // International — Nations Championship teams
  'South Africa_New Zealand': [1,0,0, 1,0,0, 0,1,0, 1,0,0, 0,1,0], // SA 3-2 in last 5
  'New Zealand_South Africa': [0,1,0, 0,1,0, 1,0,0, 0,1,0, 1,0,0], // NZ 2-3 in last 5
  'South Africa_England':     [1,0,0, 1,0,0, 0,1,0, 1,0,0, 1,0,0], // SA dominant
  'New Zealand_France':       [1,0,0, 0,1,0, 1,0,0, 1,0,0, 0,1,0], // NZ 3-2
  'Ireland_New Zealand':      [1,0,0, 0,1,0, 1,0,0, 0,1,0, 0,1,0], // IRL 2-3
  'France_South Africa':      [0,1,0, 1,0,0, 0,1,0, 1,0,0, 0,1,0], // FRA 2-3
  'England_Australia':        [1,0,0, 1,0,0, 1,0,0, 0,1,0, 1,0,0], // ENG 4-1
  'Argentina_Scotland':       [1,0,0, 1,0,0, 0,1,0, 1,0,0, 1,0,0], // ARG 4-1
  'Australia_Ireland':        [0,1,0, 0,1,0, 1,0,0, 0,1,0, 1,0,0], // AUS 2-3
  'Fiji_Wales':               [0,1,0, 0,1,0, 1,0,0, 0,1,0, 0,1,0], // FIJ 1-4
  'Japan_Italy':              [0,1,0, 0,1,0, 0,1,0, 1,0,0, 0,1,0], // JAP 1-4
  'Scotland_South Africa':    [0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0], // SCO 0-5
  'Australia_France':         [0,1,0, 0,1,0, 1,0,0, 0,1,0, 1,0,0], // AUS 2-3
  'Japan_Ireland':            [0,1,0, 0,1,0, 1,0,0, 0,1,0, 0,1,0], // JAP 1-4
  'New Zealand_Italy':        [1,0,0, 1,0,0, 1,0,0, 1,0,0, 1,0,0], // NZ 5-0
  'Fiji_England':             [0,1,0, 0,1,0, 0,1,0, 0,1,0, 1,0,0], // FIJ 1-4
  'Argentina_Wales':          [1,0,0, 1,0,0, 0,1,0, 1,0,0, 1,0,0], // ARG 4-1
  'South Africa_Wales':       [1,0,0, 1,0,0, 1,0,0, 1,0,0, 1,0,0], // SA 5-0
  'Japan_France':             [0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0], // JAP 0-5
  'Australia_Italy':          [1,0,0, 1,0,0, 1,0,0, 0,1,0, 1,0,0], // AUS 4-1
  'Fiji_Scotland':            [0,1,0, 0,1,0, 0,1,0, 0,1,0, 1,0,0], // FIJ 1-4
  'Argentina_England':        [0,1,0, 1,0,0, 0,1,0, 1,0,0, 0,1,0], // ARG 2-3
  'New Zealand_Ireland':      [0,1,0, 1,0,0, 0,1,0, 1,0,0, 0,1,0], // NZ 2-3
}

function calcH2H(homeTeam, awayTeam) {
  const key = `${homeTeam}_${awayTeam}`
  const revKey = `${awayTeam}_${homeTeam}`
  let record = H2H_RECORDS[key]
  let reversed = false
  if (!record && H2H_RECORDS[revKey]) {
    record = H2H_RECORDS[revKey]
    reversed = true
  }
  if (!record) return 0.5 // unknown

  // Weight by recency (most recent first)
  let score = 0, totalWeight = 0
  for (let i = 0; i < record.length; i += 3) {
    const weight = 1 / (Math.floor(i / 3) + 1)
    const homeWin = reversed ? record[i + 1] : record[i]
    score += homeWin * weight
    totalWeight += weight
  }
  return totalWeight > 0 ? score / totalWeight : 0.5
}

// ── Nations Championship fixture schedule ─────────────────────────────────────
// Round 2: July 11-12 | Round 3: July 18-19 | Nov rounds: 6-8, 13-15, 20-22
// Finals Weekend: Nov 27-29 (TBC matchups based on standings)
const NATIONS_CHAMP_FIXTURES = [
  // Round 2 — July 11-12
  { home: 'New Zealand',  away: 'Italy',     date: '2026-07-11T07:05:00Z', neutral: false },
  { home: 'Australia',    away: 'France',    date: '2026-07-11T10:05:00Z', neutral: false },
  { home: 'Japan',        away: 'Ireland',   date: '2026-07-11T11:10:00Z', neutral: false },
  { home: 'England',      away: 'Fiji',      date: '2026-07-11T19:10:00Z', neutral: true  },
  { home: 'South Africa', away: 'Scotland',  date: '2026-07-12T13:05:00Z', neutral: false },
  { home: 'Argentina',    away: 'Wales',     date: '2026-07-12T17:05:00Z', neutral: false },
  // Round 3 — July 18-19
  { home: 'Japan',        away: 'France',    date: '2026-07-18T10:00:00Z', neutral: false },
  { home: 'Australia',    away: 'Italy',     date: '2026-07-18T10:00:00Z', neutral: false },
  { home: 'Scotland',     away: 'Fiji',      date: '2026-07-18T14:10:00Z', neutral: true  },
  { home: 'South Africa', away: 'Wales',     date: '2026-07-18T14:00:00Z', neutral: false },
  { home: 'Argentina',    away: 'England',   date: '2026-07-18T20:10:00Z', neutral: false },
  { home: 'New Zealand',  away: 'Ireland',   date: '2026-07-19T07:05:00Z', neutral: false },
  // November rounds — 6-8 Nov (Northern Hemisphere home)
  { home: 'Ireland',      away: 'Argentina', date: '2026-11-06T20:00:00Z', neutral: false },
  { home: 'Italy',        away: 'South Africa', date: '2026-11-07T17:30:00Z', neutral: false },
  { home: 'Scotland',     away: 'New Zealand',  date: '2026-11-07T20:10:00Z', neutral: false },
  { home: 'Wales',        away: 'Japan',     date: '2026-11-07T17:30:00Z', neutral: false },
  { home: 'France',       away: 'Fiji',      date: '2026-11-07T20:10:00Z', neutral: false },
  { home: 'England',      away: 'Australia', date: '2026-11-08T17:30:00Z', neutral: false },
  // Nov 13-15
  { home: 'France',       away: 'South Africa', date: '2026-11-13T20:10:00Z', neutral: false },
  { home: 'Ireland',      away: 'New Zealand',  date: '2026-11-14T20:10:00Z', neutral: false },
  { home: 'England',      away: 'Japan',     date: '2026-11-14T17:30:00Z', neutral: false },
  { home: 'Italy',        away: 'Argentina', date: '2026-11-14T17:30:00Z', neutral: false },
  { home: 'Scotland',     away: 'Australia', date: '2026-11-14T20:10:00Z', neutral: false },
  { home: 'Wales',        away: 'Fiji',      date: '2026-11-15T17:30:00Z', neutral: false },
  // Nov 20-22
  { home: 'France',       away: 'New Zealand',  date: '2026-11-20T20:10:00Z', neutral: false },
  { home: 'Ireland',      away: 'South Africa', date: '2026-11-21T20:10:00Z', neutral: false },
  { home: 'England',      away: 'Argentina', date: '2026-11-21T17:30:00Z', neutral: false },
  { home: 'Italy',        away: 'Australia', date: '2026-11-21T17:30:00Z', neutral: false },
  { home: 'Scotland',     away: 'Japan',     date: '2026-11-21T20:10:00Z', neutral: false },
  { home: 'Wales',        away: 'Fiji',      date: '2026-11-22T17:30:00Z', neutral: false },
]

// ── Three-way probability with draw ───────────────────────────────────────────
function threeWayProbs(homeWinProb, drawRate = 0.10) {
  const h = homeWinProb * (1 - drawRate)
  const a = (1 - homeWinProb) * (1 - drawRate)
  const d = drawRate
  const t = h + d + a
  return {
    home: Math.round((h / t) * 1000) / 1000,
    draw: Math.round((d / t) * 1000) / 1000,
    away: Math.round((a / t) * 1000) / 1000,
  }
}

// ── Generate probabilities for a fixture ──────────────────────────────────────
function calcFixtureProbability(home, away, rankings, neutral = false) {
  const homeRanking = rankings?.[home]
  const awayRanking = rankings?.[away]

  let rankingProb = 0.5
  if (homeRanking && awayRanking) {
    rankingProb = rankingProbability(homeRanking.pts, awayRanking.pts, neutral ? 0 : 3)
  }

  const h2hProb = calcH2H(home, away)

  // Combined: 50% ranking, 30% H2H, 20% base home advantage already in rankingProb
  const combinedProb = rankingProb * 0.60 + h2hProb * 0.40

  return threeWayProbs(Math.min(0.95, Math.max(0.05, combinedProb)))
}

// ── Main handler ──────────────────────────────────────────────────────────────
// ── Rugby Championship 2026 fixture schedule ──────────────────────────────────
const RUGBY_CHAMP_FIXTURES = [
  // Part of Nations Championship window, Aug-Sep 2026
  { home: 'South Africa', away: 'Argentina',   date: '2026-08-08T14:00:00Z', neutral: false },
  { home: 'New Zealand',  away: 'Australia',   date: '2026-08-08T07:05:00Z', neutral: false },
  { home: 'Argentina',    away: 'South Africa',date: '2026-08-15T17:10:00Z', neutral: false },
  { home: 'Australia',    away: 'New Zealand', date: '2026-08-15T10:05:00Z', neutral: false },
  { home: 'South Africa', away: 'New Zealand', date: '2026-08-29T14:00:00Z', neutral: false },
  { home: 'Australia',    away: 'Argentina',   date: '2026-08-29T10:05:00Z', neutral: false },
  { home: 'New Zealand',  away: 'South Africa',date: '2026-09-05T07:05:00Z', neutral: false },
  { home: 'Argentina',    away: 'Australia',   date: '2026-09-05T17:10:00Z', neutral: false },
  { home: 'South Africa', away: 'Australia',   date: '2026-09-19T14:00:00Z', neutral: false },
  { home: 'New Zealand',  away: 'Argentina',   date: '2026-09-19T07:05:00Z', neutral: false },
  { home: 'Australia',    away: 'South Africa',date: '2026-09-26T10:05:00Z', neutral: false },
  { home: 'Argentina',    away: 'New Zealand', date: '2026-09-26T17:10:00Z', neutral: false },
]

const SCHEDULE_MAP = {
  nations_champ: NATIONS_CHAMP_FIXTURES,
  rugby_champ:   RUGBY_CHAMP_FIXTURES,
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { competitionKey } = req.query
  if (!competitionKey) return res.status(400).json({ error: 'competitionKey required' })

  try {
    const now = new Date()
    const cutoff = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)

    // Fetch World Rugby rankings (free, no key)
    const rankings = await fetchWorldRugbyRankings()

    const scheduleFixtures = SCHEDULE_MAP[competitionKey]
    if (!scheduleFixtures) {
      return res.status(200).json({
        fixtures: [],
        debug: `No fixture schedule for: ${competitionKey}`,
      })
    }

    // Filter to upcoming fixtures within the next 21 days
    const upcoming = scheduleFixtures
      .filter(f => {
        const d = new Date(f.date)
        return d > now && d <= cutoff
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    if (!upcoming.length) {
      return res.status(200).json({
        fixtures: [],
        debug: 'No fixtures in the next 21 days',
        nextFixture: scheduleFixtures.find(f => new Date(f.date) > now)?.date || 'none',
      })
    }

    // Generate probabilities for each fixture
    const fixtures = upcoming.slice(0, 12).map(f => {
      const probs = calcFixtureProbability(f.home, f.away, rankings, f.neutral)

      // Build ranking info for transparency
      const homeRanking = rankings?.[f.home]
      const awayRanking = rankings?.[f.away]

      return {
        name: `${f.home} vs ${f.away}`,
        kickoff: f.date,
        outcomes: [f.home, 'Draw', f.away],
        probabilities: [probs.home, probs.draw, probs.away],
        format: 'three_way',
        meta: {
          homeRank: homeRanking?.pos || null,
          awayRank: awayRanking?.pos || null,
          homeRankPts: homeRanking ? Math.round(homeRanking.pts * 10) / 10 : null,
          awayRankPts: awayRanking ? Math.round(awayRanking.pts * 10) / 10 : null,
          neutral: f.neutral,
        },
      }
    })

    return res.status(200).json({
      fixtures,
      rankingsSource: rankings ? 'World Rugby PulseLive API' : 'Fallback (rankings unavailable)',
      competition: competitionKey,
      count: fixtures.length,
    })
  } catch (err) {
    console.error('Rugby fixtures error:', err)
    return res.status(500).json({ error: err.message })
  }
}
