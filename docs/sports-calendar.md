# BYN — Sports Calendar & Activation Tracker

For each competition, BYN should be activated **30–60 days before the season/tournament starts** so markets can be seeded and users can start placing bets ahead of the first round.

The Odds API fixtures typically appear **1–2 weeks before the first match**. Re-enable the API (`oddsService.js`) and activate the competition in `COMPETITIONS` at the **"BYN activate by"** date.

---

## 📌 How to read this document

| Column | Meaning |
|---|---|
| Competition | The event or season |
| BYN key | The `key` value in `COMPETITIONS` in App.jsx |
| Format | `three_way` (home/draw/away), `three_way_no_draw`, `two_way`, `outright` |
| Start | First match/race of the competition |
| End | Final match/race |
| BYN activate by | Deadline to activate in app (30–60 days before start) |
| Odds API key | The sport key to use in `SPORT_KEY_MAP` in oddsService.js |
| Status | Current state |

---

## ⚽ FOOTBALL

### EPL (English Premier League)
| Season | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| 2026–27 | **21 Aug 2026** | 30 May 2027 | **22 Jul 2026** | `soccer_epl` |
| 2027–28 | ~Aug 2027 | ~May 2028 | ~Jul 2027 | `soccer_epl` |

- BYN key: `epl` · Format: `three_way` · Rounds: 38
- Season fixtures released: June each year
- **Status: ⏳ Active (off-season, demo fixtures) — activate 22 Jul 2026**

---

### La Liga
| Season | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| 2026–27 | **15 Aug 2026** | ~23 May 2027 | **15 Jul 2026** | `soccer_spain_la_liga` |
| 2027–28 | ~Aug 2027 | ~May 2028 | ~Jul 2027 | `soccer_spain_la_liga` |

- BYN key: `laliga` · Format: `three_way` · Rounds: 38
- **Status: ⏳ Active (off-season, demo fixtures) — activate 15 Jul 2026**

---

### World Cup 2026
| Event | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| Group stage | 11 Jun 2026 | 2 Jul 2026 | Already passed | `soccer_fifa_world_cup` |
| Knockout stage | 3 Jul 2026 | **19 Jul 2026** | Already active | `soccer_fifa_world_cup` |

- BYN key: `fifa_wc` · Format: `three_way` (groups) / `three_way_no_draw` (knockout)
- Next World Cup: 2030 (Spain/Portugal/Morocco)
- **Status: 🟢 Active — ends 19 Jul 2026. Deactivate after final.**

---

### UEFA Champions League
| Season | League phase start | Final | BYN activate by | Odds API key |
|---|---|---|---|---|
| 2026–27 | **~16 Sep 2026** | ~28 May 2027 | **16 Aug 2026** | `soccer_uefa_champs_league` *(verify on API)* |

- BYN key: `ucl` · Format: `three_way` · Rounds: ~10 (league phase)
- Draw: 27 Aug 2026
- **Status: ❌ Inactive — activate 16 Aug 2026**

---

## 🏈 AMERICAN FOOTBALL

### NFL
| Season | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| 2026–27 | **9 Sep 2026** | 10 Jan 2027 | **10 Aug 2026** | `americanfootball_nfl` |
| Super Bowl LXI | 14 Feb 2027 | — | — | — |
| 2027–28 | ~Sep 2027 | ~Jan 2028 | ~Aug 2027 | `americanfootball_nfl` |

- BYN key: `nfl` · Format: `two_way` (no draw) · Rounds: 17
- **Status: ⏳ Active (off-season, demo fixtures) — activate 10 Aug 2026**

---

## 🏀 BASKETBALL

### NBA
| Season | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| 2026–27 | **~21 Oct 2026** | ~Jun 2027 | **21 Sep 2026** | `basketball_nba` |
| 2027–28 | ~Oct 2027 | ~Jun 2028 | ~Sep 2027 | `basketball_nba` |

- BYN key: `nba` · Format: `two_way` · Rounds: 82
- NBA All-Star 2027: 19–21 Feb 2027, Phoenix
- NBA London Game: 17 Jan 2027 (Spurs vs Pelicans, Co-op Live)
- **Status: ❌ Inactive — activate 21 Sep 2026**

---

## 🎾 TENNIS

*Tennis runs year-round — BYN activates per Grand Slam tournament. After each tournament ends, update the competition name and rename `atp`/`wta` to the next Grand Slam.*

