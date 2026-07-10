# BYN — Project Handoff Document
*Last updated: July 10, 2026*

---

## What is BYN?

**BYN (Bet Your Nuts)** is a play-money sports prediction market platform. No real money — ever. Users receive 1,000 virtual credits ("nuts") per round, must stake at least 50% before lockout, and winnings carry forward across rounds. Pricing is driven by an LMSR model seeded from our own probability models, then moved by user bets.

- **Live app:** https://www.bynapp.online/app
- **Landing page:** https://www.bynapp.online
- **Admin dashboard:** https://southscale.co.uk/admin (password protected)
- **Company site:** https://southscale.co.uk
- **GitHub:** https://github.com/SouthScale-HQ/byn-test (byn-test repo) and southscale-web repo

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite 5.4, hosted on Vercel |
| Auth | Supabase Auth (Google OAuth) |
| Database | Supabase (Postgres), project: `rmpkwgmtwuzwyhguqmld.supabase.co` |
| Email | Resend via Vercel serverless (`/api/send-email.js`) |
| Serverless functions | Vercel (`/api/*.js`) |
| Domain | bynapp.online (GoDaddy DNS → Vercel) |
| Rugby data | OpenF1 (free, F1 only) + World Rugby PulseLive API (free) |
| Node | v24 local, pinned to 20 in .nvmrc for Vercel |

---

## Repository Structure

### byn-test (main app)
```
byn-test/
├── src/
│   ├── App.jsx                # Main React app (~2100 lines)
│   ├── main.jsx
│   ├── supabase.js
│   ├── constants.js           # All competitions, team pools, game config
│   ├── oddsService.js         # Routes competitions to model endpoints
│   ├── emailService.js        # Email templates (Resend)
│   ├── profileService.js
│   ├── walletService.js
│   ├── betService.js
│   ├── roundService.js
│   └── persistenceManager.js
├── api/                       # Vercel serverless functions
│   ├── send-email.js          # Email sending + sponsor banner injection
│   ├── f1-fixtures.js         # F1 data via OpenF1
│   ├── rugby-fixtures.js      # Rugby probability model (Nations Champ, Rugby Champ, Six Nations, URC, Prem, Super Rugby)
│   ├── football-model.js      # Football model (FIFA WC, EPL, La Liga, Championship, League One, League Two, National League, UCL, Euros)
│   ├── tennis-model.js        # Tennis (Wimbledon/Grand Slams)
│   ├── golf-model.js          # Golf (The Open/Majors)
│   ├── nfl-model.js           # NFL
│   ├── set-reminder.js        # Fixture reminders
│   ├── request-deletion.js    # GDPR account deletion
│   └── cancel-deletion.js     # Cancel deletion
├── public/
│   ├── favicon.svg
│   └── landing.html           # Marketing landing page at bynapp.online/
├── docs/
│   ├── handoff.md             # This file
│   ├── backlog.md             # Full product backlog
│   ├── schema.md              # Database schema
│   ├── decisions.md           # Architecture decisions log
│   ├── sports-calendar.md     # Season dates, Odds API keys, activation dates
│   └── tester-guide.md
└── vercel.json                # Routes: / → landing.html, /api/* → serverless, /* → index.html
```

### southscale-web (company site + admin)
```
southscale-web/
├── index.html                 # Company homepage
├── package.json
├── vercel.json
├── api/
│   ├── admin-stats.js         # Admin dashboard stats (Supabase queries)
│   └── admin-fixtures.js      # Fixtures proxy (calls bynapp.online models server-side)
├── admin/
│   └── index.html             # Password-protected admin dashboard (3 tabs: Dashboard, Fixtures, Backlog)
└── legal/
    ├── byn-privacy.html
    └── byn-terms.html
```

---

## Environment Variables

