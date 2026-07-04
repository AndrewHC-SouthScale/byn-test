# BYN — Sports Calendar & Activation Tracker

For each competition, BYN should be activated **30-60 days before the season/tournament starts** so markets can be seeded and users can start placing bets ahead of the first round.

The Odds API fixtures typically appear **1-2 weeks before the first match**. Re-enable the API (`oddsService.js`) and activate the competition in `COMPETITIONS` at the **"BYN activate by"** date.

---

## 🗓️ 2026 — Remaining year

| Competition | BYN key | Format | Start date | End date | BYN activate by | Status |
|---|---|---|---|---|---|---|
| ~~World Cup 2026~~ | `fifa_wc` | Knockout (no draw) | ~~11 Jun 2026~~ | 19 Jul 2026 | ~~Already active~~ | 🟢 Live |
| ~~Wimbledon ATP~~ | `atp` | Match winner | ~~30 Jun 2026~~ | 12 Jul 2026 | ~~Already active~~ | 🟢 Live (check end date) |
| ~~Wimbledon WTA~~ | `wta` | Match winner | ~~30 Jun 2026~~ | 12 Jul 2026 | ~~Already active~~ | 🟢 Live (check end date) |
| ~~The Open (Golf)~~ | `pga` | Outright winner | ~~16 Jul 2026~~ | 19 Jul 2026 | ~~Already active~~ | 🟢 Live (check end date) |
| EPL 2026-27 | `epl` | Three-way | **21 Aug 2026** | 30 May 2027 | **22 Jul 2026** | ⏳ Pending |
| La Liga 2026-27 | `laliga` | Three-way | **15 Aug 2026** | ~23 May 2027 | **15 Jul 2026** | ⏳ Pending |
| NFL 2026-27 | `nfl` | Two-way | **9 Sep 2026** | 10 Jan 2027 | **10 Aug 2026** | ⏳ Pending |
| NBA 2026-27 | `nba` | Two-way | **~21 Oct 2026** | ~Apr 2027 | **21 Sep 2026** | ⏳ Pending (inactive) |
| Champions League 2026-27 | `ucl` | Three-way | **~16 Sep 2026** | ~28 May 2027 | **16 Aug 2026** | ⏳ Pending (inactive) |

---

## 🗓️ 2027

| Competition | BYN key | Format | Start date | End date | BYN activate by | Status |
|---|---|---|---|---|---|---|
| Six Nations 2027 | `six_nations` | Three-way | **5 Feb 2027** | ~Mid Mar 2027 | **6 Jan 2027** | ⏳ Pending (inactive) |
| IPL 2027 | `ipl` | Two-way | **~10 Mar 2027** | ~15 May 2027 | **8 Feb 2027** | ⏳ Pending (inactive) |
| US Masters (Golf) | `pga` | Outright winner | **~8 Apr 2027** | ~11 Apr 2027 | **8 Mar 2027** | ⏳ Pending |
| ATP French Open | `atp` | Match winner | **~24 May 2027** | ~13 Jun 2027 | **24 Apr 2027** | ⏳ Pending |
| WTA French Open | `wta` | Match winner | **~24 May 2027** | ~13 Jun 2027 | **24 Apr 2027** | ⏳ Pending |
| ATP Wimbledon 2027 | `atp` | Match winner | **~28 Jun 2027** | ~11 Jul 2027 | **28 May 2027** | ⏳ Pending |
| WTA Wimbledon 2027 | `wta` | Match winner | **~28 Jun 2027** | ~11 Jul 2027 | **28 May 2027** | ⏳ Pending |
| EPL 2027-28 | `epl` | Three-way | **~Aug 2027** | ~May 2028 | **~Jul 2027** | ⏳ Future |
| La Liga 2027-28 | `laliga` | Three-way | **~Aug 2027** | ~May 2028 | **~Jul 2027** | ⏳ Future |
| NFL 2027-28 | `nfl` | Two-way | **~Sep 2027** | ~Jan 2028 | **~Aug 2027** | ⏳ Future |
| Rugby World Cup 2027 | `rugby_wc` | Three-way | **~Sep 2027** | ~Nov 2027 | **~Aug 2027** | ⏳ Future (inactive) |

---

## 🔧 What to do at each activation

When the "BYN activate by" date arrives, do the following:

### 1. Update `COMPETITIONS` in `App.jsx`
- Set `active: true` for the competition
- Update `name` if needed (e.g. "ATP Wimbledon" → "ATP French Open")
- Update `format` if needed (e.g. World Cup group stage → `three_way`, knockout → `three_way_no_draw`)

### 2. Re-enable the Odds API in `oddsService.js`
- Remove the early `return []` in `fetchUpcomingFixtures`
- Add the correct sport key to `SPORT_KEY_MAP` if not already there

### 3. Update `SPORT_KEY_MAP` in `oddsService.js`
Confirm the correct API key for the competition:
```
epl:          'soccer_epl'
laliga:       'soccer_spain_la_liga'
nfl:          'americanfootball_nfl'
nba:          'basketball_nba'
ucl:          'soccer_uefa_champs_league'
six_nations:  'rugby_union_six_nations'
atp:          (varies by tournament — check The Odds API /sports endpoint)
wta:          (varies by tournament — check The Odds API /sports endpoint)
pga:          (varies by tournament — check The Odds API /sports endpoint)
ipl:          'cricket_ipl'
```

### 4. Set the correct season length in `App.jsx`
Replace `SEASON_LENGTH_DEMO = 4` with the real value before go-live:
```
EPL / La Liga:        38 rounds
NFL:                  17 rounds (18 weeks inc. bye)
NBA:                  82 rounds
Champions League:     ~10 rounds (league phase only)
Six Nations:          5 rounds
IPL:                  ~14 rounds (group stage)
World Cup (groups):   3 rounds
Wimbledon:            ~7 rounds
The Open / Masters:   4 rounds
```

### 5. Update mock team pools if needed
When live API odds are unavailable (off-season), the mock team pool is the fallback. Update team names to reflect current squads/formats before each season.

### 6. Add competitions to Supabase
Run in Supabase SQL Editor to add any new competition not already in the DB:
```sql
INSERT INTO public.competitions (category_id, key, name, cadence, is_special_event, base_liquidity)
VALUES (X, 'key', 'Name', 'weekly', false, 300)
ON CONFLICT (key) DO NOTHING;
```

---

## 📋 Competitions currently active in BYN

| Competition | Active | Notes |
|---|---|---|
| EPL | ✅ | Off-season — using demo fixtures until 21 Aug |
| La Liga | ✅ | Off-season — using demo fixtures until 15 Aug |
| World Cup 2026 | ✅ | Live — knockout stage, ends 19 Jul |
| NFL | ✅ | Off-season — using demo fixtures until 9 Sep |
| F1 | ✅ | Demo fixtures only — not on Odds API |
| ATP Wimbledon | ✅ | Live — ends 12 Jul. Rename after |
| WTA Wimbledon | ✅ | Live — ends 12 Jul. Rename after |
| The Open (PGA) | ✅ | Live — ends 19 Jul. Rename after |
| NBA | ❌ | Inactive — activate Oct 2026 |
| Champions League | ❌ | Inactive — activate Aug 2026 |
| Six Nations | ❌ | Inactive — activate Jan 2027 |
| IPL | ❌ | Inactive — activate Feb 2027 |
| MotoGP | ❌ | Inactive — not on Odds API, defer |
| NASCAR | ❌ | Inactive — not on Odds API, defer |
| Rugby World Cup | ❌ | Inactive — next tournament Sep 2027 |
| Premiership Rugby | ❌ | Inactive — add to backlog |
