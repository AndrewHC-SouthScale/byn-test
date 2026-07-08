// api/f1-fixtures.js — Vercel serverless function
// Fetches upcoming F1 race from OpenF1 (free, no API key needed)
// Driver probabilities estimated from hardcoded 2026 championship standings

// 2026 driver field with estimated championship-based probabilities
// Update these as the season progresses
const DRIVERS_2026 = [
  { name: 'NOR', fullName: 'Lando Norris',       team: 'McLaren',          probability: 0.22 },
  { name: 'VER', fullName: 'Max Verstappen',      team: 'Red Bull',         probability: 0.19 },
  { name: 'PIA', fullName: 'Oscar Piastri',       team: 'McLaren',          probability: 0.16 },
  { name: 'LEC', fullName: 'Charles Leclerc',     team: 'Ferrari',          probability: 0.13 },
  { name: 'ANT', fullName: 'Kimi Antonelli',      team: 'Mercedes',         probability: 0.10 },
  { name: 'RUS', fullName: 'George Russell',      team: 'Mercedes',         probability: 0.08 },
  { name: 'HAM', fullName: 'Lewis Hamilton',      team: 'Ferrari',          probability: 0.07 },
  { name: 'SAI', fullName: 'Carlos Sainz',        team: 'Williams',         probability: 0.05 },
]

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // OpenF1 — free public API, no key needed
    const response = await fetch(
      'https://api.openf1.org/v1/sessions?year=2026&session_type=Race',
      { headers: { 'Accept': 'application/json' } }
    )

    if (!response.ok) {
      return res.status(200).json({ race: null, drivers: DRIVERS_2026, error: 'OpenF1 unavailable' })
    }

    const sessions = await response.json()

    // Filter to actual Grands Prix (not Sprints) that haven't been cancelled
    const grandsPrix = sessions.filter(s =>
      s.session_name === 'Race' &&
      !s.is_cancelled
    )

    // Find the next upcoming race
    const now = new Date()
    const upcoming = grandsPrix
      .filter(s => new Date(s.date_start) >= now)
      .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))

    if (!upcoming.length) {
      return res.status(200).json({ race: null, drivers: DRIVERS_2026 })
    }

    const next = upcoming[0]

    return res.status(200).json({
      race: {
        id: next.session_key,
        name: `${next.country_name} Grand Prix`,
        circuit: next.circuit_short_name,
        location: `${next.location}, ${next.country_name}`,
        date: next.date_start,
        season: next.year,
        round: null,
      },
      drivers: DRIVERS_2026,
    })
  } catch (err) {
    console.error('F1 fixtures error:', err)
    return res.status(500).json({ error: err.message, drivers: DRIVERS_2026 })
  }
}
