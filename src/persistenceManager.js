import { supabase } from './supabase.js'
import { getOrCreateWallet, updateWalletBalance } from './walletService.js'
import { getOrCreateRound, saveRoundStandings, loadCurrentRound } from './roundService.js'

const WEEKLY_TOPUP = 1000

// ── Load all persisted state for a user on login ─────────────────────────────
export async function loadUserState(userId, competitions) {
  const result = {}

  for (const comp of competitions) {
    if (!comp.active) continue
    try {
      const wallet = await getOrCreateWallet(userId, comp.key)
      const balance = wallet?.balance || 0
      const round = await loadCurrentRound(comp.key)
      const roundNumber = round?.round_number || 1
      const stage = round?.status === 'locked' ? 'locked'
                  : round?.status === 'settled' ? 'settled'
                  : 'betting'

      let bets = []
      let dbOutcomeMap = {}

      if (round?.id) {
        // Load bets for this round
        const { data: betRows } = await supabase
          .from('bets')
          .select('*, market_outcomes(id, label, market_id, q, sort_order, markets(id, liquidity_b))')
          .eq('user_id', userId)
          .eq('round_id', round.id)
          .eq('settled', false)
          .eq('void', false)

        if (betRows?.length) {
          // Rebuild local bet format from DB rows
          bets = betRows.map((b) => ({
            marketId:          b.market_outcomes?.markets?.id || b.market_outcome_id,
            outcome:           b.market_outcomes?.sort_order || 0,
            stake:             b.stake,
            shares:            b.shares,
            priceAtExecution:  b.price_at_execution,
            dbBetId:           b.id,
            dbOutcomeId:       b.market_outcome_id,
          }))
        }

        // Load outcome ID map for this round (so we can add more bets)
        const { data: outcomes } = await supabase
          .from('market_outcomes')
          .select('id, sort_order, market_id, markets!inner(round_id)')
          .eq('markets.round_id', round.id)

        if (outcomes?.length) {
          outcomes.forEach((o) => {
            dbOutcomeMap[`${o.market_id}_${o.sort_order}`] = o.id
          })
        }
      }

      result[comp.key] = {
        balance,
        roundNumber,
        stage,
        bets,
        roundId:      round?.id || null,
        walletId:     wallet?.id || null,
        dbOutcomeMap, // maps "marketDbId_outcomeIdx" → outcomeDbId
      }
    } catch (err) {
      console.error(`Error loading state for ${comp.key}:`, err)
    }
  }

  return result
}

// ── Initialise round + markets in DB (called lazily on first bet) ─────────────
export async function initRoundMarketsInDB(compKey, roundNum, seasonNum, markets) {
  const round = await getOrCreateRound(compKey, roundNum, seasonNum)
  if (!round) return { roundId: null, dbOutcomeMap: {} }

  // Check if markets already exist for this round
  const { data: existing } = await supabase
    .from('markets')
    .select('id, market_outcomes(id, sort_order)')
    .eq('round_id', round.id)

  if (existing?.length) {
    // Already initialised — rebuild the map using local market indices
    // Sort by market ID (ascending = creation order) to align with local market array
    const sorted = [...existing].sort((a, b) => a.id - b.id)
    const dbOutcomeMap = {}
    sorted.forEach((m, mi) => {
      m.market_outcomes?.sort((a, b) => a.sort_order - b.sort_order).forEach((o) => {
        dbOutcomeMap[`local_${mi}_${o.sort_order}`] = o.id
      })
    })
    return { roundId: round.id, dbOutcomeMap }
  }

  // Create markets and outcomes
  const dbOutcomeMap = {}

  for (let mi = 0; mi < markets.length; mi++) {
    const market = markets[mi]

    const { data: mRow, error: mErr } = await supabase
      .from('markets')
      .insert({
        round_id:    round.id,
        market_type: 'winner',
        liquidity_b: market.b,
        status:      'open',
      })
      .select()
      .single()

    if (mErr || !mRow) continue

    const outcomeRows = market.outcomes.map((label, oi) => ({
      market_id:  mRow.id,
      label,
      q:          market.q[oi],
      sort_order: oi,
    }))

    const { data: oRows } = await supabase
      .from('market_outcomes')
      .insert(outcomeRows)
      .select()

    oRows?.forEach((o) => {
      dbOutcomeMap[`${mRow.id}_${o.sort_order}`] = o.id
      // Also map by local market index for easy lookup
      dbOutcomeMap[`local_${mi}_${o.sort_order}`] = o.id
    })
  }

  return { roundId: round.id, dbOutcomeMap }
}

// ── Save a single bet to Supabase ─────────────────────────────────────────────
export async function saveBetToDB(userId, { roundId, competitionKey, outcomeDbId, stake, shares, priceAtExecution }) {
  // Get competition ID
  const { data: comp } = await supabase
    .from('competitions')
    .select('id')
    .eq('key', competitionKey)
    .maybeSingle()

  if (!comp) { console.error('saveBetToDB: competition not found:', competitionKey); return null }

  const { data, error } = await supabase
    .from('bets')
    .insert({
      user_id:            userId,
      market_outcome_id:  outcomeDbId,
      round_id:           roundId,
      competition_id:     comp.id,
      stake,
      shares,
      price_at_execution: priceAtExecution,
      settled:            false,
      void:               false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving bet:', error)
    return null
  }

  return data
}

// ── Settle bets after round results come in ───────────────────────────────────
export async function settleBetsInDB(userId, roundId, settledBets) {
  // settledBets: [{ dbBetId, payout }]
  if (!settledBets?.length) return

  const updates = settledBets.map((b) => ({
    id:      b.dbBetId,
    settled: true,
    payout:  b.payout,
  }))

  const { error } = await supabase
    .from('bets')
    .upsert(updates)

  if (error) console.error('Error settling bets:', error)
}

// ── Persist wallet balance ────────────────────────────────────────────────────
export async function persistBalance(userId, competitionKey, newBalance) {
  return updateWalletBalance(userId, competitionKey, newBalance)
}

// ── Apply weekly topup ────────────────────────────────────────────────────────
export async function applyRoundTopup(userId, competitionKey) {
  const wallet = await getOrCreateWallet(userId, competitionKey)
  if (!wallet) return null
  const newBalance = wallet.balance + WEEKLY_TOPUP
  return updateWalletBalance(userId, competitionKey, newBalance)
}

// ── Save round standings after settlement ─────────────────────────────────────
export async function persistRoundStandings(standings) {
  return saveRoundStandings(standings)
}

// ── Reset all wallets at season end ──────────────────────────────────────────
export async function resetSeasonBalances(competitionKey) {
  const { data: comp } = await supabase
    .from('competitions')
    .select('id')
    .eq('key', competitionKey)
    .single()

  if (!comp) return

  const { error } = await supabase
    .from('wallets')
    .update({ balance: 0, updated_at: new Date().toISOString() })
    .eq('competition_id', comp.id)

  if (error) console.error('Error resetting season balances:', error)
}