### ATP & WTA — 2026 Grand Slams
| Tournament | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| ~~Australian Open~~ | ~~12 Jan 2026~~ | ~~1 Feb 2026~~ | ~~Already passed~~ | — |
| ~~French Open~~ | ~~24 May 2026~~ | ~~7 Jun 2026~~ | ~~Already passed~~ | — |
| **Wimbledon** | **29 Jun 2026** | **12 Jul 2026** | Already active | `tennis_atp_wimbledon` / `tennis_wta_wimbledon` |
| US Open | **31 Aug 2026** | **13 Sep 2026** | **1 Aug 2026** | *(check API — may be `tennis_atp_us_open`)* |

### ATP & WTA — 2027 Grand Slams
| Tournament | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| Australian Open 2027 | ~12 Jan 2027 | ~1 Feb 2027 | **12 Dec 2026** | *(check API)* |
| French Open 2027 | ~24 May 2027 | ~7 Jun 2027 | **24 Apr 2027** | *(check API)* |
| Wimbledon 2027 | ~28 Jun 2027 | ~11 Jul 2027 | **28 May 2027** | *(check API)* |
| US Open 2027 | ~30 Aug 2027 | ~12 Sep 2027 | **30 Jul 2027** | *(check API)* |

- BYN keys: `atp` / `wta` · Format: `two_way` (no draw in tennis)
- **Remember:** Rename competition in App.jsx to match each tournament (e.g. "ATP Wimbledon" → "ATP US Open")
- **Check Odds API `/sports` endpoint** before each Grand Slam for the correct key
- **Status: 🟢 Active (Wimbledon) — ends 12 Jul 2026**

---

## ⛳ GOLF

*Golf activates per major tournament. Rename `pga` in App.jsx to match the current event.*

### PGA / Golf Majors — 2026
| Tournament | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| ~~The Masters~~ | ~~9 Apr 2026~~ | ~~12 Apr 2026~~ | ~~Already passed~~ | — |
| ~~PGA Championship~~ | ~~14 May 2026~~ | ~~17 May 2026~~ | ~~Already passed~~ | — |
| ~~US Open~~ | ~~11 Jun 2026~~ | ~~14 Jun 2026~~ | ~~Already passed~~ | — |
| **The Open** | **16 Jul 2026** | **19 Jul 2026** | Already active | `golf_the_open_championship_winner` |

### PGA / Golf Majors — 2027
| Tournament | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| The Masters 2027 | ~8 Apr 2027 | ~11 Apr 2027 | **8 Mar 2027** | *(check API)* |
| PGA Championship 2027 | ~May 2027 | ~May 2027 | ~Apr 2027 | *(check API)* |
| US Open 2027 | ~Jun 2027 | ~Jun 2027 | ~May 2027 | *(check API)* |
| The Open 2027 | ~Jul 2027 | ~Jul 2027 | ~Jun 2027 | *(check API)* |

- BYN key: `pga` · Format: `outright` (field of 8 favourites)
- **Status: 🟢 Active (The Open) — ends 19 Jul 2026**

---

## 🏎️ MOTORSPORT

### Formula 1
| Season | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| 2026 | 8 Mar 2026 (Australia) | 6 Dec 2026 (Abu Dhabi) | Already passed | ❌ Not on Odds API |

- BYN key: `f1` · Format: `outright` · Rounds: 22
- **F1 is NOT available on The Odds API** — uses demo fixtures only
- Consider alternative data source (e.g. Sportradar, API-Sports) for future
- **Status: ✅ Active (demo fixtures only — no live odds)**

---

### MotoGP
| Season | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| 2026 | 1 Mar 2026 (Thailand) | 29 Nov 2026 (Valencia) | Already passed | ❌ Not on Odds API |
| 2027 | ~Mar 2027 | ~Nov 2027 | ~Jan 2027 | *(check API — new 850cc era)* |

- BYN key: `motogp` · Format: `outright` · Rounds: 22
- 2027 is a new technical era (850cc engines, Pirelli tyres) — check if Odds API adds coverage
- **Status: ❌ Inactive — not on Odds API. Activate if coverage appears.**

---

### NASCAR Cup Series
| Season | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| 2026 | 15 Feb 2026 (Daytona 500) | 8 Nov 2026 (Homestead) | Already passed | ❌ Not on Odds API |
| 2027 | ~Feb 2027 | ~Nov 2027 | ~Jan 2027 | *(check API)* |

- BYN key: `nascar` · Format: `outright` · Rounds: 36
- **Status: ❌ Inactive — not on Odds API. Activate if coverage appears.**

---

## 🏉 RUGBY UNION

### Six Nations
| Tournament | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| 2027 Six Nations | **5 Feb 2027** | ~mid Mar 2027 | **6 Jan 2027** | *(check API — may be `rugby_union_six_nations`)* |

