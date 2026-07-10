// api/football-model.js — Football probability model (no external API)
// Covers: FIFA WC, Euros, Premier League, La Liga, Champions League
//
// Model:
//   International: FIFA ranking points → ELO-style probability + H2H adjustment
//   Club: Team strength rating (previous season + transfers) + home advantage

// ── FIFA Rankings (July 2026) ──────────────────────────────────────────────────
const FIFA = {
  'Argentina':    1872, 'Spain':       1841, 'France':      1812,
  'England':      1778, 'Belgium':     1761, 'Portugal':    1744,
  'Morocco':      1698, 'Netherlands': 1682, 'Brazil':      1671,
  'Germany':      1652, 'Italy':       1641, 'Croatia':     1624,
  'Uruguay':      1598, 'Norway':      1580, 'Switzerland': 1543,
  'Colombia':     1521, 'USA':         1512, 'Mexico':      1498,
  'Japan':        1503, 'Senegal':     1462, 'Denmark':     1451,
  'Austria':      1439, 'Australia':   1445, 'Iran':        1421,
  'South Korea':  1412, 'Canada':      1398, 'Ecuador':     1375,
  'Tunisia':      1352, 'Qatar':       1341, 'Saudi Arabia':1331,
}

// ── EPL 2026-27 team strength ratings ─────────────────────────────────────────
// Based on 2025-26 final standings + summer transfers
// Scale: 100 = strongest, lower = weaker
const EPL_RATINGS = {
  'Arsenal':          96, 'Man City':       95, 'Liverpool':     94,
  'Chelsea':          90, 'Newcastle':      87, 'Brighton':      85,
  'Aston Villa':      84, 'Tottenham':      83, 'Nottm Forest':  79,
  'Brentford':        76, 'Fulham':         75, 'Man United':    78,
  'Everton':          71, 'Crystal Palace': 70, 'Bournemouth':   69,
  'Ipswich Town':     65, 'Leeds United':   64, 'Sunderland':    63,
  'Coventry City':    62, 'Hull City':      60,
}

// ── La Liga 2026-27 team strength ratings ──────────────────────────────────────
const LALIGA_RATINGS = {
  'Real Madrid':     97, 'Barcelona':      95, 'Atletico Madrid': 89,
  'Athletic Club':   83, 'Real Sociedad':  82, 'Villarreal':      81,
  'Real Betis':      79, 'Sevilla':        77, 'Celta Vigo':      74,
  'Osasuna':         71, 'Getafe':         70, 'Valencia':        69,
  'Espanyol':        68, 'Rayo Vallecano': 67, 'Leganes':         65,
  'Mallorca':        64, 'Alaves':         63, 'Las Palmas':      62,
  'Girona':          76, 'Valladolid':     60,
}

// ── Champions League strength ratings ─────────────────────────────────────────
const UCL_RATINGS = {
  'Real Madrid':     97, 'Man City':       96, 'Bayern Munich':   95,
  'PSG':             92, 'Inter Milan':    91, 'Barcelona':       90,
  'Arsenal':         88, 'Liverpool':      87, 'Atletico Madrid': 85,
  'Borussia Dortmund': 83, 'Chelsea':      82, 'Juventus':        81,
}

// ── International H2H records (home wins out of last 5) ───────────────────────
const H2H_INT = {
  'France_Morocco':      [1,0,0, 1,0,0, 1,0,0, 1,0,0, 0,1,0], // France 4-1
  'Spain_Belgium':       [1,0,0, 1,0,0, 0,0,1, 1,0,0, 1,0,0], // Spain 4-0-1
  'Norway_England':      [0,1,0, 0,1,0, 0,0,1, 0,1,0, 1,0,0], // Norway 1-3-1
  'Argentina_Switzerland': [1,0,0, 1,0,0, 1,0,0, 0,1,0, 1,0,0], // Arg 4-1
  'England_France':      [0,1,0, 1,0,0, 0,1,0, 0,1,0, 0,1,0], // Eng 1-4
  'Germany_Spain':       [0,1,0, 1,0,0, 0,1,0, 0,0,1, 0,1,0], // Ger 1-2-2
}

function h2hScore(home, away) {
  const key = `${home}_${away}`
  const rev = `${away}_${home}`
  let record = H2H_INT[key]
  let reversed = false
  if (!record && H2H_INT[rev]) { record = H2H_INT[rev]; reversed = true }
  if (!record) return 0.5
  let score = 0, total = 0
  for (let i = 0; i < record.length; i += 3) {
    const w = 1 / (Math.floor(i / 3) + 1)
    const homeWin = reversed ? record[i + 1] : record[i]
    score += homeWin * w
    total += w
  }
  return total > 0 ? score / total : 0.5
}

