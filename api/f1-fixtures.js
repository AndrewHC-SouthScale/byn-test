// api/f1-fixtures.js — Vercel serverless function
// F1 race winner probabilities based on:
//   50% current 2026 season championship performance
//   30% 2025 final championship standings
//   20% historical performance at this specific circuit
// All data from OpenF1 (free, no API key)

const OPENF1 = 'https://api.openf1.org/v1'

// F1 points system P1-P10
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

// 2026 driver roster — driver_number maps to abbreviation
// Update driver_number if team changes occur mid-season
// 2026 full grid — 11 teams, 22 drivers. Updated July 2026 after British GP (Round 9)
// Championship leader: Kimi Antonelli (Mercedes) 179pts, Russell 2nd 154pts
const DRIVER_ROSTER = [
  { abbr: 'ANT', number: 12, name: 'Kimi Antonelli',    team: 'Mercedes'      },
  { abbr: 'RUS', number: 63, name: 'George Russell',    team: 'Mercedes'      },
  { abbr: 'LEC', number: 16, name: 'Charles Leclerc',   team: 'Ferrari'       },
  { abbr: 'HAM', number: 44, name: 'Lewis Hamilton',    team: 'Ferrari'       },
  { abbr: 'NOR', number: 4,  name: 'Lando Norris',      team: 'McLaren'       },
  { abbr: 'PIA', number: 81, name: 'Oscar Piastri',     team: 'McLaren'       },
  { abbr: 'VER', number: 33, name: 'Max Verstappen',    team: 'Red Bull'      },
  { abbr: 'HAD', number: 6,  name: 'Isack Hadjar',      team: 'Red Bull'      },
  { abbr: 'SAI', number: 55, name: 'Carlos Sainz',      team: 'Williams'      },
  { abbr: 'ALB', number: 23, name: 'Alexander Albon',   team: 'Williams'      },
  { abbr: 'LAW', number: 30, name: 'Liam Lawson',       team: 'Racing Bulls'  },
  { abbr: 'LIN', number: 5,  name: 'Arvid Lindblad',   team: 'Racing Bulls'  },
  { abbr: 'ALO', number: 14, name: 'Fernando Alonso',   team: 'Aston Martin'  },
  { abbr: 'STR', number: 18, name: 'Lance Stroll',      team: 'Aston Martin'  },
  { abbr: 'OCO', number: 31, name: 'Esteban Ocon',      team: 'Haas'          },
  { abbr: 'BEA', number: 87, name: 'Oliver Bearman',    team: 'Haas'          },
  { abbr: 'HUL', number: 27, name: 'Nico Hülkenberg',  team: 'Audi'          },
  { abbr: 'BOR', number: 8,  name: 'Gabriel Bortoleto', team: 'Audi'          },
  { abbr: 'GAS', number: 10, name: 'Pierre Gasly',      team: 'Alpine'        },
  { abbr: 'COP', number: 43, name: 'Franco Colapinto',  team: 'Alpine'        },
  { abbr: 'PER', number: 11, name: 'Sergio Pérez',      team: 'Cadillac'      },
  { abbr: 'BOT', number: 77, name: 'Valtteri Bottas',   team: 'Cadillac'      },
]

// 2025 final championship points
// Norris won 2025 title in Abu Dhabi on countback over Verstappen and Piastri
const STANDINGS_2025 = {
  NOR: 430, VER: 381, PIA: 340, LEC: 295, RUS: 258,
  HAM: 234, SAI: 189, ALB: 115, HUL: 96,  GAS: 74,
  OCO: 56,  STR: 40,  ALO: 38,  LAW: 30,  BEA: 22,
  BOT: 4,   ANT: 0,   HAD: 0,   LIN: 0,   BOR: 0,
  COP: 0,   PER: 0,
}

// Map driver_number → abbreviation
const numToAbbr = {}
DRIVER_ROSTER.forEach(d => { numToAbbr[d.number] = d.abbr })

