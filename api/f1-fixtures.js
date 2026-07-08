// api/f1-fixtures.js — Vercel serverless function
// Fetches upcoming F1 race and driver standings from API-Sports

const BASE = 'https://v1.formula-1.api-sports.io'
const SEASON = 2026

async function apiSports(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-apisports-key': process.env.API_SPORTS_KEY },
  })
  const data = await res.json()
  // API-Sports wraps results in { response: [...] }
  return data?.response ?? null
}

async function buildResponse(res, race, season) {
  // Fetch driver standings for the season
  const standings = await apiSports(`/rankings/drivers?season=${season}`)
  const top8 = (standings || []).slice(0, 8)

  let drivers = []
  if (top8.length) {
    const totalPoints = top8.reduce((sum, s) => sum + Math.max(s.points || 1, 1), 0)
    const rawProbs = top8.map(s => Math.max(s.points || 1, 1) / totalPoints)
    const probSum = rawProbs.reduce((a, p) => a + p, 0)
    const normProbs = rawProbs.map(p => p / probSum)
    drivers = top8.map((s, i) => ({
      name: s.driver?.abbr || s.driver?.name?.surname || `Driver ${i + 1}`,
      fullName: [s.driver?.name?.forename, s.driver?.name?.surname].filter(Boolean).join(' '),
      team: s.team?.name || '',
      points: s.points || 0,
      probability: Math.round(normProbs[i] * 1000) / 1000,
    }))
  }

  const raceDate = race.date
    ? (race.time ? `${race.date}T${race.time}` : `${race.date}T13:00:00`)
    : null

  return res.status(200).json({
    race: {
      id: race.id,
      name: race.competition?.name || race.circuit?.name || 'Grand Prix',
      circuit: race.circuit?.name || '',
      location: [race.circuit?.location?.city, race.circuit?.location?.country].filter(Boolean).join(', '),
      date: raceDate,
      season,
      round: race.season?.round ?? null,
    },
    drivers,
  })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.API_SPORTS_KEY) return res.status(500).json({ error: 'API_SPORTS_KEY not set' })

  try {
    // Fetch all races for the season
    const allRaces = await apiSports(`/races?season=${SEASON}`)

    if (!allRaces?.length) {
      // Probe multiple endpoints to find what's available
      const [
        standings,
        circuits,
        grandsPrix,
        racesWithType,
      ] = await Promise.all([
        apiSports(`/standings/drivers?season=${SEASON}`),
        apiSports(`/circuits?season=${SEASON}`),
        apiSports(`/grands-prix?season=${SEASON}`),
        apiSports(`/races?season=${SEASON}&type=Race`),
      ])

      return res.status(200).json({
        race: null,
        drivers: [],
        debug: {
          msg: 'probing endpoints',
          standings_count: standings?.length ?? 'null',
          circuits_count: circuits?.length ?? 'null',
          grandsPrix_count: grandsPrix?.length ?? 'null',
          racesWithType_count: racesWithType?.length ?? 'null',
          circuits_sample: circuits?.slice(0, 2) ?? null,
          grandsPrix_sample: grandsPrix?.slice(0, 2) ?? null,
        }
      })
    }

    // Find the next upcoming race
    const now = new Date()
    const upcoming = allRaces
      .filter(r => r.date && new Date(r.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    const race = upcoming.length ? upcoming[0] : allRaces[allRaces.length - 1]
    return buildResponse(res, race, SEASON)
  } catch (err) {
    console.error('F1 fixtures error:', err)
    return res.status(500).json({ error: err.message })
  }
}