// ── Championship 2026-27 team strength ratings ────────────────────────────────
// Relegated from PL: West Ham, Burnley, Wolves
// Promoted from L1: Bolton, Lincoln City + 1 more
const CHAMPIONSHIP_RATINGS = {
  'West Ham':          85, 'Wolves':           83, 'Southampton':      78,
  'Sheffield United':  76, 'Wrexham':          75, 'Burnley':          74,
  'Middlesbrough':     73, 'Derby County':     72, 'Luton Town':       71,
  'Watford':           70, 'Blackburn':        70, 'Norwich City':     69,
  'Millwall':          68, 'Bristol City':     68, 'Cardiff City':     66,
  'Preston':           67, 'Swansea City':     65, 'QPR':              64,
  'Bolton':            70, 'Lincoln City':     65, 'Plymouth Argyle':  63,
  'Stoke City':        62, 'Sheffield Wednesday': 60, 'Coventry City': 66,
}

// ── League One 2026-27 team strength ratings ──────────────────────────────────
// Relegated from Championship: Oxford United, Leicester City + 1 more
const LEAGUE_ONE_RATINGS = {
  'Leicester City':   83, 'Oxford United':    70, 'Stockport County': 72,
  'Huddersfield':     71, 'Barnsley':         69, 'Wigan Athletic':   68,
  'Wycombe':          65, 'Mansfield Town':   65, 'Charlton Athletic':64,
  'Peterborough':     67, 'Exeter City':      66, 'Cambridge Utd':    63,
  'Rotherham':        62, 'Fleetwood Town':   60, 'Burton Albion':    61,
  'Shrewsbury':       59, 'Bristol Rovers':   60, 'Port Vale':        58,
  'Stevenage':        62, 'Notts County':     65, 'Bromley':          63,
  'Reading':          66, 'Leyton Orient':    64, 'Crawley Town':     59,
}

// ── League Two 2026-27 team strength ratings ──────────────────────────────────
const LEAGUE_TWO_RATINGS = {
  'AFC Wimbledon':    66, 'Swindon Town':     65, 'Doncaster':        64,
  'Grimsby Town':     62, 'Colchester':       61, 'Newport County':   60,
  'Gillingham':       62, 'Salford City':     63, 'Bradford City':    61,
  'Carlisle United':  60, 'Morecambe':        58, 'Tranmere':         59,
  'Barrow':           58, 'MK Dons':          63, 'Harrogate':        57,
  'Sutton United':    59, 'Forest Green':     56, 'Chesterfield':     64,
  'Accrington':       55, 'Rochdale':         63, 'York City':        66,
  'Dag & Red':        62, 'Boreham Wood':     58, 'Ebbsfleet':        57,
}

// ── National League 2026-27 team strength ratings ─────────────────────────────
const NATIONAL_LEAGUE_RATINGS = {
  'York City':        66, 'Rochdale':         64, 'Halifax Town':     63,
  'Dag & Red':        62, 'Maidstone':        61, 'Solihull Moors':   60,
  'Altrincham':       60, 'Ebbsfleet':        59, 'Wealdstone':       58,
  'Dover Athletic':   57, 'Bromley':          65, 'FC Halifax':       62,
  'Hartlepool':       61, 'Woking':           58, 'Southend United':  60,
  'Gateshead':        59, 'Eastleigh':        57, 'Torquay':          55,
  'Maidenhead':       56, 'Fylde':            57, 'Kidderminster':    55,
  'Spennymoor':       58, 'Boreham Wood':     60, 'Bath City':        55,
}
function internationalProb(home, away, neutral = true) {
  const pA = FIFA[home] ?? 1400
  const pB = FIFA[away] ?? 1400
  const homeAdv = neutral ? 0 : 60
  const eloProb = 1 / (1 + Math.pow(10, -((pA + homeAdv) - pB) / 200))
  const h2h = h2hScore(home, away)
  return eloProb * 0.65 + h2h * 0.35
}

function threeWayInternational(home, away, neutral = false, drawRate = 0.24) {
  const winProb = internationalProb(home, away, neutral)
  const h = winProb * (1 - drawRate)
  const a = (1 - winProb) * (1 - drawRate)
  const t = h + drawRate + a
  return [Math.round(h/t*1000)/1000, Math.round(drawRate/t*1000)/1000, Math.round(a/t*1000)/1000]
}

function knockoutProb(home, away) {
  const p = internationalProb(home, away, true)
  return [Math.round(p*1000)/1000, 0, Math.round((1-p)*1000)/1000]
}

