# BYN — Project Backlog

A running list of tasks, ideas, and improvements. Items are grouped by category and roughly prioritised within each group. Move items to the pre-launch checklist in `decisions.md` when they become blockers.

---

## 🔴 In progress / immediate

- [x] Set up Resend for transactional email (`noreply@bynapp.online` sending, welcome and round settled emails live)
- [ ] Fix southscale.co.uk legal page routing (404 on `/legal/byn-privacy` and `/legal/byn-terms`)

---

## 🟣 User account management

- [ ] **Delete Account button** — add to Profile tab. On confirmation, schedule account for deletion after a 60-day cooling-off period. During this period the Google account cannot be reused to create a new BYN account. After 60 days, all personal data is purged from Supabase. User should receive a confirmation email at deletion request and a reminder before the 60 days expires. Required for GDPR compliance (right to erasure).

---

## 🟤 API & performance

- [ ] **Reduce live odds API calls** — the Odds API should only be called once per round at round start, to fetch fixtures and seed opening odds into the LMSR. After that, all pricing is driven by user bets. Currently the API is disabled during testing (`return []` in `oddsService.js`) but when re-enabled, add a check: only fetch if the current round has no bets placed yet and has not already been seeded (`cd.liveSeeded === false`). Cache the result in Supabase so re-fetching on page refresh doesn't cost API credits.

---

## 🟠 Backend

- [ ] **Apple Sign In** — required before App Store submission (App Store Guideline 4.8)
- [ ] **Stripe integration** — league slot purchases (packs of 3), company-sponsored leagues
- [ ] **Scheduled jobs** — server-side lockout enforcement (currently demo button only), auto-settlement after results come in, weekly topup at round start
- [ ] **Real bot management** — remove bot simulation from App.jsx before go-live (see pre-launch checklist)
- [ ] **Transfer Supabase** to SouthScale business account once incorporated
- [ ] **Server-side ad verification** — verify ad completion via ad network callback before crediting nuts (currently client-side only)
- [ ] **Push notifications** — lockout reminders, settlement alerts (mobile only, defer to native app)
- [ ] **Re-enable Odds API** — remove early `return []` in `oddsService.js` when ready to go live
- [ ] **Upgrade Odds API plan** — free tier is 500 requests/month, upgrade before live

---

## 🟡 Features

- [ ] **Ad network integration** — wire up Google AdMob (mobile) or Google Ad Manager (web) for the nuts boost ad views
- [ ] **Company-sponsored leagues** — businesses pay to create branded leagues, don't count against player cap
- [ ] **In-play market updates** — update prices during live events (requires websocket or polling)
- [ ] **Outright winner markets** — season-long competition winner (e.g. who wins the EPL) alongside weekly round markets
- [ ] **Position selling** — allow users to sell back a bet before lockout
- [ ] **Shareable result cards** — generate a shareable image after round settlement showing wins/losses
- [ ] **Stats page** — personal performance stats, best picks, historical balance charts
- [ ] **Notifications centre** — in-app notification history (round results, league activity)

---

## 🟢 Sports & competitions

- [ ] **Re-enable live odds** when EPL/La Liga/NFL seasons start (August/September) — odds API already wired, just remove the `return []`
- [ ] **Set real season lengths** — EPL = 38, La Liga = 38, NFL = 17, replace `SEASON_LENGTH_DEMO = 4`
- [ ] **MotoGP** — activate when API coverage available
- [ ] **NASCAR** — activate when API coverage available
- [ ] **NBA** — activate when NBA season starts (October)
- [ ] **ATP/WTA** — rename from Wimbledon to correct tournament name after Wimbledon ends
- [ ] **The Open** — rename PGA after The Open concludes
- [ ] **World Cup** — revert to `three_way` format (with Draw) for group stage next tournament
- [ ] **Champions League** — activate for 2026/27 season
- [ ] **Six Nations** — activate for 2027 tournament (February)
- [ ] **Rugby World Cup** — activate for 2027 tournament

---

## 🔵 UI / UX

## 🛠️ Internal admin & reporting

