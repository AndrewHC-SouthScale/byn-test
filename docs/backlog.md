# BYN — Project Backlog

A running list of tasks, ideas, and improvements. Items are grouped by category and roughly prioritised within each group.

---

## 🟣 User account management

- [x] **Delete Account button** — added to Profile tab with 60-day cooling-off period, confirmation email, and cancel option.
- [x] **Privacy Policy link** — added to Profile tab linking to southscale.co.uk/legal/byn-privacy
- [x] **Terms of Service link** — added to Profile tab linking to southscale.co.uk/legal/byn-terms
- [ ] **Per-league ranking in settlement email** — round settled email currently shows balance and payout only. Add ranking breakdown per league the user is in (global, country, private leagues). Show as a table: "Global: 14th · England: 3rd · The Lads: 1st 🏆".

---

## 📊 Data models & probability

- [x] **Own probability models for all sports** — removed all dependency on The Odds API. Built in-house models for all competitions:
  - Football: FIFA rankings + ELO model (FIFA WC, Euros, EPL, La Liga, UCL)
  - Rugby (international): World Rugby rankings API (free) + H2H (Nations Championship ✅, Rugby Championship ✅, Six Nations ✅, Rugby WC ✅)
  - Rugby (club): Team strength ratings (URC ✅, Prem Rugby ✅, Super Rugby Pacific ✅)
  - F1: OpenF1 (free, no key) + championship standings probability model ✅
  - Tennis: ATP/WTA rankings + grass surface adjustment (Wimbledon ✅)
  - Golf: OWGR + course/links history (The Open ✅)
  - NFL: Team power ratings ✅
- [ ] **MotoGP probability model** — research free MotoGP data API. Components: championship points (50%), previous season (30%), circuit history (20%).
- [ ] **NASCAR probability model** — track history weighted heavily (40%). Research free NASCAR data API.
- [ ] **NBA probability model** — activate October 2026. BallDontLie API (free) covers standings and results. Components: win % (50%), home/away record (20%), H2H form (30%).
- [ ] **IPL probability model** — research free cricket API (cricbuzz, cricketdata.org). Components: form (50%), venue/pitch history (30%), H2H (20%).
- [ ] **F1 demo simulation limitation** — demo rounds always show current next real-world race. Expected behaviour — rounds advance with real race weekends in production.

---

## 🟠 Backend

- [ ] **Apple Sign In** — required before App Store submission (App Store Guideline 4.8)
- [ ] **Stripe integration** — league slot purchases (packs of 3), company-sponsored leagues
- [ ] **Scheduled jobs** — server-side lockout enforcement, auto-settlement after results, weekly topup at round start
- [ ] **Real bot management** — remove bot simulation from App.jsx before go-live
- [ ] **Transfer Supabase** to SouthScale business account once incorporated
- [ ] **Server-side ad verification** — verify ad completion via ad network callback before crediting nuts
- [ ] **Push notifications** — lockout reminders, settlement alerts (defer to native app)
- [ ] **Reminder cron job** — `reminders` table stores user reminders with `reminder_date` and `sent: false`. Need scheduled job to send email 7 days before fixture and mark `sent: true`. Options: Vercel Cron (Pro plan), GitHub Actions schedule, or Supabase pg_cron.
- [ ] **Set real season lengths** — EPL = 38, La Liga = 38, NFL = 17, replace `SEASON_LENGTH_DEMO = 4`
- [ ] **Remove demo simulator buttons** — "Simulate results", "Advance to lockout" before go-live

---

## 🟡 Features

- [ ] **Ad network integration** — wire up Google AdMob (mobile) or Google Ad Manager (web) for nuts boost ad views
- [ ] **Company-sponsored leagues** — businesses pay to create branded leagues
- [ ] **In-play market updates** — update prices during live events (websocket or polling)
- [ ] **Outright winner markets** — season-long competition winner alongside weekly round markets
- [ ] **Position selling** — allow users to sell back a bet before lockout
- [ ] **Shareable result cards** — generate shareable image after settlement
- [ ] **Stats page** — personal performance stats, best picks, historical balance charts
- [ ] **Notifications centre** — in-app notification history (round results, league activity)

---

## 🟢 Sports & competitions

- [ ] **Wimbledon → rename** — update tennis competition name to US Open / Australian Open when tournament changes
- [ ] **The Open → rename** — update PGA competition name after The Open concludes
- [ ] **MotoGP** — activate when probability model is built
- [ ] **NASCAR** — activate when probability model is built
- [ ] **NBA** — activate October 2026
- [ ] **Update NFL fixtures** — GW1 fixtures are placeholders, update when official schedule released
- [ ] **Update Premiership Rugby fixtures** — fixture list releasing July 2026, update `PREM_FIXTURES` in `rugby-fixtures.js`
- [ ] **Update URC fixtures** — full round-by-round schedule available, add rounds 2+ to `URC_FIXTURES`
- [ ] **Champions League** — activate September 2026
- [ ] **Six Nations** — activate February 2027
- [ ] **Super Rugby Pacific** — activate February 2027
- [ ] **Rugby World Cup** — activate 2027