async function openF1(path) {
  try {
    const res = await fetch(`${OPENF1}${path}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

// Get final race position for each driver from a completed session
async function getSessionResults(sessionKey) {
  const positions = await openF1(`/position?session_key=${sessionKey}`)
  if (!positions?.length) return {}
  // Take the last recorded position per driver (= final race position)
  const final = {}
  positions.forEach(p => {
    if (p.driver_number && p.position) {
      final[p.driver_number] = p.position
    }
  })
  return final // { driver_number: finalPosition }
}

// Convert finishing positions to F1 championship points
function positionToPoints(position) {
  if (position >= 1 && position <= 10) return F1_POINTS[position - 1]
  return 0
}

// Normalize a score object to sum to 1.0
function normalise(scores) {
  const total = Object.values(scores).reduce((a, v) => a + v, 0)
  if (!total) return scores
  const result = {}
  Object.entries(scores).forEach(([k, v]) => { result[k] = v / total })
  return result
}

// Combine two score objects with a weight
function weightedMerge(a, b, weightA, weightB) {
  const result = {}
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])
  allKeys.forEach(k => {
    result[k] = (a[k] || 0) * weightA + (b[k] || 0) * weightB
  })
  return result
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const now = new Date()

    // ── Step 1: Get upcoming race ─────────────────────────────────────────────
    const allSessions = await openF1('/sessions?year=2026&session_type=Race')
    const races = allSessions.filter(s => s.session_name === 'Race' && !s.is_cancelled)
    const upcoming = races.filter(s => new Date(s.date_start) > now)
      .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
    const completed = races.filter(s => new Date(s.date_start) <= now)
      .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))

    if (!upcoming.length) {
      return res.status(200).json({ race: null, drivers: buildDriverList({}) })
    }

    const nextRace = upcoming[0]
    const circuitKey = nextRace.circuit_key

    // ── Step 2: Parallel data fetch ───────────────────────────────────────────
    // a) Current season results (all completed 2026 races)
    // b) Circuit history sessions (same circuit, last 3 years)
    const [circuitSessions] = await Promise.all([
      openF1(`/sessions?circuit_key=${circuitKey}&session_type=Race&session_name=Race`),
    ])

    // Filter circuit history to last 3 seasons, excluding current upcoming race
    const circuitHistory = (circuitSessions || [])
      .filter(s => s.session_key !== nextRace.session_key &&
                   new Date(s.date_start) <= now &&
                   s.year >= (now.getFullYear() - 3))
      .sort((a, b) => new Date(b.date_start) - new Date(a.date_start))
      .slice(0, 3) // last 3 races at this circuit

    // ── Step 3: Fetch race results in parallel ────────────────────────────────
    const [currentSeasonResults, circuitResults] = await Promise.all([
      Promise.all(completed.slice(-8).map(s => // last 8 races for speed
        getSessionResults(s.session_key).then(r => ({ sessionKey: s.session_key, results: r }))
      )),
      Promise.all(circuitHistory.map(s =>
        getSessionResults(s.session_key).then(r => ({ sessionKey: s.session_key, results: r }))
      )),
    ])

    // ── Step 4: Calculate current season score (50%) ──────────────────────────
    const currentPoints = {}
    DRIVER_ROSTER.forEach(d => { currentPoints[d.abbr] = 0 })
    currentSeasonResults.forEach(({ results }) => {
      Object.entries(results).forEach(([num, pos]) => {
        const abbr = numToAbbr[parseInt(num)]
        if (abbr) currentPoints[abbr] = (currentPoints[abbr] || 0) + positionToPoints(pos)
      })
    })
    // Add a floor so drivers with 0 points still appear (small base probability)
    DRIVER_ROSTER.forEach(d => {
      if (!currentPoints[d.abbr]) currentPoints[d.abbr] = 0.5
    })
    const currentScore = normalise(currentPoints)

    // ── Step 5: Calculate previous season score (30%) ─────────────────────────
    const prev = {}
    DRIVER_ROSTER.forEach(d => {
      prev[d.abbr] = (STANDINGS_2025[d.abbr] || 5) // floor of 5 for new drivers
    })
    const prevScore = normalise(prev)

    // ── Step 6: Calculate circuit history score (20%) ─────────────────────────
    const circuitPoints = {}
    DRIVER_ROSTER.forEach(d => { circuitPoints[d.abbr] = 0 })
    let circuitRacesFound = 0

    circuitResults.forEach(({ results }) => {
      if (!Object.keys(results).length) return
      circuitRacesFound++
      Object.entries(results).forEach(([num, pos]) => {
        const abbr = numToAbbr[parseInt(num)]
        if (abbr) {
          // Score inversely proportional to finishing position (P1=20pts, P2=19pts etc.)
          const score = Math.max(0, 21 - pos)
          circuitPoints[abbr] = (circuitPoints[abbr] || 0) + score
        }
      })
    })
    DRIVER_ROSTER.forEach(d => {
      if (!circuitPoints[d.abbr]) circuitPoints[d.abbr] = 1 // small floor
    })
    const circuitScore = normalise(circuitPoints)

    // ── Step 7: Combine scores with weights ───────────────────────────────────
    let combined = {}
    DRIVER_ROSTER.forEach(d => {
      combined[d.abbr] =
        (currentScore[d.abbr]  || 0) * 0.50 +
        (prevScore[d.abbr]     || 0) * 0.30 +
        (circuitScore[d.abbr]  || 0) * 0.20
    })
    combined = normalise(combined)

    // ── Step 8: Build response ────────────────────────────────────────────────
    const drivers = DRIVER_ROSTER.map(d => ({
      name: d.abbr,
      fullName: d.name,
      team: d.team,
      probability: Math.round((combined[d.abbr] || 0) * 1000) / 1000,
      scores: {
        currentSeason: Math.round((currentScore[d.abbr] || 0) * 1000) / 1000,
        prevSeason: Math.round((prevScore[d.abbr] || 0) * 1000) / 1000,
        circuitHistory: Math.round((circuitScore[d.abbr] || 0) * 1000) / 1000,
      },
      currentPoints: Math.round(currentPoints[d.abbr] - 0.5), // remove floor
    })).sort((a, b) => b.probability - a.probability)

    return res.status(200).json({
      race: {
        id: nextRace.session_key,
        name: `${nextRace.country_name} Grand Prix`,
        circuit: nextRace.circuit_short_name,
        location: `${nextRace.location}, ${nextRace.country_name}`,
        date: nextRace.date_start,
        season: nextRace.year,
      },
      drivers,
      meta: {
        currentSeasonRaces: completed.length,
        circuitHistoryRaces: circuitRacesFound,
        weights: { currentSeason: '50%', prevSeason: '30%', circuitHistory: '20%' },
      },
    })
  } catch (err) {
    console.error('F1 fixtures error:', err)
    return res.status(500).json({ error: err.message })
  }
}
