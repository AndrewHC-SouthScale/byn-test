// api/rugby-fixtures.js — Vercel serverless function
// Fetches rugby fixtures and builds match probabilities using:
//   40% current standings / World Rugby ranking
//   30% head-to-head history (last 10 meetings)
//   30% Highlightly prediction model
// Covers: Nations Championship, Rugby Championship, Six Nations,
//         URC, Super Rugby, Premiership Rugby, Rugby World Cup

const BASE = 'https://sports.highlightly.net/rugby'

// Map BYN competition key → Highlightly league search term + season
const LEAGUE_MAP = {
  nations_champ: { name: 'Nations Championship',     season: 2026 },
  rugby_champ:   { name: 'Rugby Championship',       season: 2026 },
  six_nations:   { name: 'Six Nations',              season: 2027 },
  urc:           { name: 'United Rugby Championship',season: 2026 },
  super_rugby:   { name: 'Super Rugby Pacific',      season: 2027 },
  prem_rugby:    { name: 'Premiership Rugby',        season: 2026 },
  rugby_wc:      { name: 'Rugby World Cup',          season: 2027 },
}

async function hl(path) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-rapidapi-key': process.env.RUGBY_API_KEY },
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`Highlightly error on ${path}:`, res.status, text.slice(0, 200))
      return null
    }
    return await res.json()
  } catch (err) {
    console.error(`Highlightly fetch error on ${path}:`, err.message)
    return null
  }
}

// Find league ID by name
async function findLeagueId(leagueName, season) {
  const data = await hl(`/leagues?leagueName=${encodeURIComponent(leagueName)}&limit=5`)
  if (!data?.length) return null
  // Try exact match first, then partial
  const exact = data.find(l => l.name?.toLowerCase() === leagueName.toLowerCase())
  const match = exact || data[0]
  return match?.id || null
}

// Get upcoming fixtures for a league in the next 14 days
async function getUpcomingFixtures(leagueId, season) {
  const now = new Date()
  const cutoff = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const from = now.toISOString().split('T')[0]
  const to = cutoff.toISOString().split('T')[0]

  const data = await hl(`/matches?leagueId=${leagueId}&season=${season}&from=${from}&to=${to}&limit=20`)
  if (!data?.length) return []

  // Filter to future matches only
  return data.filter(m => {
    const d = new Date(m.date || m.startTime)
    return d > now && !m.status?.includes('FT') && !m.status?.includes('AET')
  })
}

// Get H2H results for two teams
async function getH2H(homeTeamId, awayTeamId) {
  const data = await hl(`/h2h?homeTeamId=${homeTeamId}&awayTeamId=${awayTeamId}`)
  return data || []
}

// Get predictions for a match
async function getPrediction(matchId) {
  const data = await hl(`/predictions?matchId=${matchId}`)
  return data || null
}

// Get standings for league
async function getStandings(leagueId, season) {
  const data = await hl(`/standings?leagueId=${leagueId}&season=${season}`)
  return data || []
}

// Calculate H2H score for home team (0–1)
function calcH2HScore(h2hMatches, homeTeamId) {
  if (!h2hMatches.length) return 0.5 // unknown — assume even

  let score = 0
  let totalWeight = 0

  h2hMatches.slice(0, 10).forEach((m, i) => {
    const weight = 1 / (i + 1) // more recent = higher weight
    const homeScore = m.homeTeam?.score ?? m.homeScore ?? 0
    const awayScore = m.awayTeam?.score ?? m.awayScore ?? 0
    const homeWon = m.homeTeam?.id === homeTeamId
      ? homeScore > awayScore
      : awayScore > homeScore

    score += homeWon ? weight : 0
    totalWeight += weight
  })

  return totalWeight > 0 ? score / totalWeight : 0.5
}

// Calculate standings-based strength for home team (0–1)
function calcStandingsScore(standings, homeTeamId, awayTeamId) {
  if (!standings.length) return 0.5

  const homeEntry = standings.find(s => s.team?.id === homeTeamId || s.teamId === homeTeamId)
  const awayEntry = standings.find(s => s.team?.id === awayTeamId || s.teamId === awayTeamId)

  if (!homeEntry || !awayEntry) return 0.5

  const homePoints = homeEntry.points ?? homeEntry.pts ?? 0
  const awayPoints = awayEntry.points ?? awayEntry.pts ?? 0
  const total = homePoints + awayPoints

  return total > 0 ? homePoints / total : 0.5
}

