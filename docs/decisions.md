# BYN — Product Decisions Log

A running record of every significant product decision made during ideation and development, with the reasoning behind each one.

---

## Core concept

**Play-money only, no real wagering**
BYN is a simulated betting platform — no real money is ever staked or paid out. This keeps it outside gambling regulation while still delivering the excitement of prediction markets.

**Market-style pricing (LMSR)**
Odds are not set by the house. Instead, prices move automatically as users stake credits — the more credits staked on an outcome, the higher its price. This uses the Logarithmic Market Scoring Rule (LMSR), the same mechanism behind real prediction markets like Manifold. Starting odds are seeded from real bookmaker data (via The Odds API) at the start of each round, de-vigged to remove the bookmaker margin, then the LMSR engine takes over from the first bet.

---

## Credits / Nuts

**1000 credits per round, called "nuts"**
Every round, each user receives 1000 fresh nuts added to their existing balance. The currency is called "nuts" as a nod to the platform name (BYN — Bet Your Nuts) and poker slang ("the nuts" = the best possible hand).

**Hybrid carry-forward balance**
Credits are not fully reset each round. Instead: existing balance + 1000 topup = start-of-round balance. Winnings are added back and carry forward. This rewards consistent performance over the season.

**Season-end reset to zero**
At the end of each season, all balances reset to 0. This prevents runaway leaders building an insurmountable advantage across seasons. Every season is a clean start.

**Forced 50% commitment rule**
Users must stake at least 50% of their total balance before the round locks (1 hour before the first event). If they don't, the shortfall is forfeited. This prevents hoarding and keeps markets liquid. The maximum anyone can ever lose to forfeiture in a single round is 50% of their balance — never more.

**Betting opens immediately after previous round settles**
There is no waiting period between rounds from the user's perspective. As soon as a round settles, the next round's markets are open for betting. The 5-day pre-round window (when markets are created and seeded with opening odds) is a backend concept, not a user-facing gate.

**Round locks 1 hour before first kickoff**
The single lockout deadline is 1 hour before the first event of the round — not per-fixture. This prevents confusion about when individual bets close.

---

## Sports and competitions

**Two-tier structure: sport categories → competitions**
Sport categories (Football, Rugby, etc.) are navigation groups only. Competitions (EPL, Champions League, World Cup etc.) are the actual wallet-bearing units. Each competition has its own independent balance.

**Per-competition wallets**
EPL and Champions League are both Football but have completely separate balances. Winning in one doesn't affect the other.

**Special events are time-gated**
World Cup, Euros, Six Nations, Rugby World Cup only show active markets during their real-world tournament windows. Outside those windows the competition is visible (so users can plan) but non-interactive.

**Sports included at launch**
Football (EPL, Champions League, World Cup, Euros), Rugby (Six Nations, Rugby World Cup, Premiership Rugby), Basketball (NBA), Tennis (ATP, WTA), American Football (NFL), Cricket (IPL), Motorsport (F1, MotoGP, NASCAR), Golf (PGA Tour).

**Market type: match winner only (v1)**
All markets are winner markets only — Home/Draw/Away for team sports, outright winner for F1/PGA/MotoGP/NASCAR. Additional market types (both teams to score, top 5 finish, etc.) are a future addition.

**Liquidity scaled per competition**
The LMSR liquidity parameter (`b`) varies by competition to reflect expected participation. High-traffic competitions (EPL `b=400`, World Cup `b=450`) absorb large bets without wild price swings. Niche competitions (Premiership Rugby `b=100`) are more reactive, which is realistic for thin markets.

**Postponed fixtures refund bets**
If a fixture is postponed or cancelled, all bets on that market are voided and stakes refunded in full. Not treated as wins or losses.

---

## Leaderboards and rankings

**Season-long leaderboard tracks two things**
1. Current balance (cumulative performance this season)
2. Consistency: top-3 finishes and average rank across rounds

**Three leaderboard filters**
Global, by country, by favourite team. Country and favourite team are season-locked — set once at the start of each season, cannot be changed mid-season. If not changed at the start of a new season, the previous selection persists.

**Favourite team is per-competition**
A user can have Arsenal as their EPL favourite and a different team as their Champions League favourite. For outright sports (F1, PGA), no favourite team is applicable.

---

## Private leagues

**3 free league slots per user, global across all sports**
The cap applies across all competitions — joining an EPL league and a Champions League league counts as 2 of your 3 slots, not 1 each.

**Extra slots purchasable in packs of 3 (one-time purchase)**
Not a subscription — a permanent capacity unlock. First purchasable item on the platform.

**Leagues require admin approval before invite codes become active**
New league names go through a moderation queue before the invite code works. This prevents inappropriate names appearing before review.

**Profanity filter on display names and league names**
Client-side for instant feedback, server-side as the authoritative check. Includes basic leetspeak normalisation.

**Max 100 members per league**

**Company-sponsored leagues planned (not yet built)**
Companies can create and sponsor private leagues (e.g. for employees). These do NOT count against a player's personal 3-league cap. Companies pay to create a sponsored league. Requires organisation verification before activation.

---

## Monetisation

**Ad boost — 50 nuts per ad view, up to 1000 nuts per round**
Users can watch short ads in the Profile tab to earn bonus nuts. The 1000-nut cap resets every round, so a user could earn up to 1000 extra nuts every single gameweek. This is the primary recurring revenue mechanic. Ad views must be verified server-side (callback from ad network) before nuts are credited — cannot be gamed by calling the API directly.

**League slot packs — +3 slots for a one-time fee**
First real-money transaction on the platform. Not a subscription.

**Company-sponsored leagues — companies pay to create**
Second real-money transaction type. Pricing TBD.

**Sponsorship/advertising slots**
Three placement types: global top banner, native slot between fixtures, league-specific leaderboard slot. Managed via the `sponsor_slots` table — swap sponsors without touching app code.

**Referral bonus — 500 nuts each**
Both the referrer and the new user receive 500 nuts when a referral code is used at signup. Unlimited per referrer. New registrations only — existing users re-registering get nothing.

---

## Authentication and accounts

**Google OAuth only at launch (via Supabase Auth)**
Apple Sign In is required before App Store submission (App Store Guideline 4.8) but skipped for the initial web launch.

**Minimum age: 17**
Matches Apple's mandatory rating for apps with frequent/intense simulated gambling content. Server-side enforcement — not just a client-side checkbox.

**Email captured from OAuth (not re-verified)**
Google has already verified the email. Stored on `profiles.email` for transactional notifications and account recovery contact. Not used for login.

**No email verification step**
Google OAuth already verifies email ownership before the token reaches BYN. A separate verification flow would be redundant.

---

## Infrastructure

**Frontend:** React (Vite) hosted on Vercel, deployed via GitHub auto-deploy
**Backend/Database/Auth:** Supabase (Postgres + Supabase Auth)
**Domain:** bynapp.online (GoDaddy registrar, DNS pointing to Vercel)
**Email (planned):** Resend, for lockout reminders and settlement notifications
**Sports data (planned):** The Odds API — fixtures, results, and opening odds seeding
**Ad network (planned):** Google AdMob (mobile) or Google Ad Manager (web)
**Payments (planned):** Stripe for league slot purchases and company-sponsored league fees

---

## Naming

**BYN — Bet Your Nuts**
"Bet Your Nuts" is poker slang for going all-in with the best possible hand. The full name is kept subtle in the UI (small secondary text on the login screen) while BYN leads as the primary brand. The hex nut serves as the logo mark — geometric, clean, works at any size from favicon to billboard.
