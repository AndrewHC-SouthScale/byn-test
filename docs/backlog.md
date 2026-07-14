# BYN — Project Backlog

A running list of tasks, ideas, and improvements. Items are grouped by category and roughly prioritised within each group.

---

## 🚀 Path to launch (sequenced)

Rough dependency order for getting to a credible Google Play submission. Each phase unblocks the next — items within a phase can happen in parallel.

**Phase 1 — Make multiplayer real** (nothing after this matters if this isn't true)
0. **Results feed spike** (NEW — prerequisite to #1) — there is currently no real results data anywhere in the codebase; all existing model files (`football-model.js`, `rugby-fixtures.js`, `f1-fixtures.js`) generate pre-match probabilities only. Auto-settlement can't be built until this exists. Note: odds bundled into a provider's response are irrelevant/ignorable — BYN generates its own LMSR-driven odds regardless. **Paid options ruled out — free only.**
   - **Confirmed for Phase 1 — 5 competitions:** EPL, La Liga, UCL, Championship (all via football-data.org's free-forever tier — 12 competitions covered permanently, no cost) + F1 (via OpenF1's `session_result` endpoint, already integrated). **Auto-settlement scope shrunk to these 5 for Phase 1** so the multiplayer foundation isn't blocked on harder-to-source competitions.
   - **Deferred to Phase 1b — Rugby (all 5 active comps) + lower English football:** Nations Championship, Rugby Championship, URC, Prem Rugby, Super Rugby Pacific, League One, League Two, National League. Set `active: false` in `constants.js`. **PulseLive checked and ruled out** — the only endpoint in use (`/rugby/v3/rankings/mru`) is pure power-rankings data (team/points/position), structurally has no fixture or result fields. A related unofficial `cmsapi.pulselive.com` endpoint (found via an old third-party project, not documented/supported) returned 401 and isn't a viable path either. No free results source identified yet for rugby or the lower football divisions — needs fresh research when this phase is picked back up.
   - **Still needed: flip `active = false` for all 8 of the above in Supabase `competitions` table too** — `constants.js` alone only hides them from the UI menus; the DB flag is what the admin Fixtures tab and any future queries key off. SQL:
     ```sql
     UPDATE competitions
     SET active = false
     WHERE key IN ('league_one', 'league_two', 'national_league', 'prem_rugby', 'urc', 'super_rugby', 'nations_champ', 'rugby_champ');
     ```
   - Output of this spike: confirmed provider(s) per competition + a `fixtures.result` column populated by a small sync job, before the settlement job itself is built.
1. **Auto-settlement job — ✅ DEPLOYED.** Single server-side result per round instead of per-browser `Math.random()`, scoped to EPL/La Liga/Championship/F1. Live via `settle-rounds` Edge Function on a `pg_cron` schedule (every 15 min). See Backend section for the one open follow-up (rotating a leaked `service_role` key). Confirmed decisions:
   - **Void handling**: postponed/cancelled fixtures refund the stake (not treated as a win or loss), per the schema notes' resolved design.
   - **Matching window**: round's fixture date ± 1 day (2 days on the far side), to safely catch late kickoffs/VAR delays without missing a result.
   - **Match key**: football-data.org team ID (never name matching) — see `football-data-team-ids.js`. An unmapped team name is a hard error for that round, not a silent skip.
   - **Idempotency**: `betting_rounds.status` flips to `'settled'` only as the very last step, after standings are saved — if the job crashes mid-run, the round stays `'locked'` and retries cleanly next cycle rather than double-paying.
   - **Guard**: a round only settles once every market in it has a real result (finished or void) — never partially settled.

   **Two real gaps surfaced while writing this, need follow-up before deploy, not silently worked around:**
   - **F1 outcome matching — FIXED.** `market_outcomes.external_ref` now stores OpenF1's `driver_number` at market creation time (`persistenceManager.initRoundMarketsInDB`), flowing through from `f1-fixtures.js` → `oddsService.js` → `App.jsx`'s market seeding. Settlement matches on this ID, never on the label string. **`markets.external_session_key` — FIXED.** Confirmed missing via a direct schema query (`SELECT column_name FROM information_schema.columns WHERE table_name = 'markets'` — only had `id, event_id, market_type, liquidity_b, status, created_at, round_id`, no external reference at all). Added via `add-external-session-key-migration.sql`, populated in `persistenceManager.js` by parsing the session key out of `market.externalId`'s existing `f1-{sessionKey}` format. **Both migrations (`add-external-ref-migration.sql` and `add-external-session-key-migration.sql`) must be run before deploying the current `settle-rounds` Edge Function** — it assumes both columns exist.
   - **No fixture-date column on `betting_rounds`/`markets`** — the draft job proxies the matching window off `betting_rounds.created_at` ("when the round was created in DB"), which may not equal "when its fixtures actually kick off" if a round is created ahead of time. Works for now since rounds appear to be created close to kickoff, but a `betting_rounds.fixture_window_start` column would make this exact instead of approximate. Worth confirming against real timing data before relying on it long-term.
2. **Persist leagues to Supabase** (Backend) — `groups`/`group_members` tables, replacing React state.
3. **Add `profiles.country`** (Backend) — small, but needed alongside #2 for real leaderboard filtering.
4. **Real bot management** (Backend) — remove/replace bot simulation now that real cross-user standings exist.
5. **Ad network integration** (Features → moved up) — wire real AdMob/Google Ad Manager now, not post-launch. The ad-boost button already exists in the UI promising "watch an ad, get 50 nuts" but isn't connected to a real network yet — that's a promise the app isn't keeping. More importantly, ad-boost is the primary revenue mechanism per the schema notes, not a bolt-on feature; launching without it and adding it in later reads to users as a bait-and-switch ("used to be ad-free, now it's not") rather than "how the app has always worked." Ship it as part of the core experience from day one.

**Phase 1b — Rugby + lower English football back online**
- Find a free (or otherwise acceptable) results source for rugby and League One/Two/National League — see notes under #0 above for what's already been ruled out.
- Re-activate in both `constants.js` and Supabase `competitions` table once found.
- Extend auto-settlement job to cover these competitions.

**Phase 2 — Trust & compliance**
- **Age gating** — replace self-declared checkbox with captured DOB + server-side age check (17+, per schema notes on Apple's simulated-gambling rating; Google Play IARC will land similarly).
- **Incorporate SouthScale** (Companies House, £50) — unblocks business-owned accounts and a real entity behind the store listing.
- **ICO registration** (£40/year).
- **Transfer Supabase to SouthScale business account.**

**Phase 3 — Store-readiness cleanup**
- **Remove demo simulator buttons** ("Advance to lockout", "Simulate results").
- **Set real season lengths** — replace `SEASON_LENGTH_DEMO = 4`.
- **Reminder cron job** — finish this now that scheduled jobs infra exists from Phase 1.
- **Server-side ad verification** (Backend — firmed up, no longer optional) — verify ad completion via ad network callback before crediting nuts. Given ads are now a Phase 1 launch item rather than deferred, this is required, not "if ads ship at launch."

**Phase 4 — Store submission**
- Apple Sign In only matters if targeting iOS App Store — **not required for Google Play**, so it can move after launch if Play is the near-term target.
- Google Play listing, store assets, IARC content questionnaire.

**Explicitly deferred, not blockers:**
- Stripe / league slot purchases — monetization can follow initial launch.
- Push notifications, in-play market updates, position selling, stats page — feature work, not launch blockers.
- Per-league ranking in settlement email — depends on Phase 1 items #1–3, naturally falls out once those land, no separate push needed.

---

## 🟣 User account management

- [x] **Delete Account button** — added to Profile tab with 60-day cooling-off period, confirmation email, and cancel option.
- [x] **Privacy Policy link** — added to Profile tab linking to southscale.co.uk/legal/byn-privacy
- [x] **Terms of Service link** — added to Profile tab linking to southscale.co.uk/legal/byn-terms
- [ ] **Per-league ranking in settlement email** — round settled email currently shows balance and payout only. Add ranking breakdown per league the user is in (global, country, private leagues). Show as a table: "Global: 14th · England: 3rd · The Lads: 1st 🏆". **Blocked on:**
  - Auto-settlement job (see Backend) — results are currently resolved client-side per-browser via `Math.random()`, so there's no single shared outcome per round for a ranking to be computed against, and `saveRoundStandings()` (already written in `roundService.js`) is never actually called.
  - `groups`/`group_members` tables don't exist yet — leagues currently live only in React state (`App.jsx`), not Supabase.
  - `profiles.country` doesn't exist yet — country is currently local state only.
  - Once unblocked: add global/country/per-league rank queries against `round_standings`, wire into settlement flow before the `sendRoundSettledEmail` call in `App.jsx` (~line 805), extend email template + `sendRoundSettledEmail()` signature in `emailService.js`.

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

- [ ] **URGENT — rotate/replace leaked `service_role` key** — the legacy `service_role` key was pasted in plaintext during the cron setup session (2026-07). Recommended fix: don't attempt to rotate the legacy key directly (its relationship to the newer JWT Signing Keys rotation UI is ambiguous — rotating the signing key affects newly-issued Auth tokens, not necessarily the static legacy `anon`/`service_role` strings). Instead, **migrate off it entirely**: generate a new `sb_secret_...` key via Supabase's "Publishable and secret API keys" tab, then update everywhere `SUPABASE_SERVICE_ROLE_KEY` is used — Vercel env vars for both `byn-test` and `southscale-web`, and the `settle-rounds-every-15-min` cron job's Authorization header (`cron.alter_job()` or drop/recreate). Once nothing references the old key, the leak becomes moot regardless of whether it's technically still valid. **First task to pick up next session.**
- [ ] **Apple Sign In** — required before App Store submission (App Store Guideline 4.8)
- [ ] **Stripe integration** — league slot purchases (packs of 3), company-sponsored leagues
- [x] **Scheduled jobs — auto-settlement** — deployed. `settle-rounds` Edge Function live, scheduled via `pg_cron` every 15 min (job `settle-rounds-every-15-min`). Covers EPL/La Liga/Championship/F1 (see Path to launch Phase 1 for full design history). Lockout enforcement and weekly topup at round start are still not built — only auto-settlement is done.
- [ ] **Persist leagues to Supabase** — `groups` (private leagues) currently live only in React state in `App.jsx` (`useState([])`), never written to the DB. Need real `groups` and `group_members` tables (name, invite code, status, member list) so leagues survive a page refresh and are queryable server-side (required for per-league settlement email ranking, admin visibility, etc).
- [ ] **Add `profiles.country`** — country is currently local/client state only, not a DB column. Needed for real "country" leaderboard filtering server-side (currently done by filtering an in-memory array that includes simulated bots).
- [ ] **Real bot management** — remove bot simulation from App.jsx before go-live
- [ ] **Transfer Supabase** to SouthScale business account once incorporated
- [ ] **Server-side ad verification** — verify ad completion via ad network callback before crediting nuts. **Required for launch, not optional** — see Path to launch Phase 3.
- [ ] **Push notifications** — lockout reminders, settlement alerts (defer to native app)
- [ ] **Reminder cron job** — `reminders` table stores user reminders with `reminder_date` and `sent: false`. Need scheduled job to send email 7 days before fixture and mark `sent: true`. Options: Vercel Cron (Pro plan), GitHub Actions schedule, or Supabase pg_cron.
- [ ] **Set real season lengths** — EPL = 38, La Liga = 38, NFL = 17, replace `SEASON_LENGTH_DEMO = 4`
- [ ] **Remove demo simulator buttons** — "Simulate results", "Advance to lockout" before go-live

---

## 🟡 Features

- [ ] **Ad network integration** — wire up Google AdMob (mobile) or Google Ad Manager (web) for nuts boost ad views. **Now sequenced as Phase 1 of Path to launch, not deferred** — see top of doc.
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
- [x] **English football pyramid expanded** — Championship, League One, League Two, National League added. All 24 teams per division with full GW1 fixtures (12 matches each). Correct 2026-27 team rosters: relegated/promoted clubs accurately reflected. Probability models use team strength ratings from 2025-26 season performance. All start Aug 14-16, 2026. Admin fixtures report updated to include all 4 leagues.
- [ ] **Update EFL fixtures when released** — Championship GW1 released June 25 (partially confirmed: Wolves vs Blackburn, Burnley vs West Ham). When exact GW1 fixtures are published, update `FIXTURES.championship`, `FIXTURES.league_one`, `FIXTURES.league_two`, `FIXTURES.national_league` in `api/football-model.js`. Update team ratings after first few rounds to reflect actual form. **Note: League One, League Two, National League set `active: false` in `constants.js`** — deferred to Path to launch Phase 1b, no free results API found for these divisions yet. Championship stays active (covered free by football-data.org). Matching Supabase update SQL is in Phase 1b.
- [ ] **Update Premiership Rugby fixtures** — fixture list releasing July 2026, update `PREM_FIXTURES` in `rugby-fixtures.js`. **Note: all 5 active rugby competitions (Prem Rugby, URC, Super Rugby Pacific, Nations Championship, Rugby Championship) set `active: false` in `constants.js`** — deferred to Path to launch Phase 1b. PulseLive checked and ruled out as a results source (rankings-only endpoint, no fixture/result data); no free alternative found yet. Matching Supabase update SQL is in Phase 1b.
- [ ] **Update URC fixtures** — full round-by-round schedule available, add rounds 2+ to `URC_FIXTURES`. Same Phase 1b deactivation as above applies.
- [ ] **Champions League** — activate September 2026
- [ ] **Six Nations** — activate February 2027
- [ ] **Super Rugby Pacific** — activate February 2027
- [ ] **Rugby World Cup** — activate 2027

---

## 🔵 UI / UX

- [ ] **Slow initial load** — bundle is 125KB gzipped. Vercel edge cache added. Further options: replace lucide-react with inline SVGs, or replace Supabase JS client with direct fetch.
- [x] **Round nuts to whole numbers** — `Math.round()` applied throughout display layer.
- [x] **Show odds at bet placement** — `BetList` now displays the probability (%) and payout multiplier (x) captured at bet time (`priceAtExecution`), alongside stake, so users can see how odds have moved if they consider betting the same outcome again later. Data was already being captured and persisted (`price_at_execution` in `bets` table) — this was a display-only gap.
- [ ] **Bets not reloaded from DB on refresh** — found while adding odds-at-placement above. `cd.bets` is only populated on the client at the moment a bet is placed; there's no code path that re-fetches a user's existing bets from Supabase on page load/refresh mid-round. A refresh during the betting window silently empties the visible bet list (DB rows and committed stake still persist correctly, so this looks display-only — worth confirming against `betService.js` before fixing).
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

- **Club partnership revenue share** — partner with amateur and lower-tier football clubs (League One, League Two, non-league) to drive user acquisition via a club code mechanism.
  - **Club code**: unique short code (e.g. `COVCITY`) assigned per partner club. Captured at sign-up (after Google OAuth, before profile creation). Stored as `club_code` on `profiles` table. Also passable as URL param `?club=COVCITY` to pre-fill.
  - **Revenue model**: BYN shares X% (suggest 20–30%) of all lifetime revenue from referred users — ad views, league slot purchases, future subscriptions. Club earns as long as their fans are active.
  - **Active user tracking**: define "active" as ≥1 bet placed in last 30 days. Monthly snapshot job queries `bets` grouped by `club_code`, counts distinct `user_id`. Store in `club_activity_snapshots` table (club_code, month, active_users, total_bets, estimated_revenue).
  - **Revenue attribution**: estimate per-user revenue as (ad views × rate) + (purchases × value). Apply club share % to get monthly payout per club.
  - **Club dashboard**: read-only page showing referred users, active count, estimated earnings — tab in southscale admin or separate partner portal.
  - **Scale path**: 2–3 pilot clubs → prove model → pitch to EFL → Premier League community trust departments.
  - **Key questions**: share % threshold, minimum payout amount, attribution window (lifetime vs rolling 12 months), handling users who enter multiple club codes.
  - **Marketing kit** — produce a ready-to-use pack for each partner club so they can promote BYN to their fanbase with minimal effort:
    - Email template (Resend-compatible HTML) pre-written with club name/logo slot, CTA linking to `bynapp.online?club=CLUBCODE`
    - Social media graphics (Instagram square, Twitter/X banner, Facebook cover) in BYN brand colours with club branding overlay
    - Digital matchday programme ad (A5 landscape, print-ready PDF)
    - Landing page variant at `bynapp.online/club/CLUBCODE` — co-branded, shows club name/crest, explains BYN, pre-fills club code at sign-up
    - WhatsApp/SMS template (short link + 1-line pitch) for fan groups and club comms
  - **Club portal** — lightweight web portal (could live at `partners.bynapp.online` or a tab in southscale admin) giving each club a read-only view of their performance:
    - Total referred users (all time)
    - Active users this month (placed ≥1 bet in 30 days)
    - Estimated revenue this month and cumulative
    - Monthly trend chart (active users and estimated earnings over time)
    - Their unique referral link and QR code for download
    - Pending and paid earnings history
    - Access via simple email-based login (magic link) — no password management needed

- **First-bet advert per round** — show an ad when a user places their first bet in a new betting round. High-engagement moment — user is invested and paying attention.
  - **Trigger**: detect `cd.bets.length === 0` before the bet is placed and `cd.stage === 'betting'`. After bet is confirmed, show ad modal before returning to market view.
  - **Format**: fullscreen overlay with 5-second countdown then "Continue" button. Or rewarded format where watching earns bonus nuts (aligns with existing ad boost mechanic).
  - **Frequency cap**: once per round per competition — not once per session. User playing EPL and Nations Championship sees at most 2 ads (one per competition's first bet).
  - **Implementation**: add `firstBetAdShown: false` to competition state. Set `true` after first ad shown. Reset on `nextRound()`.
  - **Revenue**: integrate with Google AdMob (mobile) or Google Ad Manager (web) when ready. Rewarded video typically £0.01–£0.05 per view.

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

---

## 📅 Recent session — July 10-11, 2026

### Completed ✅
- [x] **Football competitions fixed** — resolved syntax error in `football-model.js` (missing `ucl:` key caused entire module to fail). All football competitions now returning correct fixture data.
- [x] **90-day fixture window** — all model endpoints (football, rugby, NFL) now look 90 days ahead so upcoming seasons (EPL Aug 21, Championship Aug 14, UCL Sep 16) appear in both app and admin.
- [x] **Champions League full fixtures** — expanded from 4 to 18 Matchday 1 fixtures (36-team league phase format). UCL ratings expanded to cover all 36 clubs.
- [x] **English football pyramid** — Championship, League One, League Two, National League added with full 24-team squads, 12-match GW1 fixtures, and team strength ratings.
- [x] **Competitions reduced to Football / Rugby / F1** — deactivated Tennis, Golf, NFL, NBA, IPL, MotoGP, NASCAR, FIFA WC 26, Euros, Rugby WC. 14 active competitions remain.
- [x] **Menu and competition row filter** — only active competitions shown in pizza stack menu and top row buttons. Inactive competitions no longer visible to users.
- [x] **Super Rugby renamed** — "Super Rugby" → "Super Rugby Pacific" in constants.js, Supabase, and admin fixtures.
- [x] **Admin fixtures split into two sections** — Active on BYN (14) and Not currently active (10), each sorted by next fixture date.

### To reactivate when ready
- FIFA WC 26 — set `active: true` in `constants.js` and Supabase. Fixtures and model already built.
- Tennis (Wimbledon) — set `active: true`. Model built with ATP/WTA rankings.
- Golf (The Open) — set `active: true`. Model built with OWGR field.
- NFL — set `active: true` (activate September 2026). Model built.
- Euros — 2028 season. Set active when closer.
