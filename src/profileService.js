import { supabase } from './supabase.js'

// Generate a unique 6-char referral code
function generateReferralCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// Normalise a display name for comparison:
// - trim leading/trailing spaces
// - collapse multiple spaces into one
// - remove characters that aren't letters, numbers, spaces or hyphens
// - lowercase for comparison only (stored name keeps original casing)
export function normaliseName(name) {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-]/g, '')
    .toLowerCase()
}

// Check if a display name is already taken (normalised comparison)
export async function isDisplayNameTaken(name) {
  if (!name?.trim()) return false
  const normalised = normaliseName(name)
  if (!normalised) return false

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('display_name_normalised', normalised)
    .maybeSingle()

  if (error) return false
  return !!data
}

// Ensure a profile exists for the logged-in user.
// Called on every login — creates on first visit, returns existing on subsequent visits.
export async function ensureProfile(user, displayName = null) {
  if (!user) return null

  const { data: existing, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error fetching profile:', fetchError)
    return null
  }

  if (existing) return existing

  const chosenName = displayName?.trim() ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Player'

  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      display_name: chosenName,
      display_name_normalised: normaliseName(chosenName),
      email: user.email,
      referral_code: generateReferralCode(),
      country: null,
      date_of_birth: null,
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
export async function applyReferralCode(code, newUserId) {
  if (!code || !newUserId) return false

  const { data: referrer, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', code.toUpperCase())
    .single()

  if (error || !referrer) return false
  if (referrer.id === newUserId) return false

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
