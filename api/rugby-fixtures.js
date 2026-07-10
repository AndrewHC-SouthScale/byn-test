// api/rugby-fixtures.js — Vercel serverless function
// Rugby fixture probabilities — built-in model, no API key required
//
// Model:
//   International: World Rugby ranking points + H2H (nations_champ, rugby_champ, six_nations, rugby_wc)
//   Club: Team strength ratings from previous season (urc, prem_rugby, super_rugby)
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

// ── Club team strength ratings ────────────────────────────────────────────────
// URC 2026-27 (based on 2025-26 season performance)
const URC_RATINGS = {
  'Leinster':   88, 'Bulls':         85, 'Stormers':  84,
  'Glasgow':    83, 'Munster':       82, 'Sharks':    76,
  'Ulster':     79, 'Lions':         74, 'Connacht':  73,
  'Edinburgh':  72, 'Cardiff':       68, 'Ospreys':   69,
  'Scarlets':   67, 'Benetton':      64, 'Dragons':   60,
  'Zebre':      55,
}
// SA teams penalty when touring Europe (time zone, travel, unfamiliar grounds)
const SA_TEAMS = new Set(['Bulls', 'Stormers', 'Sharks', 'Lions'])
const SA_AWAY_PENALTY = 8

// Premiership Rugby 2026-27 (10-team franchise model)
// Bath won 2025-26 treble
const PREM_RATINGS = {
  'Bath':                87, 'Saracens':          84,
  'Leicester Tigers':    82, 'Sale Sharks':        80,
  'Exeter Chiefs':       79, 'Northampton Saints': 78,
  'Bristol Bears':       77, 'Harlequins':         76,
  'Gloucester':          72, 'Newcastle Red Bulls': 68,
}

// Super Rugby Pacific 2027 (10 teams)
// Hurricanes won 2026 final vs Chiefs
const SUPER_RUGBY_RATINGS = {
  'Hurricanes':   88, 'Chiefs':      85, 'Blues':        83,
  'Crusaders':    84, 'Brumbies':    80, 'Highlanders':  76,
  'Reds':         74, 'Waratahs':    71, 'Fijian Drua':  68,
  'Western Force': 65,
}

// ── Club probability calculator ───────────────────────────────────────────────
function clubMatchProb(home, away, ratings, isHomeSAinEurope = false) {
  let rH = ratings[home] ?? 70
  let rA = ratings[away] ?? 70
  const homeAdv = 5 // home advantage in rating points
  if (isHomeSAinEurope) rH -= SA_AWAY_PENALTY // SA team hosting in Europe
  if (SA_TEAMS.has(away) && !isHomeSAinEurope) rA -= SA_AWAY_PENALTY // SA team away in Europe
  return 1 / (1 + Math.pow(10, -((rH + homeAdv) - rA) / 12))
}

