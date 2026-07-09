// emailService.js — BYN transactional email via Resend
// Emails are sent via /api/send-email (Vercel serverless function)
// which calls Resend server-side, keeping the API key secure

const FROM_ADDRESS = 'BYN <noreply@bynapp.online>'
const SUPPORT_ADDRESS = 'support@bynapp.online'

// ── Base send function ────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Email send error:', error)
      return null
    }

    return await response.json()
  } catch (err) {
    console.error('Error sending email:', err)
    return null
  }
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const baseStyle = `
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: #0A1F1A;
  color: #F4F7F2;
  margin: 0;
  padding: 0;
`

function emailWrapper(content) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>BYN</title>
    </head>
    <body style="${baseStyle}">
      <div style="max-width:560px; margin:0 auto; padding:32px 24px;">

        <!-- Header -->
        <div style="margin-bottom:32px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:10px;">
                <svg viewBox="0 0 80 80" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
                  <rect x="0" y="0" width="80" height="80" rx="18" fill="#2FA86C"/>
                  <polygon points="40,14 63,27 63,53 40,66 17,53 17,27" fill="none" stroke="#0A1F1A" stroke-width="2.5"/>
                  <circle cx="40" cy="40" r="10" fill="none" stroke="#0A1F1A" stroke-width="2.5"/>
                </svg>
              </td>
              <td>
                <span style="font-family:'Space Grotesk',system-ui,sans-serif; font-weight:700; font-size:20px; color:#F4F7F2; letter-spacing:1px;">BYN</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Content -->
        ${content}

        __SPONSOR_BANNER__

        <!-- Footer -->
        <div style="margin-top:40px; padding-top:24px; border-top:1px solid #1c5f3f; font-size:12px; color:#5E8775; line-height:1.6;">
          <p style="margin:0 0 6px;">
            BYN is play-money only — no real money, ever.
          </p>
          <p style="margin:0 0 6px;">
            Questions? <a href="mailto:${SUPPORT_ADDRESS}" style="color:#7FBFA0; text-decoration:none;">${SUPPORT_ADDRESS}</a>
          </p>
          <p style="margin:0;">
            <a href="https://bynapp.online" style="color:#7FBFA0; text-decoration:none;">bynapp.online</a>
            &nbsp;·&nbsp;
            <a href="https://southscale.co.uk/legal/byn-privacy" style="color:#5E8775; text-decoration:none;">Privacy Policy</a>
            &nbsp;·&nbsp;
            <a href="https://southscale.co.uk/legal/byn-terms" style="color:#5E8775; text-decoration:none;">Terms of Service</a>
          </p>
          <p style="margin:8px 0 0; color:#3a5a4a;">
            © 2026 SouthScale (in incorporation)
          </p>
        </div>

      </div>
    </body>
    </html>
  `
}

// ── 1. Welcome email ──────────────────────────────────────────────────────────
export async function sendWelcomeEmail({ to, displayName }) {
  const html = emailWrapper(`
    <h1 style="font-size:24px; font-weight:700; margin:0 0 8px; color:#F4F7F2;">
      Welcome to BYN, ${displayName} 🎉
    </h1>
    <p style="font-size:15px; color:#9DBFAF; margin:0 0 24px;">
      No real money — just bragging rights.
    </p>

    <div style="background:#16352A; border:1px solid #1c5f3f; border-radius:12px; padding:24px; margin-bottom:24px;">
      <p style="margin:0 0 14px; font-size:14px; color:#D9E5DE;">Here's how BYN works:</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#7FBFA0; width:24px;">🥜</td>
          <td style="padding:6px 0; font-size:14px; color:#D9E5DE;">You get <strong style="color:#2FA86C;">1,000 nuts</strong> at the start of every round</td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#7FBFA0;">📊</td>
          <td style="padding:6px 0; font-size:14px; color:#D9E5DE;">Stake nuts on real sporting events — odds move as others bet</td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#7FBFA0;">🔒</td>
          <td style="padding:6px 0; font-size:14px; color:#D9E5DE;">You must stake at least <strong style="color:#F4F7F2;">50%</strong> before lockout or forfeit the shortfall</td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#7FBFA0;">🏆</td>
          <td style="padding:6px 0; font-size:14px; color:#D9E5DE;">Winnings carry forward — build your balance across the season</td>
        </tr>
      </table>
    </div>

    <a href="https://bynapp.online" style="display:inline-block; background:#2FA86C; color:#0A1F1A; font-weight:700; font-size:15px; padding:14px 28px; border-radius:10px; text-decoration:none;">
      Start playing →
    </a>
  `)

  return sendEmail({
    to,
    subject: `Welcome to BYN, ${displayName}!`,
    html,
  })
}

// ── 2. Lockout reminder ───────────────────────────────────────────────────────
export async function sendLockoutReminderEmail({ to, displayName, competitionName, committed, required, balance, minutesUntilLockout }) {
  const shortfall = Math.max(0, required - committed)
  const pct = Math.round((committed / required) * 100)

  const html = emailWrapper(`
    <h1 style="font-size:22px; font-weight:700; margin:0 0 6px; color:#F4F7F2;">
      ⏰ Lockout in ${minutesUntilLockout} minutes
    </h1>
    <p style="font-size:15px; color:#9DBFAF; margin:0 0 24px;">
      ${competitionName} — you haven't met your minimum stake yet.
    </p>

    <div style="background:#2B1E15; border:1px solid #7a5d28; border-radius:12px; padding:24px; margin-bottom:24px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#9DBFAF;">Staked so far</td>
          <td style="padding:6px 0; font-size:14px; color:#F4F7F2; text-align:right; font-weight:600;">${committed.toLocaleString()} nuts</td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#9DBFAF;">Minimum required</td>
          <td style="padding:6px 0; font-size:14px; color:#F4F7F2; text-align:right; font-weight:600;">${required.toLocaleString()} nuts</td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#E0998F;">Shortfall if you don't act</td>
          <td style="padding:6px 0; font-size:14px; color:#E0998F; text-align:right; font-weight:700;">${shortfall.toLocaleString()} nuts forfeited</td>
        </tr>
      </table>

      <!-- Progress bar -->
      <div style="margin-top:16px; background:#1c3020; border-radius:999px; height:8px; overflow:hidden;">
        <div style="background:#E07B2A; width:${Math.min(pct, 100)}%; height:8px; border-radius:999px;"></div>
      </div>
      <p style="margin:6px 0 0; font-size:12px; color:#9DBFAF;">${pct}% of minimum staked</p>
    </div>

    <a href="https://bynapp.online" style="display:inline-block; background:#2FA86C; color:#0A1F1A; font-weight:700; font-size:15px; padding:14px 28px; border-radius:10px; text-decoration:none;">
      Place bets now →
    </a>

    <p style="margin:16px 0 0; font-size:13px; color:#5E8775;">
      Markets lock automatically when the first fixture kicks off. After that, no more bets can be placed.
    </p>
  `)

  return sendEmail({
    to,
    subject: `⏰ ${minutesUntilLockout} mins to lockout — ${shortfall.toLocaleString()} nuts at risk`,
    html,
  })
}

// ── 4. Account deletion confirmation ─────────────────────────────────────────
export async function sendDeletionConfirmationEmail({ to, displayName, scheduledFor }) {
  const deletionDate = new Date(scheduledFor).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  const html = emailWrapper(`
    <h1 style="font-size:22px; font-weight:700; margin:0 0 6px; color:#F4F7F2;">
      Account deletion requested
    </h1>
    <p style="font-size:15px; color:#9DBFAF; margin:0 0 24px;">
      Hi ${displayName} — we've received your request to delete your BYN account.
    </p>

    <div style="background:#2B1E15; border:1px solid #7a5d28; border-radius:12px; padding:24px; margin-bottom:24px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#9DBFAF;">Deletion requested</td>
          <td style="padding:6px 0; font-size:14px; color:#F4F7F2; text-align:right; font-weight:600;">${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#9DBFAF;">Account deleted on</td>
          <td style="padding:6px 0; font-size:14px; color:#E0998F; text-align:right; font-weight:700;">${deletionDate}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:14px; color:#D9E5DE; margin:0 0 14px;">
      Your account will remain active until <strong style="color:#F4F7F2;">${deletionDate}</strong>. You can continue using BYN during this period.
    </p>
    <p style="font-size:14px; color:#D9E5DE; margin:0 0 14px;">
      If you change your mind, you can cancel the deletion request from your profile at any time before this date.
    </p>
    <p style="font-size:14px; color:#D9E5DE; margin:0 0 24px;">
      After ${deletionDate}, all your personal data will be permanently deleted from our systems in line with our Privacy Policy. Your Google account will not be able to create a new BYN account for 60 days from the deletion date.
    </p>

    <a href="https://bynapp.online" style="display:inline-block; background:#2FA86C; color:#0A1F1A; font-weight:700; font-size:15px; padding:14px 28px; border-radius:10px; text-decoration:none;">
      Cancel deletion request →
    </a>

    <p style="margin:16px 0 0; font-size:13px; color:#5E8775;">
      If you didn't request this, contact us immediately at <a href="mailto:${SUPPORT_ADDRESS}" style="color:#7FBFA0;">${SUPPORT_ADDRESS}</a>.
    </p>
  `)

  return sendEmail({
    to,
    subject: `Your BYN account is scheduled for deletion on ${deletionDate}`,
    html,
  })
}

// ── 5. Account deletion reminder (sent before 60 days expires) ────────────────
export async function sendDeletionReminderEmail({ to, displayName, scheduledFor }) {
  const deletionDate = new Date(scheduledFor).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  const html = emailWrapper(`
    <h1 style="font-size:22px; font-weight:700; margin:0 0 6px; color:#F4F7F2;">
      ⚠️ Your account is being deleted in 7 days
    </h1>
    <p style="font-size:15px; color:#9DBFAF; margin:0 0 24px;">
      Hi ${displayName} — this is a reminder that your BYN account is scheduled to be permanently deleted on <strong style="color:#E0998F;">${deletionDate}</strong>.
    </p>

    <p style="font-size:14px; color:#D9E5DE; margin:0 0 14px;">
      After this date, all your data — including your profile, bets, and standings — will be permanently removed from our systems.
    </p>
    <p style="font-size:14px; color:#D9E5DE; margin:0 0 24px;">
      If you've changed your mind, you can cancel the deletion request from your profile before the deadline.
    </p>

    <a href="https://bynapp.online" style="display:inline-block; background:#2FA86C; color:#0A1F1A; font-weight:700; font-size:15px; padding:14px 28px; border-radius:10px; text-decoration:none;">
      Cancel deletion and keep my account →
    </a>
  `)

  return sendEmail({
    to,
    subject: `⚠️ Your BYN account is being deleted on ${deletionDate}`,
    html,
  })
}
export async function sendRoundSettledEmail({ to, displayName, competitionName, roundNumber, endingBalance, payout }) {
  const roundedBalance = Math.round(endingBalance)
  const roundedPayout  = Math.round(payout)
  const won = roundedPayout > 0

  const html = emailWrapper(`
    <h1 style="font-size:22px; font-weight:700; margin:0 0 6px; color:#F4F7F2;">
      Round ${roundNumber} settled
    </h1>
    <p style="font-size:15px; color:#9DBFAF; margin:0 0 24px;">
      ${competitionName} — here's how you did.
    </p>

    <div style="background:#16352A; border:1px solid #1c5f3f; border-radius:12px; padding:24px; margin-bottom:24px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="padding:8px 0; font-size:14px; color:#9DBFAF;">Round payout</td>
          <td style="padding:8px 0; font-size:14px; text-align:right; font-weight:700; color:${won ? '#2FA86C' : '#9DBFAF'};">
            ${won ? '+' : ''}${roundedPayout.toLocaleString()} nuts
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-size:14px; color:#9DBFAF; border-top:1px solid #1c5f3f;">Balance after round</td>
          <td style="padding:8px 0; font-size:20px; text-align:right; font-weight:700; color:#F4F7F2; border-top:1px solid #1c5f3f;">
            ${roundedBalance.toLocaleString()} nuts
          </td>
        </tr>
      </table>
    </div>

    <a href="https://bynapp.online/app" style="display:inline-block; background:#2FA86C; color:#0A1F1A; font-weight:700; font-size:15px; padding:14px 28px; border-radius:10px; text-decoration:none;">
      View results &amp; bet next round →
    </a>
  `)

  return sendEmail({
    to,
    subject: `Round ${roundNumber} settled — See your results`,
    html,
  })
}
