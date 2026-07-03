// Odds Service — The Odds API integration
// Fetches upcoming fixtures and converts bookmaker odds to fair probabilities
// for seeding BYN markets at round start

const BASE_URL = 'https://api.the-odds-api.com/v4'
const API_KEY = import.meta.env.VITE_ODDS_API_KEY

// Map BYN competition keys to The Odds API sport keys
const SPORT_KEY_MAP = {
  epl:    'soccer_epl',
  laliga: 'soccer_spain_la_liga',
  nfl:    'americanfootball_nfl',
}

// ── De-vig: convert raw bookmaker odds to fair probabilities ──────────────────
// Takes an array of decimal odds, returns fair (no-vig) probabilities summing to 1
function devig(decimalOdds) {
  const implied = decimalOdds.map((o) => 1 / o)
  const total = implied.reduce((a, p) => a + p, 0)
  return implied.map((p) => p / total) // normalise to remove margin
}

// ── Fetch upcoming fixtures for a competition ─────────────────────────────────
// Returns an array of fixture objects ready to seed BYN markets
export async function fetchUpcomingFixtures(competitionKey, daysAhead = 7) {
  const sportKey = SPORT_KEY_MAP[competitionKey]
  if (!sportKey) {
    console.warn(`No Odds API sport key for competition: ${competitionKey}`)
    return []
  }

  try {
    const url = new URL(`${BASE_URL}/sports/${sportKey}/odds`)
    url.searchParams.set('apiKey', API_KEY)
    url.searchParams.set('regions', 'uk')           // UK bookmakers for EPL/La Liga
    url.searchParams.set('markets', 'h2h')          // head-to-head (match winner)
    url.searchParams.set('oddsFormat', 'decimal')
    url.searchParams.set('dateFormat', 'iso')

    const response = await fetch(url.toString())

    if (!response.ok) {
      console.error('Odds API error:', response.status, await response.text())
      return []
    }

    const data = await response.json()

    // Filter to fixtures starting within daysAhead
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + daysAhead)

    const upcoming = data.filter((fixture) => {
      const kickoff = new Date(fixture.commence_time)
      return kickoff >= new Date() && kickoff <= cutoff
    })

    return upcoming.map((fixture) => processFixture(fixture, competitionKey))
      .filter(Boolean) // remove any that failed processing
  } catch (err) {
    console.error('Error fetching odds:', err)
    return []
  }
}

// ── Process a single fixture from the API ────────────────────────────────────
function processFixture(fixture, competitionKey) {
  try {
    // Find the best bookmaker (prefer Bet365, Betfair, William Hill in that order)
    const preferredBooks = ['bet365', 'betfair', 'williamhill', 'paddypower', 'ladbrokes']
    let bookmaker = fixture.bookmakers?.find(
      (b) => preferredBooks.includes(b.key)
    ) || fixture.bookmakers?.[0]

    if (!bookmaker) return null

    const market = bookmaker.markets?.find((m) => m.key === 'h2h')
    if (!market) return null

    const isFootball = ['epl', 'laliga'].includes(competitionKey)
    const outcomes = market.outcomes

    // For football: home, draw, away
    // For NFL: home, away (no draw)
    let homeOdds, drawOdds, awayOdds, homeTeam, awayTeam

    if (isFootball) {
      // API returns outcomes as home team, away team, Draw
      const home = outcomes.find((o) => o.name === fixture.home_team)
      const away = outcomes.find((o) => o.name === fixture.away_team)
      const draw = outcomes.find((o) => o.name === 'Draw')

      if (!home || !away || !draw) return null

      homeTeam = fixture.home_team
      awayTeam = fixture.away_team
      homeOdds = home.price
      drawOdds = draw.price
      awayOdds = away.price

      const [homeProb, drawProb, awayProb] = devig([homeOdds, drawOdds, awayOdds])
      return {
        name: `${homeTeam} vs ${awayTeam}`,
        homeTeam,
        awayTeam,
        kickoff: fixture.commence_time,
        format: 'three_way',
        outcomes: [homeTeam, 'Draw', awayTeam],
        probabilities: [homeProb, drawProb, awayProb],
        externalId: fixture.id,
        bookmaker: bookmaker.key,
      }
    } else {
      // NFL — no draw
      const home = outcomes.find((o) => o.name === fixture.home_team)
      const away = outcomes.find((o) => o.name === fixture.away_team)

      if (!home || !away) return null

      homeTeam = fixture.home_team
      awayTeam = fixture.away_team
      homeOdds = home.price
      awayOdds = away.price

      const [homeProb, awayProb] = devig([homeOdds, awayOdds])
      return {
        name: `${homeTeam} vs ${awayTeam}`,
        homeTeam,
        awayTeam,
        kickoff: fixture.commence_time,
        format: 'two_way',
        outcomes: [homeTeam, awayTeam],
        probabilities: [homeProb, awayProb],
        externalId: fixture.id,
        bookmaker: bookmaker.key,
      }
    }
  } catch (err) {
    console.error('Error processing fixture:', err)
    return null
  }
}

// ── Fetch results for a completed round ──────────────────────────────────────
// Used to settle markets once events finish
export async function fetchResults(competitionKey, eventIds = []) {
  const sportKey = SPORT_KEY_MAP[competitionKey]
  if (!sportKey) return []

  try {
    const url = new URL(`${BASE_URL}/sports/${sportKey}/scores`)
    url.searchParams.set('apiKey', API_KEY)
    url.searchParams.set('daysFrom', '3') // look back 3 days for recent results

    const response = await fetch(url.toString())
    if (!response.ok) return []

    const data = await response.json()

    return data
      .filter((r) => r.completed && (eventIds.length === 0 || eventIds.includes(r.id)))
      .map((r) => ({
        externalId: r.id,
        homeTeam:   r.home_team,
        awayTeam:   r.away_team,
        homeScore:  r.scores?.find((s) => s.name === r.home_team)?.score,
        awayScore:  r.scores?.find((s) => s.name === r.away_team)?.score,
        completed:  r.completed,
        winner: (() => {
          const h = parseInt(r.scores?.find((s) => s.name === r.home_team)?.score)
          const a = parseInt(r.scores?.find((s) => s.name === r.away_team)?.score)
          if (isNaN(h) || isNaN(a)) return null
          if (h > a) return r.home_team
          if (a > h) return r.away_team
          return 'Draw'
        })(),
      }))
  } catch (err) {
    console.error('Error fetching results:', err)
    return []
  }
}

// ── Check remaining API quota ─────────────────────────────────────────────────
export async function checkApiQuota() {
  try {
    const url = new URL(`${BASE_URL}/sports/soccer_epl/odds`)
    url.searchParams.set('apiKey', API_KEY)
    url.searchParams.set('regions', 'uk')
    url.searchParams.set('markets', 'h2h')

    const response = await fetch(url.toString())
    return {
      remaining:  response.headers.get('x-requests-remaining'),
      used:       response.headers.get('x-requests-used'),
    }
  } catch {
    return { remaining: 'unknown', used: 'unknown' }
  }
}