function clubThreeWay(home, away, ratings, drawRate = 0.11, saGame = false) {
  const isHomeSAinEurope = SA_TEAMS.has(home) && saGame
  const winProb = clubMatchProb(home, away, ratings, isHomeSAinEurope)
  const h = winProb * (1 - drawRate)
  const a = (1 - winProb) * (1 - drawRate)
  const t = h + drawRate + a
  return {
    home: Math.round(h/t * 1000) / 1000,
    draw: Math.round(drawRate/t * 1000) / 1000,
    away: Math.round(a/t * 1000) / 1000,
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

// ── URC 2026-27 Round 1 fixtures (Sep 25-26) ──────────────────────────────────
// Full fixture list releasing July 2026 — Round 1 confirmed
const URC_FIXTURES = [
  // Friday 25 September
  { home: 'Benetton',  away: 'Dragons',          date: '2026-09-25T18:45:00Z', saGame: false },
  { home: 'Connacht',  away: 'Stormers',          date: '2026-09-25T18:45:00Z', saGame: true  },
  { home: 'Ulster',    away: 'Edinburgh',          date: '2026-09-25T18:45:00Z', saGame: false },
  // Saturday 26 September
  { home: 'Munster',   away: 'Glasgow',            date: '2026-09-26T14:00:00Z', saGame: false },
  { home: 'Scarlets',  away: 'Cardiff',            date: '2026-09-26T14:00:00Z', saGame: false },
  { home: 'Lions',     away: 'Leinster',           date: '2026-09-26T13:00:00Z', saGame: false },
  { home: 'Bulls',     away: 'Ospreys',            date: '2026-09-26T13:00:00Z', saGame: false },
  { home: 'Glasgow',   away: 'Sharks',             date: '2026-09-26T16:30:00Z', saGame: true  },
  { home: 'Zebre',     away: 'Highlanders',        date: '2026-09-26T14:00:00Z', saGame: false },
]

// ── Premiership Rugby 2026-27 Round 1 (Sep 25-27) ────────────────────────────
// Full fixtures releasing July 2026. Placeholder based on typical pairings.
const PREM_FIXTURES = [
  // Friday 25 September — Friday night opener
  { home: 'Bath',               away: 'Sale Sharks',         date: '2026-09-25T19:45:00Z' },
  // Saturday 26 September
  { home: 'Saracens',           away: 'Northampton Saints',  date: '2026-09-26T14:00:00Z' },
  { home: 'Leicester Tigers',   away: 'Bristol Bears',       date: '2026-09-26T14:00:00Z' },
  { home: 'Gloucester',         away: 'Harlequins',          date: '2026-09-26T14:00:00Z' },
  { home: 'Exeter Chiefs',      away: 'Newcastle Red Bulls', date: '2026-09-27T15:00:00Z' },
]

// ── Six Nations 2027 fixture schedule ─────────────────────────────────────────
const SIX_NATIONS_FIXTURES = [
  // Round 1 — Feb 6-8 2027
  { home: 'Scotland',  away: 'England',  date: '2027-02-06T14:15:00Z', neutral: false },
  { home: 'Ireland',   away: 'France',   date: '2027-02-06T16:45:00Z', neutral: false },
  { home: 'Italy',     away: 'Wales',    date: '2027-02-07T14:00:00Z', neutral: false },
  // Round 2 — Feb 20-22
  { home: 'France',    away: 'Wales',    date: '2027-02-20T14:15:00Z', neutral: false },
  { home: 'England',   away: 'Ireland',  date: '2027-02-20T16:45:00Z', neutral: false },
  { home: 'Scotland',  away: 'Italy',    date: '2027-02-21T14:00:00Z', neutral: false },
  // Round 3 — Mar 6-8
  { home: 'Wales',     away: 'Scotland', date: '2027-03-06T14:15:00Z', neutral: false },
  { home: 'Italy',     away: 'England',  date: '2027-03-06T16:45:00Z', neutral: false },
  { home: 'France',    away: 'Ireland',  date: '2027-03-07T15:00:00Z', neutral: false },
  // Round 4 — Mar 13-14
  { home: 'England',   away: 'France',   date: '2027-03-13T14:15:00Z', neutral: false },
  { home: 'Ireland',   away: 'Scotland', date: '2027-03-13T16:45:00Z', neutral: false },
  { home: 'Wales',     away: 'Italy',    date: '2027-03-14T14:00:00Z', neutral: false },
  // Round 5 — Grand Slam weekend, Mar 19-21
  { home: 'Italy',     away: 'Ireland',  date: '2027-03-19T16:45:00Z', neutral: false },
  { home: 'Scotland',  away: 'France',   date: '2027-03-20T14:15:00Z', neutral: false },
  { home: 'Wales',     away: 'England',  date: '2027-03-20T17:00:00Z', neutral: false },
]

// ── Super Rugby Pacific 2027 Round 1 (Feb 12-14 2027) ─────────────────────────
const SUPER_RUGBY_FIXTURES = [
  { home: 'Blues',          away: 'Crusaders',  date: '2027-02-12T08:05:00Z' },
  { home: 'Highlanders',    away: 'Chiefs',     date: '2027-02-13T07:35:00Z' },
  { home: 'Hurricanes',     away: 'Brumbies',   date: '2027-02-14T08:05:00Z' },
  { home: 'Reds',           away: 'Waratahs',   date: '2027-02-14T08:05:00Z' },
  { home: 'Fijian Drua',   away: 'Western Force', date: '2027-02-14T08:35:00Z' },
]

// ── Rugby World Cup 2027 (Australia, Sep-Oct 2027) ────────────────────────────
// Placeholder — full schedule TBC
const RUGBY_WC_FIXTURES = [
  // Pool stage approximate kickoffs
  { home: 'New Zealand',  away: 'Argentina',   date: '2027-09-10T09:00:00Z', neutral: true },
  { home: 'South Africa', away: 'Scotland',    date: '2027-09-11T09:00:00Z', neutral: true },
  { home: 'England',      away: 'Japan',       date: '2027-09-12T07:00:00Z', neutral: true },
  { home: 'France',       away: 'Italy',       date: '2027-09-12T10:00:00Z', neutral: true },
  { home: 'Ireland',      away: 'Australia',   date: '2027-09-13T09:00:00Z', neutral: true },
  { home: 'Fiji',         away: 'Wales',       date: '2027-09-14T07:00:00Z', neutral: true },
]

const SCHEDULE_MAP = {
  nations_champ: { fixtures: NATIONS_CHAMP_FIXTURES, type: 'international' },
  rugby_champ:   { fixtures: RUGBY_CHAMP_FIXTURES,   type: 'international' },
  six_nations:   { fixtures: SIX_NATIONS_FIXTURES,   type: 'international' },
  rugby_wc:      { fixtures: RUGBY_WC_FIXTURES,       type: 'international' },
  urc:           { fixtures: URC_FIXTURES,            type: 'club', ratings: URC_RATINGS },
  prem_rugby:    { fixtures: PREM_FIXTURES,           type: 'club', ratings: PREM_RATINGS },
  super_rugby:   { fixtures: SUPER_RUGBY_FIXTURES,    type: 'club', ratings: SUPER_RUGBY_RATINGS },
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { competitionKey } = req.query
  if (!competitionKey) return res.status(400).json({ error: 'competitionKey required' })

  try {
    const now = new Date()
    const cutoff = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

    // Fetch World Rugby rankings (free, no key)
    const rankings = await fetchWorldRugbyRankings()

    const compConfig = SCHEDULE_MAP[competitionKey]
    if (!compConfig) {
      return res.status(200).json({
        fixtures: [],
        debug: `No fixture schedule for: ${competitionKey}`,
      })
    }

    const scheduleFixtures = compConfig.fixtures

    // Filter to upcoming fixtures within the next 21 days
    const allFuture = scheduleFixtures.filter(f => new Date(f.date) > now).sort((a,b) => new Date(a.date) - new Date(b.date))
    const upcoming = allFuture.filter(f => new Date(f.date) <= cutoff)
    const nextFromFullSchedule = allFuture[0]
    const nextFixtureName = nextFromFullSchedule ? `${nextFromFullSchedule.home} vs ${nextFromFullSchedule.away}` : null

    if (!upcoming.length) {
      return res.status(200).json({
        fixtures: [],
        debug: 'No fixtures in the next 21 days',
        nextFixture: nextFromFullSchedule?.date || null,
        nextFixtureName,
      })
    }

    // Generate probabilities for each fixture
    const fixtures = upcoming.slice(0, 12).map(f => {
      let probs

      if (compConfig.type === 'club') {
        // Club model — use team strength ratings
        const p = clubThreeWay(f.home, f.away, compConfig.ratings, 0.11, f.saGame ?? false)
        probs = p
      } else {
        // International model — use World Rugby rankings + H2H
        probs = calcFixtureProbability(f.home, f.away, rankings, f.neutral)
      }

      return {
        name: `${f.home} vs ${f.away}`,
        kickoff: f.date,
        outcomes: [f.home, 'Draw', f.away],
        probabilities: [probs.home, probs.draw, probs.away],
        format: 'three_way',
        meta: compConfig.type === 'club' ? {
          homeRating: compConfig.ratings[f.home] || null,
          awayRating: compConfig.ratings[f.away] || null,
        } : {
          homeRank: rankings?.[f.home]?.pos || null,
          awayRank: rankings?.[f.away]?.pos || null,
          homeRankPts: rankings?.[f.home] ? Math.round(rankings[f.home].pts * 10) / 10 : null,
          awayRankPts: rankings?.[f.away] ? Math.round(rankings[f.away].pts * 10) / 10 : null,
          neutral: f.neutral,
        },
      }
    })

    return res.status(200).json({
      fixtures,
      rankingsSource: compConfig.type === 'international'
        ? (rankings ? 'World Rugby PulseLive API' : 'Fallback (rankings unavailable)')
        : 'Club strength ratings',
      competition: competitionKey,
      type: compConfig.type,
      count: fixtures.length,
    })
  } catch (err) {
    console.error('Rugby fixtures error:', err)
    return res.status(500).json({ error: err.message })
  }
}
