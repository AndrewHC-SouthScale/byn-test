// api/cancel-deletion.js — Vercel serverless function
// Cancels a pending deletion request

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' })
  }

  try {
    const { error } = await supabase
      .from('pending_deletions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('status', 'pending')

    if (error) {
      console.error('Error cancelling deletion:', error)
      return res.status(500).json({ error: 'Failed to cancel deletion' })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