### Vercel — byn-test project
| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (browser) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (browser) |
| `RESEND_API_KEY` | Resend email API key (server-side, no VITE_ prefix) |
| `SUPABASE_URL` | Supabase URL (server-side for serverless functions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `API_SPORTS_KEY` | API-Sports key (not currently used — free plan lacks current season) |
| `RUGBY_API_KEY` | Highlightly Rugby API key (not currently used — using own model) |

### Vercel — southscale-web project
| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase URL (for admin-stats and admin-fixtures) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `ADMIN_PASSWORD` | Password to access admin dashboard |

---

## Database (Supabase) — Key Tables

| Table | Purpose |
|---|---|
| `profiles` | User display names, country, avatar, referral codes |
| `sport_categories` | Football, Rugby, Tennis, etc. |
| `competitions` | All competitions with `active` flag |
| `wallets` | User balance per competition |
| `betting_rounds` | Round status (open/locked/settled) per competition |
| `events` | Fixtures within a round |
| `markets` | Market per fixture (e.g. home/draw/away) |
| `market_outcomes` | Each outcome with LMSR q values |
| `bets` | User bets with stake, shares, settled flag, payout |
| `round_standings` | Leaderboard per round per competition |
| `groups` | Private leagues with invite codes |
| `group_members` | User ↔ league membership |
| `ad_views` | Ad boost tracking |
| `referrals` | Referral tracking |
| `sponsor_slots` | Email sponsor banners (active slot injected into all emails) |
| `pending_deletions` | GDPR 60-day deletion cooling-off |
| `reminders` | Fixture reminder subscriptions (user, competition, reminder_date, sent) |
| `round_fixtures` | Fixture cache (competition_id, round_number, fixtures JSONB) |

---

## Active Competitions (July 2026)

| Competition | Key | Format | Season |
|---|---|---|---|
| Premier League | `epl` | three_way | Starts Aug 21 2026 |
| Championship | `championship` | three_way | Starts Aug 14 2026 |
| League One | `league_one` | three_way | Starts Aug 14 2026 |
| League Two | `league_two` | three_way | Starts Aug 14 2026 |
| National League | `national_league` | three_way | Starts Aug 16 2026 |
| La Liga | `laliga` | three_way | Starts Aug 2026 |
| Champions League | `ucl` | three_way | Starts Sep 2026 |
| FIFA WC 26 | `fifa_wc` | three_way_no_draw | Live — QFs |
| Euros | `euros` | three_way | 2028 |
| Nations Championship | `nations_champ` | three_way | Live — Jul–Nov 2026 |
| Rugby Championship | `rugby_champ` | three_way | Starts Aug 2026 |
| Six Nations | `six_nations` | three_way | Feb 2027 |
| URC | `urc` | three_way | Starts Sep 2026 |
| Premiership Rugby | `prem_rugby` | three_way | Starts Sep 2026 |
| Super Rugby Pacific | `super_rugby` | three_way_no_draw | Feb 2027 |
| Rugby World Cup | `rugby_wc` | three_way | 2027 |
| NFL | `nfl` | three_way_no_draw | Starts Sep 2026 |
| Wimbledon (ATP+WTA combined) | `tennis` | three_way_no_draw | Finals week |
| The Open | `pga` | outright | Jul 16–19 2026 |
| F1 | `f1` | outright | Belgian GP Jul 18 2026 |
| NBA | `nba` | three_way_no_draw | Oct 2026 |
| IPL | `ipl` | three_way | Mar 2027 |
| MotoGP | `motogp` | outright | Inactive |
| NASCAR | `nascar` | outright | Inactive |

---

## Probability Models — Architecture

All models are built in-house. No dependency on The Odds API or any paid external service.

| Sport | Model file | Data source |
|---|---|---|
| F1 | `/api/f1-fixtures.js` | OpenF1 free API + 2026 championship standings |
| International rugby | `/api/rugby-fixtures.js` | World Rugby PulseLive rankings (free, no key) + H2H records |
| Club rugby | `/api/rugby-fixtures.js` | Hardcoded team strength ratings |
| Football (international) | `/api/football-model.js` | FIFA ranking points + ELO model |
| Football (club) | `/api/football-model.js` | Team strength ratings from 2025-26 season |
| Tennis | `/api/tennis-model.js` | ATP/WTA rankings + grass court adjustment |
| Golf | `/api/golf-model.js` | OWGR rankings + links course history |
| NFL | `/api/nfl-model.js` | Team power ratings + home advantage |

---

## Game Logic Summary

- **Round flow:** Open → Locked (1hr before first event) → Results → Settled → Next round
- **LMSR pricing:** `q` values set from model probabilities, then move with bets. Formula: `p[i] = exp(q[i]/b) / sum(exp(q[j]/b))`
- **Minimum commitment:** 50% of total balance must be staked before lockout. Shortfall is forfeited.
- **Payouts:** Stake × (1/probability at time of bet). Locked in at bet time.
- **Season reset:** Balances clear to 0 at season end. Round standings persist as history.
- **Demo mode:** Simulator buttons (Advance to lockout, Simulate results) remain for testing. Remove before go-live.

---

## Email (Resend)

Sending domain: `noreply@bynapp.online`

All emails routed through `/api/send-email.js` (server-side, no CORS). Sponsor banner automatically injected from `sponsor_slots` table above the footer footer.

Email types in `src/emailService.js`:
1. **Welcome** — on new user setup completion
2. **Round settled** — after results simulated/confirmed. Subject: "Round X settled — See your results"
3. **Deletion confirmation** — on account deletion request
4. **Deletion reminder** — 7 days before 60-day cooling-off expires
5. **Reminder confirmation** — when user sets a fixture reminder

---

## Admin Dashboard (southscale.co.uk/admin)

Password protected. Three tabs:
- **Dashboard** — auto-refreshes every 5 minutes. Shows users, bets, competitions, rounds, leagues, health alerts.
- **Fixtures** — all competitions with next fixture date. Fetched via `/api/admin-fixtures.js` which proxies to bynapp.online model endpoints server-side.
- **Backlog** — live from `docs/backlog.md` on GitHub main branch.

---

## Key Architecture Decisions

1. **No external odds API** — all probabilities generated in-house. Eliminates cost and dependency.
2. **Fixture caching** — `round_fixtures` Supabase table caches model output. Model called once per competition per round.
3. **Server-side email** — all email via `/api/send-email.js` to avoid CORS and keep Resend key off the browser.
4. **All competitions shown** — `active` flag still exists in constants.js and Supabase but all competitions are now shown. Off-season competitions display a "No fixtures" card with next date and Remind Me button.
5. **No React Router** — navigation managed via React state (`tab`, `activeCompKey`). SPA routing handled by Vercel `vercel.json` routes.
6. **Constants split** — heavy data in `src/constants.js`, imported into App.jsx to reduce bundle size.

---

## Known Limitations / Demo-Only Behaviour

- **Demo buttons** — "Advance to lockout" and "Simulate results" visible in UI. Remove before go-live.
- **Season length** — `SEASON_LENGTH_DEMO = 4` rounds. Real seasons are 38 (EPL), 17 (NFL) etc.
- **F1 demo progression** — each demo round shows the same upcoming real race (e.g. Belgian GP) since OpenF1 always returns the next real-world race. Expected behaviour in production.
- **Bot simulation** — `BOTS` array in constants.js simulates other users during demo. Remove before go-live.

---

## Immediate Next Actions / Backlog Highlights

See `docs/backlog.md` for full list. Top priorities:

1. **Update EFL GW1 fixtures** — exact Championship/L1/L2 fixtures now available (released Jun 25). Update `football-model.js` with confirmed matchups.
2. **Reminder cron job** — `reminders` table needs a scheduled job to send the 7-day-before email. Options: Vercel Cron (Pro), GitHub Actions schedule, Supabase pg_cron.
3. **Apple Sign In** — required for App Store submission.
4. **Stripe** — league slot purchases.
5. **Incorporate SouthScale** — Companies House (£50).
6. **ICO registration** — required as data controller (£40/year).

---

## People & Accounts

| Account | Owner | Access |
|---|---|---|
| GitHub (SouthScale-HQ) | andrew@southscale.co.uk | Admin |
| Vercel (byn-test + southscale-web) | andrew@southscale.co.uk | Owner |
| Supabase | andrew@southscale.co.uk | Owner |
| GoDaddy (bynapp.online) | andrew@southscale.co.uk | Owner |
| Resend (noreply@bynapp.online) | andrew@southscale.co.uk | Owner |
| Google Cloud | andrew@southscale.co.uk | Owner |

---

*For questions, see `docs/decisions.md` for architecture rationale, `docs/sports-calendar.md` for season dates, and `docs/backlog.md` for outstanding work.*
