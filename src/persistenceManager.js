import { supabase } from './supabase.js'
import { getOrCreateWallet, updateWalletBalance } from './walletService.js'
import { getOrCreateRound, saveMarketState, saveRoundStandings, loadCurrentRound } from './roundService.js'

const WEEKLY_TOPUP = 1000

// Load all persisted state for a user when they log in
// Returns an object matching the shape of compData in App.jsx
export async function loadUserState(userId, competitions) {
  const result = {}

  for (const comp of competitions) {
    if (!comp.active) continue

    try {
      // Load wallet
      const wallet = await getOrCreateWallet(userId, comp.key)
      const balance = wallet?.balance || 0

      // Load current round
      const round = await loadCurrentRound(comp.key)
      const roundNumber = round?.round_number || 1
      const stage = round?.status || 'betting'

      // Load bets for current round
      let bets = []
      if (round?.id) {
        const { data } = await supabase
          .from('bets')
          .select('*, market_outcomes(id, label, market_id, q)')
          .eq('user_id', userId)
          .eq('round_id', round.id)
          .eq('settled', false)
          .eq('void', false)

        bets = data || []
      }

      result[comp.key] = {
        balance,
        roundNumber,
        stage,
        bets,
        roundId: round?.id || null,
        walletId: wallet?.id || null,
      }
    } catch (err) {
      console.error(`Error loading state for ${comp.key}:`, err)
    }
  }

  return result
}

// Save wallet balance after a round settles or a bet is placed
export async function persistBalance(userId, competitionKey, newBalance) {
  return updateWalletBalance(userId, competitionKey, newBalance)
}

// Apply weekly topup at round start
export async function applyRoundTopup(userId, competitionKey) {
  const wallet = await getOrCreateWallet(userId, competitionKey)
  if (!wallet) return null
  const newBalance = wallet.balance + WEEKLY_TOPUP
  return updateWalletBalance(userId, competitionKey, newBalance)
}

// Save market LMSR q values after a bet moves the market
export async function persistMarketState(marketId, outcomes) {
  return saveMarketState(marketId, outcomes)
}

// Save round standings after settlement
export async function persistRoundStandings(standings) {
  return saveRoundStandings(standings)
}

// Reset all wallets for a competition at season end
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
