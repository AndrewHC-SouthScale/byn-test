// api/request-deletion.js — Vercel serverless function
// Records a deletion request in Supabase and sends confirmation email

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_ADDRESS = 'BYN <noreply@bynapp.online>'

async function sendEmail({ to, subject, html }) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, email, displayName, googleProviderId } = req.body

  if (!userId || !email) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const scheduledFor = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

  try {
    // Check if a pending deletion already exists
    const { data: existing } = await supabase
      .from('pending_deletions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      return res.status(409).json({ error: 'Deletion already requested' })
    }

    // Insert deletion request
    const { error: insertError } = await supabase
      .from('pending_deletions')
      .insert({
        user_id: userId,
        email,
        google_provider_id: googleProviderId || null,
        scheduled_for: scheduledFor,
        status: 'pending',
      })

    if (insertError) {
      console.error('Error inserting deletion request:', insertError)
      return res.status(500).json({ error: 'Failed to record deletion request' })
    }

    // Send confirmation email
    const deletionDate = new Date(scheduledFor).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    })

    await sendEmail({
      to: email,
      subject: `Your BYN account is scheduled for deletion on ${deletionDate}`,
      html: `
        <!DOCTYPE html><html><body style="background:#0A1F1A;color:#F4F7F2;font-family:system-ui,sans-serif;padding:32px;max-width:560px;margin:0 auto;">
        <h2 style="color:#F4F7F2;">Account deletion requested</h2>
        <p style="color:#9DBFAF;">Hi ${displayName} — we've received your request to delete your BYN account.</p>
        <div style="background:#2B1E15;border:1px solid #7a5d28;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 8px;color:#9DBFAF;">Your account will be permanently deleted on:</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:#E0998F;">${deletionDate}</p>
        </div>
        <p style="color:#D9E5DE;">You can continue using BYN until this date. To cancel the deletion, go to your profile in the app.</p>
        <p style="color:#D9E5DE;">After deletion, your Google account cannot be used to create a new BYN account for 60 days.</p>
        <a href="https://bynapp.online" style="display:inline-block;background:#2FA86C;color:#0A1F1A;font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none;margin-top:16px;">Cancel deletion request →</a>
        <p style="color:#5E8775;font-size:12px;margin-top:24px;">If you didn't request this, contact support@bynapp.online immediately.</p>
        </body></html>
      `,
    })

    return res.status(200).json({ success: true, scheduledFor })
  } catch (err) {
    console.error('Error requesting deletion:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
