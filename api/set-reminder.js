// api/set-reminder.js — Vercel serverless function
// Stores a fixture reminder and sends confirmation email

const SUPABASE_URL  = process.env.SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_KEY    = process.env.RESEND_API_KEY
const FROM_ADDRESS  = 'BYN <noreply@bynapp.online>'

async function dbInsert(body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/reminders`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(body),
  })
  return res.ok
}

async function sendEmail({ to, subject, html }) {
  if (!RESEND_KEY) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, email, displayName, competitionKey, competitionName, fixtureDate } = req.body
  if (!userId || !email || !competitionKey || !fixtureDate) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const fixture = new Date(fixtureDate)
  const reminderDate = new Date(fixture.getTime() - 7 * 24 * 60 * 60 * 1000)

  try {
    // Store in Supabase — upsert so one reminder per user per competition
    await dbInsert({
      user_id: userId,
      email,
      competition_key: competitionKey,
      competition_name: competitionName,
      fixture_date: fixtureDate,
      reminder_date: reminderDate.toISOString(),
      sent: false,
    })

    // Format dates for email
    const fixtureFormatted = fixture.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const reminderFormatted = reminderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    // Send confirmation email
    await sendEmail({
      to: email,
      subject: `Reminder set — ${competitionName} starts ${fixtureFormatted}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="background:#0A1F1A;color:#F4F7F2;font-family:system-ui,sans-serif;padding:32px;max-width:560px;margin:0 auto;">
          <div style="margin-bottom:24px;">
            <span style="font-family:'Space Grotesk',system-ui,sans-serif;font-weight:700;font-size:18px;letter-spacing:1px;">BYN</span>
          </div>
          <h2 style="color:#F4F7F2;margin:0 0 8px;">You're on the list 🔔</h2>
          <p style="color:#9DBFAF;margin:0 0 24px;">Hi ${displayName || 'there'} — we'll remind you before ${competitionName} kicks off.</p>
          <div style="background:#16352A;border:1px solid #1c5f3f;border-radius:12px;padding:20px;margin-bottom:24px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#9DBFAF;">Competition</td>
                <td style="padding:6px 0;font-size:14px;text-align:right;font-weight:700;color:#F4F7F2;">${competitionName}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#9DBFAF;">Fixtures start</td>
                <td style="padding:6px 0;font-size:14px;text-align:right;font-weight:700;color:#F4F7F2;">${fixtureFormatted}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#9DBFAF;border-top:1px solid #1c5f3f;">We'll remind you on</td>
                <td style="padding:6px 0;font-size:14px;text-align:right;font-weight:700;color:#2FA86C;border-top:1px solid #1c5f3f;">${reminderFormatted}</td>
              </tr>
            </table>
          </div>
          <a href="https://bynapp.online/app" style="display:inline-block;background:#2FA86C;color:#0A1F1A;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;">
            View all competitions →
          </a>
          <p style="margin-top:24px;font-size:12px;color:#5E8775;">
            BYN is play-money only — no real money, ever. 
            <a href="https://bynapp.online/app" style="color:#5E8775;">Unsubscribe</a>
          </p>
        </body>
        </html>
      `,
    })

    return res.status(200).json({ success: true, reminderDate: reminderDate.toISOString() })
  } catch (err) {
    console.error('Set reminder error:', err)
    return res.status(500).json({ error: err.message })
  }
}
