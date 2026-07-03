// Odds Service — The Odds API integration
// NOTE: API calls currently disabled to preserve quota during testing
// To re-enable: remove the early return from fetchUpcomingFixtures below

const BASE_URL = 'https://api.the-odds-api.com/v4'
const API_KEY = import.meta.env.VITE_ODDS_API_KEY

const SPORT_KEY_MAP = {
  epl:     'soccer_epl',
  laliga:  'soccer_spain_la_liga',
  nfl:     'americanfootball_nfl',
  fifa_wc: 'soccer_fifa_world_cup',
  atp:     'tennis_atp_wimbledon',
  wta:     'tennis_wta_wimbledon',
  pga:     'golf_the_open_championship_winner',
}

const OUTRIGHT_COMPS = new Set(['pga'])

function devig(decimalOdds) {
  const implied = decimalOdds.map((o) => 1 / Math.max(o, 1.01))
  const total = implied.reduce((a, p) => a + p, 0)
  return implied.map((p) => p / total)
}

// ── MAIN ENTRY POINT ──────────────────────────────────────────────────────────
export async function fetchUpcomingFixtures(competitionKey, daysAhead = 14) {
  // API disabled during testing — remove this return to re-enable
  return []

  // eslint-disable-next-line no-unreachable
  const sportKey = SPORT_KEY_MAP[competitionKey]
  if (!sportKey) return []
  if (OUTRIGHT_COMPS.has(competitionKey)) return fetchOutrightOdds(competitionKey, daysAhead)

  try {
    const url = new URL(`${BASE_URL}/sports/${sportKey}/odds`)
    url.searchParams.set('apiKey', API_KEY)
    url.searchParams.set('regions', 'uk')
    url.searchParams.set('markets', 'h2h')
    url.searchParams.set('oddsFormat', 'decimal')
    url.searchParams.set('dateFormat', 'iso')

    const response = await fetch(url.toString())
    if (!response.ok) return []

    const data = await response.json()
    const now = new Date()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + daysAhead)

    return data
      .filter((f) => { const t = new Date(f.commence_time); return t >= now && t <= cutoff })
      .map((f) => processH2HFixture(f, competitionKey))
      .filter(Boolean)
  } catch (err) {
    console.error('Error fetching fixtures:', err)
    return []
  }
}

async function fetchOutrightOdds(competitionKey, daysAhead = 14) {
  const sportKey = SPORT_KEY_MAP[competitionKey]
  if (!sportKey) return []
  try {
    const url = new URL(`${BASE_URL}/sports/${sportKey}/odds`)
    url.searchParams.set('apiKey', API_KEY)
    url.searchParams.set('regions', 'uk')
    url.searchParams.set('markets', 'outrights')
    url.searchParams.set('oddsFormat', 'decimal')
    url.searchParams.set('dateFormat', 'iso')

    const response = await fetch(url.toString())
    if (!response.ok) return []

    const data = await response.json()
    if (!data?.length) return []

    const now = new Date()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + daysAhead)

    const upcoming = data.filter((f) => { const t = new Date(f.commence_time); return t >= now && t <= cutoff })
    if (!upcoming.length) return []

    const event = upcoming[0]
    const bookmaker = event.bookmakers?.find((b) => ['bet365','betfair','williamhill'].includes(b.key)) || event.bookmakers?.[0]
    if (!bookmaker) return []

    const market = bookmaker.markets?.find((m) => m.key === 'outrights')
    if (!market?.outcomes?.length) return []

    const sorted = [...market.outcomes].sort((a, b) => a.price - b.price).slice(0, 8)
    const probs = devig(sorted.map((o) => o.price))

    return [{ name: event.sport_title || competitionKey.toUpperCase(), outcomes: sorted.map((o) => o.name), probabilities: probs, kickoff: event.commence_time, externalId: event.id, format: 'outright' }]
  } catch (err) {
    console.error('Error fetching outright odds:', err)
    return []
  }
}

function processH2HFixture(fixture, competitionKey) {
  try {
    const preferredBooks = ['bet365','betfair','williamhill','paddypower','ladbrokes']
    const bookmaker = fixture.bookmakers?.find((b) => preferredBooks.includes(b.key)) || fixture.bookmakers?.[0]
    if (!bookmaker) return null

    const market = bookmaker.markets?.find((m) => m.key === 'h2h')
    if (!market) return null

    const home = market.outcomes.find((o) => o.name === fixture.home_team)
    const away = market.outcomes.find((o) => o.name === fixture.away_team)
    const draw = market.outcomes.find((o) => o.name === 'Draw')
    if (!home || !away) return null

    const isWorldCup = competitionKey === 'fifa_wc'
    if (!isWorldCup && draw) {
      const probs = devig([home.price, draw.price, away.price])
      return { name: `${fixture.home_team} vs ${fixture.away_team}`, homeTeam: fixture.home_team, awayTeam: fixture.away_team, kickoff: fixture.commence_time, format: 'three_way', outcomes: [fixture.home_team, 'Draw', fixture.away_team], probabilities: probs, externalId: fixture.id, bookmaker: bookmaker.key }
    }

    const probs = devig([home.price, away.price])
    return { name: `${fixture.home_team} vs ${fixture.away_team}`, homeTeam: fixture.home_team, awayTeam: fixture.away_team, kickoff: fixture.commence_time, format: 'two_way', outcomes: [fixture.home_team, fixture.away_team], probabilities: probs, externalId: fixture.id, bookmaker: bookmaker.key }
  } catch (err) {
    console.error('Error processing fixture:', err)
    return null
  }
}

export async function fetchResults(competitionKey, eventIds = []) {
  const sportKey = SPORT_KEY_MAP[competitionKey]
  if (!sportKey || OUTRIGHT_COMPS.has(competitionKey)) return []
  try {
    const url = new URL(`${BASE_URL}/sports/${sportKey}/scores`)
    url.searchParams.set('apiKey', API_KEY)
    url.searchParams.set('daysFrom', '3')
    const response = await fetch(url.toString())
    if (!response.ok) return []
    const data = await response.json()
    return data.filter((r) => r.completed && (eventIds.length === 0 || eventIds.includes(r.id))).map((r) => {
      const h = parseInt(r.scores?.find((s) => s.name === r.home_team)?.score)
      const a = parseInt(r.scores?.find((s) => s.name === r.away_team)?.score)
      return { externalId: r.id, homeTeam: r.home_team, awayTeam: r.away_team, completed: r.completed, winner: isNaN(h) || isNaN(a) ? null : h > a ? r.home_team : a > h ? r.away_team : 'Draw' }
    })
  } catch (err) {
    console.error('Error fetching results:', err)
    return []
  }
}
