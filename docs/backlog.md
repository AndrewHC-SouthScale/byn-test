# BYN — Project Backlog

A running list of tasks, ideas, and improvements. Items are grouped by category and roughly prioritised within each group. Move items to the pre-launch checklist in `decisions.md` when they become blockers.

---

## 🔴 In progress / immediate

- [x] Set up Resend for transactional email (`noreply@bynapp.online` sending, welcome and round settled emails live)
- [x] Fix southscale.co.uk legal page routing (404 on `/legal/byn-privacy` and `/legal/byn-terms`)

---

## 🟣 User account management

- [x] **Delete Account button** — added to Profile tab with 60-day cooling-off period, confirmation email, and cancel option. Google account blocked from re-registration during cooling-off period.
- [x] **Privacy Policy link** — added to Profile tab linking to southscale.co.uk/legal/byn-privacy
- [x] **Terms of Service link** — added to Profile tab linking to southscale.co.uk/legal/byn-terms

---

## 📊 Data models & probability

- [ ] **MotoGP probability model** — similar to F1 model. Research free MotoGP data API (motogp.com/api or similar). Components: current season championship points (50%), previous season standings (30%), circuit/track history (20%). Only needed when MotoGP is activated — The Odds API doesn't cover it.
- [ ] **NASCAR probability model** — track history is especially important in NASCAR (drivers have very different strengths by track type: superspeedways, short tracks, road courses). Research free NASCAR data API. Components: current season points (40%), previous season (20%), track-specific history (40% — higher weight than other sports).
- [ ] **NBA probability model** — only needed if The Odds API doesn't cover NBA when activated in Oct 2026. BallDontLie API (balldontlie.io) is free and covers NBA standings and game results. Components: current season win % (50%), home/away record (20%), head-to-head recent form (30%).
- [ ] **Sports not on The Odds API** — EPL, La Liga, World Cup, NFL, ATP, WTA, The Open, Champions League are all covered by The Odds API with de-vigged bookmaker probabilities — no model needed, bookmaker odds are better than anything we'd build. Only build models for sports The Odds API doesn't cover (F1 ✅, MotoGP, NASCAR, potentially rugby/cricket leagues).
- [ ] **Six Nations / Premiership Rugby probability model** — research free rugby data API. Components: current tournament standings (50%), historical H2H between these two teams (30%), home advantage (20%).
- [ ] **IPL probability model** — research free cricket API (cricbuzz, cricketdata.org). Components: current tournament form (50%), venue/pitch history (30%), team H2H (20%).

- [x] **Reduce live odds API calls** — fixtures now cached in Supabase `round_fixtures` table. API called once per competition per round only. Subsequent loads (page refresh, re-navigation) read from cache. Cache valid for 24 hours. API skipped entirely if round already seeded (`cd.liveSeeded === true`).
- [x] **F1 alternative odds source** — live at bynapp.online/app under Motorsport → F1. Uses OpenF1 (free, no API key) for real race name, circuit, location and kickoff time. Top 8 drivers shown with championship-based probabilities. Update `DRIVERS_2026` in `api/f1-fixtures.js` as season progresses.

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

- [ ] **Slow initial load** — Vercel edge cache headers added (repeat visits now instant). Bundle is 125KB gzipped. Further reduction options: replace `lucide-react` with inline SVGs (~50KB saving), or replace Supabase JS client with direct fetch calls (~150KB saving). Defer until user feedback indicates load time is a real problem.
- [x] **Round nuts to whole numbers** — `Math.round()` already applied consistently throughout the display layer. Confirmed no decimal values showing in UI.

## 🛠️ Internal admin & reporting

- [x] **Admin reporting dashboard** — live at southscale.co.uk/admin. Password protected. Shows users, bets, competitions, rounds, leagues, engagement, and platform health. Data pulled from Supabase via service role key through Vercel serverless function. Not linked publicly.

- [ ] **Remove demo simulator buttons** — "Simulate results", "Advance to lockout" etc. before go-live
- [x] **Landing page for bynapp.online** — live at bynapp.online root. App served at bynapp.online/app. Includes phone mockup, how it works, sports list, features, and App Store/Google Play placeholders.
- [ ] **Kickoff time display** — `formatKickoff()` function built and wired into market cards (betting and settled stages). Shows "Today 20:00", "Tomorrow 15:00", "Sat 12 Jul 17:30" etc. **Needs verification once Odds API is re-enabled** — demo fixtures have no kickoff data so times only appear with live fixtures.
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
- [x] Delete Account button on Profile tab — 60-day cooling-off, confirmation email, cancel option
- [x] Privacy Policy and Terms of Service links added to Profile tab
- [x] southscale.co.uk legal page routing fixed
- [x] Live odds API calls reduced — fixtures cached in Supabase, API called once per round per competition only
- [x] Admin reporting dashboard live at southscale.co.uk/admin