- [ ] **Admin reporting dashboard** — internal-only page (not linked anywhere public) showing key platform metrics. Suggested location: `southscale.co.uk/admin` or `bynapp.online/admin` — both work since neither will be linked publicly. Should be password protected (simple hardcoded password or Vercel password protection is fine for internal use). Suggested metrics to include:
  - **Users** — total registered, new this week/month, active (placed a bet in last 30 days), inactive
  - **Competitions** — active users per competition, bets placed per round, average stake
  - **Leagues** — total private leagues, members per league, most active leagues
  - **Emails** — emails sent (via Resend dashboard API)
  - **Engagement** — ad boost views this week, referrals used
  - **Platform health** — rounds currently open, rounds settled this week, any unsettled bets older than 48hrs
  - All data pulled directly from Supabase via a read-only service role key (not the anon key)
  - Built as a standalone HTML page or simple React app, NOT part of byn-test
  - Consider Vercel Password Protection (available on Pro plan) or a simple login check before exposing data

- [ ] **Remove demo simulator buttons** — "Simulate results", "Advance to lockout" etc. before go-live
- [ ] **Landing page for bynapp.online** — currently serves the app directly; add a proper landing page for organic visitors with download links and screenshots
- [ ] **Kickoff time display** — show match kickoff time on each fixture card
- [ ] **Bet history tab** — view all past bets within a competition, not just current round
- [ ] **Onboarding tour** — guided first-time user experience (highlight key features on first login)
- [ ] **Dark/light mode** — currently dark only
- [ ] **Profile photo** — pull from Google account and display in header
- [ ] **League chat** — simple message thread within a private league

---

## ⚙️ Infrastructure & accounts

- [x] **Set up Resend** — `noreply@bynapp.online` sending, welcome email and round settled email wired up
- [ ] **Set up Google Workspace** or confirm M365 suffices for all business email needs
- [ ] **Incorporate SouthScale** — Companies House registration (£50, 24-48 hours)
- [ ] **Update legal documents** — add registered address and company number once incorporated
- [ ] **Transfer Supabase** — to SouthScale business account post-incorporation
- [ ] **GDPR / ICO registration** — register with ICO as a data controller (required if processing UK personal data commercially, £40/year for small organisations)
- [ ] **App Store Connect account** — set up Apple Developer account ($99/year) to begin iOS submission process
- [ ] **Google Play Console account** — set up for Android submission ($25 one-time)

---

## 💡 Ideas (unvalidated)

- **Prediction streaks** — bonus nuts for consecutive correct predictions
- **Head-to-head challenges** — challenge a specific friend to the same market
- **Tipster leaderboard** — separate ranking for best single-round return (not cumulative)
- **Expert picks** — optional "pundit mode" where featured users' picks are highlighted
- **Watch party mode** — live updates during events showing how prices are moving in real time
- **BYN Wrapped** — end-of-season summary card (Spotify Wrapped style) showing your best moments
- **API for third-party leagues** — allow companies to embed a BYN league widget in their own apps
- **Crypto nuts** — optional NFT-backed nuts for users who want provable scarcity (much later, if ever)

---

## ✅ Completed

- [x] Full mock platform with LMSR pricing
- [x] Google OAuth login (new user setup + returning user flow)
- [x] User profiles persisting to Supabase
- [x] Wallet balances persisting to Supabase
- [x] Bets saving to Supabase
- [x] Bet settlement writing to DB
- [x] Season reset (balances + leaderboards)
- [x] Live odds from The Odds API (World Cup, Wimbledon ATP/WTA, The Open)
- [x] Unique display names with normalised uniqueness check
- [x] Referral system (500 nuts each)
- [x] Ad boost (50 nuts per view, 1000/round cap)
- [x] Private leagues with invite codes
- [x] Profile tab with user info, favourite teams, league slots, ad boost
- [x] Rankings with global / country / team filters
- [x] Deployed to bynapp.online via Vercel
- [x] GitHub transferred to SouthScale-HQ
- [x] Google Cloud transferred to andrew@southscale.co.uk
- [x] SouthScale company website live at southscale.co.uk
- [x] Privacy Policy and Terms of Service drafted and hosted
- [x] Transactional email via Resend — welcome email and round settled email sending from noreply@bynapp.online