---

## 🔵 UI / UX

- [ ] **Slow initial load** — bundle is 125KB gzipped. Vercel edge cache added. Further options: replace lucide-react with inline SVGs, or replace Supabase JS client with direct fetch.
- [x] **Round nuts to whole numbers** — `Math.round()` applied throughout display layer.
- [ ] **Kickoff time display** — working for F1 and all models. Needs verification once more competitions have live fixtures.
- [ ] **Bet history tab** — view all past bets within a competition, not just current round
- [ ] **Onboarding tour** — guided first-time user experience on first login
- [ ] **Dark/light mode** — currently dark only
- [ ] **Profile photo** — pull from Google account and display in header
- [ ] **League chat** — simple message thread within a private league

---

## 🛠️ Internal admin & reporting

- [x] **Admin dashboard** — live at southscale.co.uk/admin. Three tabs: Dashboard (auto-refreshes every 5 min), Fixtures (all competitions with next date, server-side proxy to avoid CORS), Backlog (live from GitHub). Password protected.
- [x] **Landing page** — live at bynapp.online. App served at bynapp.online/app.
- [x] **Remind Me feature** — "No fixtures" card shows next fixture date and Remind Me button. Stores reminder in Supabase, sends confirmation email. Browser notification permission requested.

---

## ⚙️ Infrastructure & accounts

- [x] **Resend email** — `noreply@bynapp.online`, welcome + settlement emails live, sponsor banner injected from Supabase
- [ ] **Set up Google Workspace** or confirm M365 suffices for business email
- [ ] **Incorporate SouthScale** — Companies House (£50, 24-48 hours)
- [ ] **Update legal documents** — add registered address and company number once incorporated
- [ ] **Transfer Supabase** — to SouthScale business account post-incorporation
- [ ] **GDPR / ICO registration** — register with ICO as data controller (£40/year)
- [ ] **App Store Connect account** — Apple Developer ($99/year)
- [ ] **Google Play Console** — Android submission ($25 one-time)

---

## 💡 Ideas (unvalidated)

- **Prediction streaks** — bonus nuts for consecutive correct predictions
- **Head-to-head challenges** — challenge a specific friend to the same market
- **Tipster leaderboard** — separate ranking for best single-round return (not cumulative)
- **Expert picks** — optional "pundit mode" where featured users' picks are highlighted
- **Watch party mode** — live updates during events showing how prices are moving
- **BYN Wrapped** — end-of-season summary card (Spotify Wrapped style)
- **API for third-party leagues** — allow companies to embed a BYN league widget

---

## ✅ Completed

- [x] Full platform with LMSR pricing, Google OAuth, profiles, wallets, bets, settlement — all persisting to Supabase
- [x] Season reset (balances + leaderboards)
- [x] Referral system and ad boost
- [x] Private leagues with invite codes
- [x] Deployed to bynapp.online via Vercel, GitHub under SouthScale-HQ
- [x] SouthScale company website and legal pages live at southscale.co.uk
- [x] Transactional email via Resend — welcome, settlement, deletion, reminder confirmation
- [x] Sponsor banner in all emails — fetched from `sponsor_slots` table
- [x] Delete Account button — 60-day cooling-off, GDPR compliant
- [x] Fixture caching in Supabase — one API/model call per competition per round
- [x] Own probability models for all sports — no Odds API dependency
- [x] F1 — OpenF1 + championship model, all 22 drivers, correct 2026 grid
- [x] Rugby — World Rugby rankings model, Nations Championship + Rugby Championship fixtures
- [x] All rugby competitions with fixtures: URC, Prem Rugby, Six Nations, Super Rugby, Rugby WC
- [x] Football model — FIFA rankings + ELO, FIFA WC live QFs, EPL/La Liga/UCL GW1
- [x] Tennis model — ATP/WTA rankings, Wimbledon SFs/Finals
- [x] Golf model — OWGR + links course history, The Open field
- [x] NFL model — team power ratings, season schedule
- [x] Admin dashboard with auto-refresh, fixtures tab, backlog tab
- [x] All competitions shown (no active flag restriction), grouped by sport in pizza stack menu
- [x] No fixtures card with next date and Remind Me button (email reminder + browser permission)
- [x] Simplified navigation — 3 competition buttons, pizza stack menu grouped by category
- [x] Rankings and Leagues tabs with full details
- [x] Landing page at bynapp.online with phone mockup, features, sports list