- BYN key: `six_nations` · Format: `three_way` · Rounds: 5
- Fixtures announced: 9 Mar 2026 (already known)
- **Status: ❌ Inactive — activate 6 Jan 2027**

---

### Premiership Rugby (Gallagher PREM)
| Season | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| 2026–27 | **25–27 Sep 2026** | 19 Jun 2027 | **26 Aug 2026** | *(check API)* |

- BYN key: `prem_rugby` · Format: `three_way`
- Fixture list released: July 2026
- First season under franchise model (no promotion/relegation)
- **Status: ❌ Inactive — activate 26 Aug 2026**

---

### Rugby World Cup
| Tournament | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| 2027 RWC | **~Sep 2027** | ~Nov 2027 | **~Aug 2027** | *(check API)* |

- BYN key: `rugby_wc` · Format: `three_way` (pools) / `three_way_no_draw` (knockout)
- Host nation TBC — likely Australia
- **Status: ❌ Inactive — next tournament 2027**

---

## 🏏 CRICKET

### IPL
| Season | Start | End | BYN activate by | Odds API key |
|---|---|---|---|---|
| 2027 | **~10 Mar 2027** | ~15 May 2027 | **8 Feb 2027** | `cricket_ipl` *(verify on API)* |

- BYN key: `ipl` · Format: `two_way` · Rounds: ~14 (group stage)
- **Status: ❌ Inactive — activate 8 Feb 2027**

---

## 🗓️ MASTER ACTIVATION TIMELINE

*A quick view of what to activate and when, in chronological order.*

| Date | Action |
|---|---|
| **15 Jul 2026** | Activate La Liga 2026–27 in BYN |
| **19 Jul 2026** | World Cup ends — deactivate `fifa_wc` |
| **19 Jul 2026** | The Open ends — rename `pga` (e.g. "Golf — Next Major TBC") |
| **22 Jul 2026** | Activate EPL 2026–27 in BYN |
| **12 Jul 2026** | Wimbledon ends — rename `atp`/`wta` to "ATP US Open" / "WTA US Open" |
| **1 Aug 2026** | Activate ATP & WTA US Open in BYN |
| **10 Aug 2026** | Activate NFL 2026–27 in BYN |
| **16 Aug 2026** | Activate Champions League 2026–27 in BYN |
| **26 Aug 2026** | Activate Premiership Rugby 2026–27 in BYN |
| **13 Sep 2026** | US Open tennis ends — rename `atp`/`wta` to next tournament |
| **21 Sep 2026** | Activate NBA 2026–27 in BYN |
| **6 Jan 2027** | Activate Six Nations 2027 in BYN |
| **8 Feb 2027** | Activate IPL 2027 in BYN |
| **8 Mar 2027** | Activate The Masters (golf) in BYN |

---

## 🔧 Activation checklist (do each time)

1. **App.jsx** — set `active: true`, update `name`, check `format`
2. **oddsService.js** — remove `return []`, confirm `SPORT_KEY_MAP` key
3. **Verify Odds API** — run `https://api.the-odds-api.com/v4/sports?apiKey=YOUR_KEY` to confirm the sport key is available and `active: true`
4. **Supabase** — add competition row if not already present
5. **App.jsx** — set real `SEASON_LENGTH` (replace `SEASON_LENGTH_DEMO = 4`)
6. **Test** — sign in, navigate to competition, confirm 🟢 live fixtures banner appears

---

## ❓ Odds API availability (as of Jul 2026)

| Sport | Available | Key |
|---|---|---|
| EPL | ✅ | `soccer_epl` |
| La Liga | ✅ | `soccer_spain_la_liga` |
| NFL | ✅ | `americanfootball_nfl` |
| World Cup | ✅ | `soccer_fifa_world_cup` |
| ATP Wimbledon | ✅ | `tennis_atp_wimbledon` |
| WTA Wimbledon | ✅ | `tennis_wta_wimbledon` |
| The Open (golf) | ✅ | `golf_the_open_championship_winner` |
| Champions League | ⚠️ | Verify — likely `soccer_uefa_champs_league` |
| NBA | ⚠️ | Verify — likely `basketball_nba` |
| Six Nations | ⚠️ | Verify when season approaches |
| Premiership Rugby | ⚠️ | Verify when season approaches |
| IPL | ⚠️ | Verify — likely `cricket_ipl` |
| F1 | ❌ | Not available |
| MotoGP | ❌ | Not available |
| NASCAR | ❌ | Not available |
