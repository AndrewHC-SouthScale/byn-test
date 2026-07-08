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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.API_SPORTS_KEY) return res.status(500).json({ error: 'API_SPORTS_KEY not set' })

  try {
    // Fetch all races for the season
    const allRaces = await apiSports(`/races?season=${SEASON}`)

    if (!allRaces?.length) {
      return res.status(200).json({ race: null, drivers: [], debug: 'no races returned' })
    }

    // Find the next upcoming race
    const now = new Date()
    const upcoming = allRaces
      .filter(r => r.date && new Date(r.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    if (!upcoming.length) {
      return res.status(200).json({ race: null, drivers: [], debug: `${allRaces.length} races found but none upcoming` })
    }

    const race = upcoming[0]

    // Fetch driver standings
    const standings = await apiSports(`/rankings/drivers?season=${SEASON}`)
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

    // Build race date ISO string
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
        season: SEASON,
        round: race.season?.round ?? null,
      },
      drivers,
    })
  } catch (err) {
    console.error('F1 fixtures error:', err)
    return res.status(500).json({ error: err.message })
  }
}
