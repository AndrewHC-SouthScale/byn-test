// api/send-email.js — Vercel serverless function
// Called by the browser, calls Resend server-side
// API key never exposed to the client

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' })
  }

  const { to, subject, html } = req.body

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' })
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BYN <noreply@bynapp.online>',
        to: [to],
        subject,
        html,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend error:', data)
      return res.status(response.status).json({ error: data })
    }

    return res.status(200).json({ success: true, id: data.id })
  } catch (err) {
    console.error('Error calling Resend:', err)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}