function clubThreeWay(home, away, ratings, drawRate = 0.26) {
  const rH = ratings[home] ?? 70
  const rA = ratings[away] ?? 70
  const homeAdv = 4
  const winProb = 1 / (1 + Math.pow(10, -((rH + homeAdv) - rA) / 15))
  const h = winProb * (1 - drawRate)
  const a = (1 - winProb) * (1 - drawRate)
  const t = h + drawRate + a
  return [Math.round(h/t*1000)/1000, Math.round(drawRate/t*1000)/1000, Math.round(a/t*1000)/1000]
}

// Rating map per competition key
const CLUB_RATINGS = {
  epl: EPL_RATINGS, laliga: LALIGA_RATINGS, ucl: UCL_RATINGS,
  championship: CHAMPIONSHIP_RATINGS, league_one: LEAGUE_ONE_RATINGS,
  league_two: LEAGUE_TWO_RATINGS, national_league: NATIONAL_LEAGUE_RATINGS,
}

// ── Fixture schedules ──────────────────────────────────────────────────────────
const FIXTURES = {
  fifa_wc: [
    // Quarter-finals
    { home: 'France',    away: 'Morocco',     date: '2026-07-09T21:00:00Z', format: 'ko', stage: 'QF' },
    { home: 'Spain',     away: 'Belgium',     date: '2026-07-10T20:00:00Z', format: 'ko', stage: 'QF' },
    { home: 'Norway',    away: 'England',     date: '2026-07-11T22:00:00Z', format: 'ko', stage: 'QF' },
    { home: 'Argentina', away: 'Switzerland', date: '2026-07-12T01:00:00Z', format: 'ko', stage: 'QF' },
    // Semi-finals & Final TBC — will be populated once QF winners known
  ],
  epl: [
    // Gameweek 1 — Aug 21-24 2026
    { home: 'Arsenal',          away: 'Coventry City',  date: '2026-08-21T19:00:00Z', format: 'three_way' },
    { home: 'Hull City',        away: 'Man United',     date: '2026-08-22T11:30:00Z', format: 'three_way' },
    { home: 'Everton',          away: 'Crystal Palace', date: '2026-08-22T14:00:00Z', format: 'three_way' },
    { home: 'Ipswich Town',     away: 'Sunderland',     date: '2026-08-22T14:00:00Z', format: 'three_way' },
    { home: 'Nottm Forest',     away: 'Leeds United',   date: '2026-08-22T14:00:00Z', format: 'three_way' },
    { home: 'Brentford',        away: 'Tottenham',      date: '2026-08-22T16:30:00Z', format: 'three_way' },
    { home: 'Brighton',         away: 'Aston Villa',    date: '2026-08-23T13:00:00Z', format: 'three_way' },
    { home: 'Man City',         away: 'Bournemouth',    date: '2026-08-23T13:00:00Z', format: 'three_way' },
    { home: 'Newcastle United', away: 'Liverpool',      date: '2026-08-23T15:30:00Z', format: 'three_way' },
    { home: 'Fulham',           away: 'Chelsea',        date: '2026-08-24T19:00:00Z', format: 'three_way' },
  ],
  laliga: [
    // Matchday 1 — mid-Aug 2026 (dates TBC)
    { home: 'Real Madrid',    away: 'Valencia',        date: '2026-08-15T19:00:00Z', format: 'three_way' },
    { home: 'Barcelona',      away: 'Espanyol',        date: '2026-08-15T21:00:00Z', format: 'three_way' },
    { home: 'Atletico Madrid',away: 'Osasuna',         date: '2026-08-16T19:00:00Z', format: 'three_way' },
    { home: 'Real Betis',     away: 'Celta Vigo',      date: '2026-08-16T19:00:00Z', format: 'three_way' },
    { home: 'Villarreal',     away: 'Sevilla',         date: '2026-08-16T21:00:00Z', format: 'three_way' },
  ],
  // EFL Championship — GW1 Aug 14-17 2026
  // Fixtures released June 25 — Wolves vs Blackburn confirmed (Sky Sports opener)
  // West Ham at Burnley confirmed. Others approximate.
  championship: [
    { home: 'Wolves',          away: 'Blackburn',      date: '2026-08-14T19:45:00Z', format: 'three_way' },
    { home: 'Burnley',         away: 'West Ham',       date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Southampton',     away: 'Derby County',   date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Middlesbrough',   away: 'Norwich City',   date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Sheffield United',away: 'Watford',        date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Millwall',        away: 'Stoke City',     date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Cardiff City',    away: 'Swansea City',   date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Luton Town',      away: 'Preston',        date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Wrexham',         away: 'QPR',            date: '2026-08-16T15:00:00Z', format: 'three_way' },
    { home: 'Bolton',          away: 'Bristol City',   date: '2026-08-16T15:00:00Z', format: 'three_way' },
  ],
  // EFL League One — GW1 Aug 14-16 2026
  league_one: [
    { home: 'Leicester City',  away: 'Stockport County', date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Oxford United',   away: 'Huddersfield',     date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Barnsley',        away: 'Wycombe',          date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Wigan Athletic',  away: 'Peterborough',     date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Charlton Athletic',away:'Leyton Orient',    date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Exeter City',     away: 'Mansfield Town',   date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Reading',         away: 'Rotherham',        date: '2026-08-16T15:00:00Z', format: 'three_way' },
    { home: 'Notts County',    away: 'Bromley',          date: '2026-08-16T15:00:00Z', format: 'three_way' },
  ],
  // EFL League Two — GW1 Aug 14-16 2026
  league_two: [
    { home: 'AFC Wimbledon',   away: 'Swindon Town',   date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Doncaster',       away: 'Grimsby Town',   date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Colchester',      away: 'Newport County', date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Gillingham',      away: 'Salford City',   date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Bradford City',   away: 'MK Dons',        date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Chesterfield',    away: 'York City',      date: '2026-08-16T15:00:00Z', format: 'three_way' },
  ],
  // National League — GW1 approx mid-Aug 2026
  national_league: [
    { home: 'York City',       away: 'Rochdale',       date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Halifax Town',    away: 'Maidstone',      date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Dag & Red',       away: 'Solihull Moors', date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Hartlepool',      away: 'Altrincham',     date: '2026-08-15T14:00:00Z', format: 'three_way' },
    { home: 'Ebbsfleet',       away: 'Wealdstone',     date: '2026-08-16T15:00:00Z', format: 'three_way' },
  ],
    // Matchweek 1 — mid-Sep 2026 (dates TBC)
    { home: 'Real Madrid',   away: 'Bayern Munich',   date: '2026-09-16T20:00:00Z', format: 'three_way' },
    { home: 'Man City',      away: 'PSG',             date: '2026-09-16T20:00:00Z', format: 'three_way' },
    { home: 'Arsenal',       away: 'Inter Milan',     date: '2026-09-17T20:00:00Z', format: 'three_way' },
    { home: 'Barcelona',     away: 'Juventus',        date: '2026-09-17T20:00:00Z', format: 'three_way' },
  ],
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { competitionKey } = req.query
  if (!competitionKey) return res.status(400).json({ error: 'competitionKey required' })

  const schedule = FIXTURES[competitionKey]
  if (!schedule) return res.status(200).json({ fixtures: [], debug: `No schedule for ${competitionKey}` })

  const now = new Date()
  const cutoff = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)
  const ratings = CLUB_RATINGS[competitionKey]

  const allFuture = schedule.filter(f => new Date(f.date) > now).sort((a,b) => new Date(a.date) - new Date(b.date))
  const upcoming = allFuture.filter(f => new Date(f.date) <= cutoff)
  const nextFixtureDate = allFuture[0]?.date || null
  const nextFixtureName = allFuture[0] ? `${allFuture[0].home} vs ${allFuture[0].away}` : null

  if (!upcoming.length) {
    return res.status(200).json({
      fixtures: [],
      nextFixture: nextFixtureDate,
      nextFixtureName,
      debug: 'No upcoming fixtures in next 21 days',
    })
  }

  const fixtures = upcoming.map(f => {
    let probs, outcomes, format

    if (f.format === 'ko') {
      probs = knockoutProb(f.home, f.away)
      outcomes = [f.home, f.away]
      format = 'three_way_no_draw'
    } else if (['fifa_wc', 'euros'].includes(competitionKey)) {
      probs = threeWayInternational(f.home, f.away)
      outcomes = [f.home, 'Draw', f.away]
      format = 'three_way'
    } else {
      probs = clubThreeWay(f.home, f.away, ratings)
      outcomes = [f.home, 'Draw', f.away]
      format = 'three_way'
    }

    return {
      name: `${f.home} vs ${f.away}`,
      kickoff: f.date,
      outcomes,
      probabilities: probs,
      format,
      stage: f.stage || null,
      meta: {
        homeRating: FIFA[f.home] || ratings[f.home] || null,
        awayRating: FIFA[f.away] || ratings[f.away] || null,
      },
    }
  })

  return res.status(200).json({ fixtures, competition: competitionKey, count: fixtures.length })
}
