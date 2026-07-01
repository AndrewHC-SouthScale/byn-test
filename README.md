# BYN — Bet Your Nuts

Play-money sports prediction markets. No real money — just bragging rights.

**Live at:** https://www.bynapp.online

---

## What is BYN?

BYN is a free-to-play sports prediction platform where users bet virtual credits ("nuts") on the outcomes of real sporting events across Football, Rugby, Basketball, Tennis, American Football, Cricket, Motorsport, and Golf.

Unlike traditional prediction apps where odds are fixed by the house, BYN uses **market-style pricing (LMSR)** — odds move automatically as users stake credits, reflecting real crowd sentiment. Starting odds are seeded from real bookmaker data at the start of each round.

---

## How it works

- Every round, each user receives **1000 fresh nuts** added to their balance
- Users must stake at least **50% of their total balance** before the round locks (1 hour before the first event) or the shortfall is forfeited
- Winnings carry forward into the next round; balances **reset to zero at the end of each season**
- Leaderboards track both cumulative balance and consistency (top-3 finishes, average rank)

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) |
| Hosting | Vercel |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (Google OAuth) |
| Domain | bynapp.online (GoDaddy → Vercel DNS) |
| Version control | GitHub |

---

## Project structure

```
byn-test/
├── src/
│   ├── App.jsx          # Main application (all UI and mock logic)
│   ├── main.jsx         # React entry point
│   └── supabase.js      # Supabase client connection
├── docs/
│   ├── decisions.md     # Product decisions log (the why behind every choice)
│   ├── schema.md        # Full database schema documentation
│   ├── database.sql     # SQL to recreate the Supabase database
│   └── tester-guide.md  # Structured guide for beta testers
├── public/
│   └── favicon.svg      # BYN hex nut icon
├── index.html
├── package.json
├── vite.config.js
├── vercel.json          # SPA routing config for Vercel
└── .nvmrc               # Node version pin
```

---

## Development

### Prerequisites
- Node.js v20+
- A Supabase project (see docs/database.sql to set up tables)
- Google OAuth credentials (see docs/decisions.md)

### Local setup

1. Clone the repo
2. Install dependencies: `npm install`
3. Create `.env.local` in the project root:
```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```
4. Run locally: `npm run dev`
5. Open: http://localhost:5173

### Deploying changes

```
npm run build
git add .
git commit -m "describe your change"
git push
```

Vercel auto-deploys to bynapp.online on every push to `main`.

---

## Documentation

| Document | Description |
|---|---|
| [decisions.md](docs/decisions.md) | Every product decision with reasoning |
| [schema.md](docs/schema.md) | Full database schema and architecture |
| [database.sql](docs/database.sql) | SQL to recreate the database |
| [TESTER_GUIDE.md](TESTER_GUIDE.md) | Structured beta tester guide |

---

## Current status

- ✅ Full mock platform live at bynapp.online
- ✅ Real Google OAuth authentication
- ✅ Supabase database with 16 tables
- ✅ 8 sport categories, 16 competitions
- ⏳ Persisting bets/balances to database
- ⏳ Live sports data feed integration
- ⏳ Transactional email (lockout reminders, settlement)
- ⏳ Apple Sign In
- ⏳ Payment integration (Stripe) for league slots and sponsored leagues
- ⏳ Ad network integration for nuts boost

---

## Monetisation

1. **Ad boost** — users watch ads to earn +50 nuts per view (up to 1000/round). Primary recurring revenue.
2. **League slot packs** — +3 extra league slots for a one-time fee
3. **Company-sponsored leagues** — businesses pay to create branded leagues for employees/customers
4. **Sponsorship slots** — banner and native ad placements throughout the app

---

*BYN is play-money only. No real money is ever staked or paid out.*