// Build probability from components
function buildProbability(standingsScore, h2hScore, predictionWinProb) {
  const standingsWeight = 0.40
  const h2hWeight = 0.30
  const predictionWeight = 0.30

  if (predictionWinProb === null) {
    // No prediction — split remaining weight between standings and H2H
    return standingsScore * 0.55 + h2hScore * 0.45
  }

  return (
    standingsScore * standingsWeight +
    h2hScore * h2hWeight +
    predictionWinProb * predictionWeight
  )
}

// Apply home advantage (typically ~5% in rugby)
function applyHomeAdvantage(homeProb, isNeutral = false) {
  if (isNeutral) return homeProb
  return Math.min(0.95, Math.max(0.05, homeProb + 0.04))
}

// De-vig and normalise probabilities for three-way (home/draw/away)
function threeWayProbs(homeWinProb, drawRate = 0.13) {
  // Rugby union draw rate is low (~8-13%)
  const homeP = homeWinProb * (1 - drawRate)
  const awayP = (1 - homeWinProb) * (1 - drawRate)
  const drawP = drawRate
  const total = homeP + drawP + awayP
  return {
    home: Math.round((homeP / total) * 1000) / 1000,
    draw: Math.round((drawP / total) * 1000) / 1000,
    away: Math.round((awayP / total) * 1000) / 1000,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { competitionKey } = req.query
  if (!competitionKey) return res.status(400).json({ error: 'competitionKey required' })
  if (!process.env.RUGBY_API_KEY) return res.status(500).json({ error: 'RUGBY_API_KEY not configured' })

  // Discovery mode — find available leagues matching a search term
  if (req.query.discover) {
    const term = req.query.discover
    const data = await hl(`/leagues?leagueName=${encodeURIComponent(term)}&limit=10`)
    return res.status(200).json({ leagues: data || [], term })
  }


  if (!leagueInfo) return res.status(400).json({ error: `Unknown competition: ${competitionKey}` })

  try {
    // Step 1: Find league ID
    const leagueId = await findLeagueId(leagueInfo.name, leagueInfo.season)
    if (!leagueId) {
      return res.status(200).json({
        fixtures: [],
        debug: `League not found: ${leagueInfo.name} ${leagueInfo.season}`,
      })
    }

    // Step 2: Get upcoming fixtures and standings in parallel
    const [rawFixtures, standings] = await Promise.all([
      getUpcomingFixtures(leagueId, leagueInfo.season),
      getStandings(leagueId, leagueInfo.season),
    ])

    if (!rawFixtures.length) {
      return res.status(200).json({
        fixtures: [],
        debug: `No upcoming fixtures for leagueId=${leagueId}`,
      })
    }

    // Step 3: Enrich each fixture with H2H and predictions in parallel
    const enriched = await Promise.all(
      rawFixtures.slice(0, 12).map(async (m) => {
        const homeTeamId = m.homeTeam?.id
        const awayTeamId = m.awayTeam?.id

        const [h2hMatches, prediction] = await Promise.all([
          homeTeamId && awayTeamId ? getH2H(homeTeamId, awayTeamId) : [],
          m.id ? getPrediction(m.id) : null,
        ])

        // Calculate probability components
        const standingsScore = calcStandingsScore(standings, homeTeamId, awayTeamId)
        const h2hScore = calcH2HScore(h2hMatches, homeTeamId)
        const predictionWinProb = prediction?.homeWinProbability ?? prediction?.home?.probability ?? null

        const rawHomeProb = buildProbability(standingsScore, h2hScore, predictionWinProb)
        const homeProb = applyHomeAdvantage(rawHomeProb, !!m.venue?.neutral)

        const probs = threeWayProbs(homeProb)

        const homeName = m.homeTeam?.name || m.homeTeamName || 'Home'
        const awayName = m.awayTeam?.name || m.awayTeamName || 'Away'

        return {
          name: `${homeName} vs ${awayName}`,
          kickoff: m.date || m.startTime || null,
          externalId: m.id || null,
          homeTeam: homeName,
          awayTeam: awayName,
          outcomes: [homeName, 'Draw', awayName],
          probabilities: [probs.home, probs.draw, probs.away],
          format: 'three_way',
          meta: {
            standingsScore: Math.round(standingsScore * 100) / 100,
            h2hScore: Math.round(h2hScore * 100) / 100,
            predictionWinProb,
            h2hMatches: h2hMatches.length,
          },
        }
      })
    )

    return res.status(200).json({
      fixtures: enriched,
      leagueId,
      competition: leagueInfo.name,
      season: leagueInfo.season,
      count: enriched.length,
    })
  } catch (err) {
    console.error('Rugby fixtures error:', err)
    return res.status(500).json({ error: err.message })
  }
}
