import { supabase } from './supabase.js'

// Get or create the current round for a competition
export async function getOrCreateRound(competitionKey, roundNumber, seasonNumber = 1) {
  // Get competition ID
  const { data: comp, error: compError } = await supabase
    .from('competitions')
    .select('id')
    .eq('key', competitionKey)
    .single()

  if (compError || !comp) {
    console.error('Competition not found:', competitionKey)
    return null
  }

  // Check for existing round
  const { data: existing, error: fetchError } = await supabase
    .from('betting_rounds')
    .select('*')
    .eq('competition_id', comp.id)
    .eq('round_number', roundNumber)
    .eq('season_number', seasonNumber)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error fetching round:', fetchError)
    return null
  }

  if (existing) return existing

  // Create new round
  const { data: newRound, error: insertError } = await supabase
    .from('betting_rounds')
    .insert({
      competition_id: comp.id,
      label: `Round ${roundNumber}`,
      round_number: roundNumber,
      season_number: seasonNumber,
      status: 'open',
    })
    .select()
    .single()

  if (insertError) {
    console.error('Error creating round:', insertError)
    return null
  }

  return newRound
}

// Load the current active round for a competition
export async function loadCurrentRound(competitionKey) {
  const { data: comp } = await supabase
    .from('competitions')
    .select('id')
    .eq('key', competitionKey)
    .single()

  if (!comp) return null

  const { data, error } = await supabase
    .from('betting_rounds')
    .select('*')
    .eq('competition_id', comp.id)
    .in('status', ['open', 'locked'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data
}

// Update round status (open → locked → settled)
export async function updateRoundStatus(roundId, status) {
  const { data, error } = await supabase
    .from('betting_rounds')
    .update({ status })
    .eq('id', roundId)
    .select()
    .single()

  if (error) {
    console.error('Error updating round status:', error)
    return null
  }

  return data
}

// Save market LMSR state (q values) to database
export async function saveMarketState(marketId, outcomes) {
  // outcomes: [{ id, q }]
  const updates = outcomes.map((o) => ({
    id: o.id,
    q: o.q,
  }))

  const { error } = await supabase
    .from('market_outcomes')
    .upsert(updates)

  if (error) {
    console.error('Error saving market state:', error)
    return false
  }

  return true
}

// Create markets and outcomes for a round
export async function createMarketsForRound(roundId, fixtures) {
  // fixtures: [{ name, outcomes: [{ label, q, sortOrder }], liquidity_b }]
  const createdMarkets = []

  for (const fixture of fixtures) {
    // Create market
    const { data: market, error: mError } = await supabase
      .from('markets')
      .insert({
        event_id: null, // will be linked to real events once sports feed is wired in
        market_type: 'winner',
        liquidity_b: fixture.liquidity_b,
        status: 'open',
      })
      .select()
      .single()

    if (mError || !market) continue

    // Create outcomes
    const outcomeRows = fixture.outcomes.map((o, i) => ({
      market_id: market.id,
      label: o.label,
      q: o.q,
      sort_order: i,
    }))

    const { data: outcomes, error: oError } = await supabase
      .from('market_outcomes')
      .insert(outcomeRows)
      .select()

    if (oError) continue

    createdMarkets.push({ ...market, outcomes })
  }

  return createdMarkets
}

// Save round standings snapshot after settlement
export async function saveRoundStandings(standings) {
  // standings: [{ userId, competitionId, roundId, roundNumber, seasonNumber, endingBalance, rank }]
  const { error } = await supabase
    .from('round_standings')
    .upsert(
      standings.map((s) => ({
        user_id: s.userId,
        competition_id: s.competitionId,
        round_id: s.roundId,
        round_number: s.roundNumber,
        season_number: s.seasonNumber,
        ending_balance: s.endingBalance,
        rank: s.rank,
      })),
      { onConflict: 'user_id,round_id' }
    )

  if (error) {
    console.error('Error saving standings:', error)
    return false
  }

  return true
}

// Load season standings for leaderboard
export async function loadSeasonStandings(competitionKey, seasonNumber = 1) {
  const { data: comp } = await supabase
    .from('competitions')
    .select('id')
    .eq('key', competitionKey)
    .single()

  if (!comp) return []

  const { data, error } = await supabase
    .from('round_standings')
    .select('*, profiles(display_name, country)')
    .eq('competition_id', comp.id)
    .eq('season_number', seasonNumber)
    .order('round_number', { ascending: true })

  if (error) {
    console.error('Error loading standings:', error)
    return []
  }

  return data
}
