import { supabase } from './supabase.js'

// Place a bet and record it in the database
export async function placeBet(userId, { marketOutcomeId, roundId, competitionId, stake, shares, priceAtExecution }) {
  const { data, error } = await supabase
    .from('bets')
    .insert({
      user_id: userId,
      market_outcome_id: marketOutcomeId,
      round_id: roundId,
      competition_id: competitionId,
      stake,
      shares,
      price_at_execution: priceAtExecution,
      settled: false,
      void: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error placing bet:', error)
    return null
  }

  return data
}

// Load all bets for a user in a specific round
export async function loadBetsForRound(userId, roundId) {
  const { data, error } = await supabase
    .from('bets')
    .select('*, market_outcomes(label, market_id, is_winner)')
    .eq('user_id', userId)
    .eq('round_id', roundId)

  if (error) {
    console.error('Error loading bets:', error)
    return []
  }

  return data
}

// Load all settled bets for a user in a competition (for history/leaderboard)
export async function loadBetHistory(userId, competitionId) {
  const { data, error } = await supabase
    .from('bets')
    .select('*, market_outcomes(label, is_winner)')
    .eq('user_id', userId)
    .eq('competition_id', competitionId)
    .eq('settled', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading bet history:', error)
    return []
  }

  return data
}

// Settle all bets for a round once results are in
export async function settleBets(roundId, outcomes) {
  // outcomes: [{ marketOutcomeId, isWinner }]
  const winningIds = new Set(
    outcomes.filter((o) => o.isWinner).map((o) => o.marketOutcomeId)
  )

  // Load all unsettled bets for this round
  const { data: bets, error } = await supabase
    .from('bets')
    .select('*')
    .eq('round_id', roundId)
    .eq('settled', false)
    .eq('void', false)

  if (error || !bets?.length) return []

  // Calculate payouts and mark settled
  const updates = bets.map((bet) => ({
    id: bet.id,
    settled: true,
    payout: winningIds.has(bet.market_outcome_id) ? bet.shares : 0,
  }))

  const { data: settled, error: updateError } = await supabase
    .from('bets')
    .upsert(updates)
    .select()

  if (updateError) {
    console.error('Error settling bets:', updateError)
    return []
  }

  return settled
}

// Void all bets on a postponed market
export async function voidBetsForMarket(marketId) {
  const { data, error } = await supabase
    .from('bets')
    .update({ void: true, settled: true, payout: null })
    .eq('market_outcome_id', marketId)
    .eq('settled', false)
    .select()

  if (error) {
    console.error('Error voiding bets:', error)
    return []
  }

  return data
}
