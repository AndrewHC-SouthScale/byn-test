import { supabase } from './supabase.js'

// Generate a unique 6-char referral code
function generateReferralCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// Ensure a profile exists for the logged-in user.
// Called on every login — creates on first visit, returns existing on subsequent visits.
export async function ensureProfile(user) {
  if (!user) return null

  // Check if profile already exists
  const { data: existing, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = row not found, anything else is a real error
    console.error('Error fetching profile:', fetchError)
    return null
  }

  if (existing) {
    return existing
  }

  // First login — create profile
  const displayName =
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Player'

  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      display_name: displayName,
      email: user.email,
      referral_code: generateReferralCode(),
      country: null,          // set by user after login
      date_of_birth: null,    // set by user after login
    })
    .select()
    .single()

  if (insertError) {
    console.error('Error creating profile:', insertError)
    return null
  }

  return newProfile
}

// Load a profile by user ID
export async function loadProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error loading profile:', error)
    return null
  }

  return data
}

// Update profile fields
export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating profile:', error)
    return null
  }

  return data
}

// Apply a referral code at signup
// Returns true if valid and applied, false otherwise
export async function applyReferralCode(code, newUserId) {
  if (!code || !newUserId) return false

  // Find the referrer by code
  const { data: referrer, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', code.toUpperCase())
    .single()

  if (error || !referrer) return false

  // Don't allow self-referral
  if (referrer.id === newUserId) return false

  // Record the referral (wallet bonuses applied separately)
  const { error: refError } = await supabase
    .from('referrals')
    .insert({
      referrer_id: referrer.id,
      referee_id: newUserId,
      bonus_amount: 500,
    })

  if (refError) {
    console.error('Error recording referral:', refError)
    return false
  }

  return true
}
