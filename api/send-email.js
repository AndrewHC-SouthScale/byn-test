// api/send-email.js — Vercel serverless function
// Sends transactional emails via Resend
// Fetches active sponsor from Supabase and injects banner into all emails

const RESEND_API_KEY  = process.env.RESEND_API_KEY
const SUPABASE_URL    = process.env.SUPABASE_URL
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY
const FROM_ADDRESS    = 'BYN <noreply@bynapp.online>'

// ── Fetch active sponsor from Supabase ────────────────────────────────────────
async function getActiveSponsor() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.log('Sponsor fetch: missing env vars')
    return null
  }
  try {
    const url = `${SUPABASE_URL}/rest/v1/sponsor_slots?active=eq.true&placement=eq.email&limit=1&select=*`
    console.log('Fetching sponsor from:', url)
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    })
    console.log('Sponsor response status:', res.status)
    const data = await res.json()
    console.log('Sponsor data:', JSON.stringify(data))
    return data?.[0] || null
  } catch (err) {
    console.error('Sponsor fetch error:', err)
    return null
  }
}

// ── Build sponsor banner HTML ─────────────────────────────────────────────────
function sponsorBannerHTML(sponsor) {
  if (!sponsor) return ''

  const bg   = sponsor.bg_color   || '#16352A'
  const fg   = sponsor.text_color || '#F4F7F2'
  const name     = sponsor.name    || 'BYN'
  const tagline  = sponsor.tagline || ''
  const ctaText  = sponsor.cta_text || 'Find out more →'
  const ctaUrl   = sponsor.cta_url  || 'https://www.bynapp.online/app'

  return `
    <!-- Sponsor banner -->
    <div style="margin:28px 0 0; border-top:1px solid #1c5f3f; padding-top:20px;">
      <div style="font-size:10px; color:#5E8775; letter-spacing:1px; text-transform:uppercase; margin-bottom:10px; font-family:system-ui,sans-serif;">
        Sponsored
      </div>
      <div style="background:${bg}; border:1px solid #1c5f3f; border-radius:10px; padding:16px 18px;">
        <div style="font-family:'Space Grotesk',system-ui,sans-serif; font-size:14px; font-weight:700; color:${fg}; margin-bottom:4px;">
          ${name}
        </div>
        ${tagline ? `<div style="font-size:13px; color:#9DBFAF; margin-bottom:12px; font-family:system-ui,sans-serif;">${tagline}</div>` : ''}
        <a href="${ctaUrl}" style="display:inline-block; background:#2FA86C; color:#0A1F1A; font-weight:700; font-size:12px; padding:8px 16px; border-radius:8px; text-decoration:none; font-family:system-ui,sans-serif;">
          ${ctaText}
        </a>
      </div>
    </div>
  `
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' })
  }

  const { to, subject, html } = req.body

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' })
  }

  // Fetch sponsor in parallel (non-blocking — falls back to null if it fails)
  const sponsor = await getActiveSponsor()
  const banner  = sponsorBannerHTML(sponsor)

  // Inject sponsor banner at the marked position (above footer)
  const finalHtml = banner
    ? html.replace('<!-- SPONSOR_BANNER -->', banner)
    : html.replace('<!-- SPONSOR_BANNER -->', '')

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        html: finalHtml,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend error:', data)
      return res.status(response.status).json({ error: data })
    }

    return res.status(200).json({ success: true, id: data.id, sponsored: !!sponsor })
  } catch (err) {
    console.error('Error calling Resend:', err)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}
