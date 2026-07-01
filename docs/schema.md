# Platform schema — v1

## Auth
- Supabase Auth (or NextAuth), with **both Google and Apple as providers** — Apple Sign In is not optional if shipping to iOS: App Store Review Guideline 4.8 requires it whenever an app exclusively uses third-party/social login for its primary account, which is exactly BYN's setup with Google-only. Submitting without it is a guaranteed rejection, not a gray area.
- `users` table is auto-created by the auth provider; we extend it with a `profiles` table (1:1) for app-specific fields
- No separate email verification step needed: both Google and Apple verify the account's email before OAuth completes, so a dedicated "check your inbox" flow would be redundant. The verified email is captured on `profiles.email` for use in notifications (lockout reminders, settlement results) and as a contact point for account recovery, not re-verified.
- **Apple-specific caveat**: Apple users can choose "Hide My Email," which gives the app a randomly generated private relay address instead of their real one. This still forwards notifications correctly day-to-day, but it's less reliable for the account-recovery use case — a user can disable the relay or delete their Apple ID, breaking that forwarding silently, with no equivalent risk on the Google side. Worth surfacing this distinction in support tooling later (e.g. flag relay-email accounts differently) rather than assuming every stored email is equally durable.
- Having the email on file is not itself a recovery mechanism — if a user loses access to their Google or Apple account entirely, there's currently no self-service path back in. The email lets support *contact* them, but actually restoring access would need a manual process (identity verification, manual relinking) until/unless a proper recovery flow is built. Worth a support-process decision later, not a schema gap to fix now.

## Core tables

### profiles
| column | type | notes |
|---|---|---|
| id | uuid (FK -> auth.users) | primary key |
| display_name | text | |
| email | text | captured from the Google OAuth response at signup, already verified by Google — used for lockout reminders, settlement notifications, and account recovery, not for login itself |
| created_at | timestamptz | |

### gameweeks
| column | type | notes |
|---|---|---|
| id | serial | |
| season | text | e.g. "2026-27" |
| gw_number | int | 1-38 |
| first_kickoff | timestamptz | drives the lockout deadline |
| lockout_at | timestamptz | = first_kickoff - 1 hour, computed on insert |
| status | enum | upcoming / open / locked / settled |

### wallets
One row per user per gameweek. New row auto-created with balance 1000 when a gameweek opens (or on a user's first action that week, whichever is simpler to implement).

| column | type | notes |
|---|---|---|
| id | serial | |
| user_id | uuid (FK) | |
| gameweek_id | int (FK) | |
| starting_balance | int | always 1000 |
| committed_total | int | sum of stakes placed, kept in sync via trigger or app logic |
| forfeited_amount | int | set at lockout if committed_total < 500 |
| locked | boolean | flips true at lockout_at |

Unique constraint on (user_id, gameweek_id).

### fixtures
| column | type | notes |
|---|---|---|
| id | serial | |
| gameweek_id | int (FK) | |
| home_team | text | |
| away_team | text | |
| kickoff_at | timestamptz | |
| status | enum | scheduled / live / finished / postponed |
| result | enum nullable | home / draw / away, set on finish |
| external_id | text | id from the sports data feed, for syncing |

### markets
One per fixture (v1 = match-winner only, so 1:1 with fixtures, but modeled as separate table so we can add market types later without a schema rewrite).

| column | type | notes |
|---|---|---|
| id | serial | |
| fixture_id | int (FK) | |
| market_type | enum | 'match_winner' for v1 |
| q_home | numeric | LMSR state |
| q_draw | numeric | LMSR state |
| q_away | numeric | LMSR state |
| liquidity_b | numeric | LMSR liquidity param |
| status | enum | open / locked / settled |

### bets
| column | type | notes |
|---|---|---|
| id | serial | |
| user_id | uuid (FK) | |
| market_id | int (FK) | |
| gameweek_id | int (FK) | denormalized for fast wallet-commitment lookups |
| outcome | enum | home / draw / away |
| stake | int | credits spent |
| shares | numeric | LMSR shares purchased |
| price_at_execution | numeric | locks in payout odds |
| settled | boolean | |
| payout | int nullable | shares if won, 0 if lost, null until settled |
| created_at | timestamptz | |

### gameweek_standings
Snapshot written once a gameweek settles. This is what powers both leaderboard views without recomputing from raw bets every time.

| column | type | notes |
|---|---|---|
| id | serial | |
| user_id | uuid (FK) | |
| gameweek_id | int (FK) | |
| ending_balance | int | starting 1000 +/- bet outcomes |
| rank_this_week | int | |

## Leaderboard views (derived, not separate writable tables)

**Season cumulative**: `SUM(ending_balance - 1000)` per user across all `gameweek_standings` rows this season, ranked descending.

**Consistency score**: alongside cumulative total, compute:
- weeks finished in top 10 (or top X%) — count of `gameweek_standings` rows where `rank_this_week <= 10`
- average weekly rank
- a simple "consistency index" e.g. `weeks_in_top10 / total_weeks_played`, useful as a tiebreaker or its own filterable leaderboard view

This lets us show two leaderboards from the same data: "Most credits this season" and "Most consistent performer" — without maintaining two separate scoring systems that could disagree.

## Private mini leagues

### groups
| column | type | notes |
|---|---|---|
| id | serial | |
| name | text | |
| creator_id | uuid (FK) | |
| invite_code | text | unique, short (e.g. 6-char alphanumeric) |
| status | enum | pending / approved / rejected |
| max_members | int | default 100 |
| created_at | timestamptz | |

### group_members
| column | type | notes |
|---|---|---|
| group_id | int (FK) | |
| user_id | uuid (FK) | |
| joined_at | timestamptz | |

Composite PK (group_id, user_id). Two constraints enforced at the application layer (and ideally also as DB checks/triggers, since this is the kind of rule that's bad news if it silently breaks):
- a user may belong to at most 5 groups
- a group may not exceed `max_members`

### Standings
No new scoring table needed — group standings are just the existing `gameweek_standings` / season-aggregate queries filtered to `user_id IN (SELECT user_id FROM group_members WHERE group_id = ?)`. Same balance and consistency metrics as the global leaderboard, just scoped to group membership, so there's only ever one scoring system to maintain.

### Moderation
New groups are created with `status = 'pending'` and are not joinable (invite code inert) until an admin flips them to `approved`. This needs a `profiles.is_admin` boolean and a simple internal review screen — out of scope for v1 UI but worth planning the table for now so it's not a later migration.

## Content moderation

### Profanity filter
Applies to two user-supplied text fields: `profiles.display_name` and `groups.name`.

- **Client-side**: instant feedback as the user types, using a local blocklist + basic leetspeak normalization (e.g. "fuck" still catches "fu(k", "f0ck"). Good for UX, bad as a security boundary — purely cosmetic if not backed up server-side.
- **Server-side (authoritative)**: every write to `display_name` or `groups.name` must re-check against the filter in the API layer before the row is saved, regardless of what the client claims it already validated. A determined user can always bypass client-side JS and hit the API directly.
- **Recommendation for the real build**: don't hand-roll the wordlist long-term — use a maintained moderation service or library (e.g. a third-party profanity-detection API, or a well-maintained open-source list with regular updates) since slur/slang evasion techniques evolve faster than a static list anyone maintains by hand. The mock's blocklist is illustrative only, not production-grade.
- Worth deciding later: should a rejected name silently re-prompt, or get logged for review (repeated attempts might be a signal worth a human looking at, separate from the group-approval moderation queue already planned).

## Sponsorship / advertising

### sponsor_slots
A slot is a *placement* (where an ad can appear), separate from the creative running in it, so swapping a sponsor doesn't touch app code.

| column | type | notes |
|---|---|---|
| id | serial | |
| placement | enum | e.g. 'global_top_banner', 'league_leaderboard', 'fixture_list_native' |
| group_id | int (FK) nullable | set only for league-specific sponsorship (a single private league sponsored by a local business, say) |
| sponsor_name | text | |
| creative_url | text | image or HTML snippet location |
| click_url | text | |
| starts_at / ends_at | timestamptz | for scheduled campaigns |
| active | boolean | |

### Notes
- Keep placements as a small fixed enum rather than free-form, so the frontend always knows exactly what shape of creative fits each slot (e.g. banner vs native card) rather than receiving arbitrary content that could break layout.
- `group_id` being nullable is what lets the same table serve both platform-wide sponsorship (front page banner) and a single private league's own sponsor (e.g. a five-a-side team's league sponsored by their kit supplier) without two separate systems.
- Because this is a play-money product, not real-money gambling, the regulatory bar for running ads on it is much lower than a real-money platform — but if you ever introduce age-gating or geographic restrictions for other reasons, sponsor content should respect the same gates.
- Not in v1 scope, but worth knowing the shape exists: real ad networks usually want an impression/click count, which means a lightweight `sponsor_impressions` log table down the line if a sponsor wants to see deliverables/performance.

## Multi-sport generalization

v1 was EPL-only with a fixed weekly cadence and always-3 outcomes (Home/Draw/Away). Supporting NFL, IPL cricket, F1, and PGA golf means generalizing two things: the concept of a "round" (was "gameweek", now needs to flex per sport), and the concept of a market's outcomes (was always 3, now ranges from 2 (some cricket formats), to 3 (football), to 20+ (an F1 grid or golf field).

### sports
| column | type | notes |
|---|---|---|
| id | serial | |
| key | text | 'epl', 'nfl', 'ipl', 'f1', 'pga' |
| name | text | display name |
| cadence | enum | 'weekly' (epl, nfl, ipl) / 'per_event' (f1, pga — each race/tournament is its own round) |

### wallets (revised)
Now scoped per (user, sport) instead of per (user, gameweek) — balance is persistent and cumulative *within* a sport, same hybrid rule as before (existing balance + topup, 50% minimum), but sports never share a balance.

| column | type | notes |
|---|---|---|
| id | serial | |
| user_id | uuid (FK) | |
| sport_id | int (FK) | |
| balance | numeric | persistent, carries across rounds within this sport only |

Unique constraint (user_id, sport_id).

### betting_rounds (updated)
| column | type | notes |
|---|---|---|
| id | serial | |
| sport_id | int (FK) | |
| label | text | e.g. "Gameweek 14", "Monaco Grand Prix", "The Masters" |
| opens_at | timestamptz | = first_kickoff - 5 days — when betting window opens and markets become interactive |
| lockout_at | timestamptz | = first_kickoff - 1 hour — same rule as before, now the end of a defined window |
| status | enum | **upcoming** / open / locked / settled |

Four-stage lifecycle:
- **Upcoming**: round is visible, fixtures and opening odds are shown so users can plan, but no staking yet. Runs from round creation until `opens_at`.
- **Open**: betting window active, users stake, LMSR prices move. Runs from `opens_at` to `lockout_at`.
- **Locked**: positions frozen 1 hour before first event. Forced-commitment check runs here.
- **Settled**: results in, bets resolved, standings written.

A scheduled job flips `upcoming → open` at `opens_at` (5 days before first event) and `open → locked` at `lockout_at`, same as the existing lockout job — just one additional trigger added.

### events
Generalizes `fixtures` — a match, a race, or a tournament.

| column | type | notes |
|---|---|---|
| id | serial | |
| round_id | int (FK) | |
| sport_id | int (FK) | denormalized for convenience |
| name | text | e.g. "Arsenal vs Chelsea", "Monaco GP", "IPL: MI vs CSK" |
| starts_at | timestamptz | |
| status | enum | scheduled / live / finished / postponed |
| external_id | text | id from the sports data feed |

### markets (revised)
Still one per event for v1 (winner-only market type), but outcomes are no longer hardcoded to 3 — they're now a child table since a market might have 2 (cricket), 3 (football), or 20+ (F1 grid, golf field) outcomes.

| column | type | notes |
|---|---|---|
| id | serial | |
| event_id | int (FK) | |
| market_type | enum | 'winner' for v1 |
| liquidity_b | numeric | |
| status | enum | open / locked / settled |

### market_outcomes
| column | type | notes |
|---|---|---|
| id | serial | |
| market_id | int (FK) | |
| label | text | team name, driver name, or golfer name |
| q | numeric | LMSR state for this outcome (was a 3-element array on the market before; now one row per outcome so the count can vary freely) |
| is_winner | boolean nullable | set once the event settles |

The LMSR math itself (price, cost, shares-for-budget functions) is already outcome-count-agnostic — it was only the *UI* and the old 3-column market table that assumed exactly 3 outcomes. This generalization is mostly a data-modeling change, not a pricing-engine rewrite.

### bets (revised)
| column | type | notes |
|---|---|---|
| id | serial | |
| user_id | uuid (FK) | |
| market_outcome_id | int (FK) | which specific outcome (team/driver/golfer) was backed |
| round_id | int (FK) | denormalized, used for the 50%-commitment check per round |
| sport_id | int (FK) | denormalized, used to find the right wallet |
| stake | numeric | |
| shares | numeric | |
| price_at_execution | numeric | |
| settled | boolean | |
| payout | numeric nullable | |

### Forced-commitment rule, generalized
Unchanged in spirit, just scoped per (user, sport, round) instead of per (user, gameweek): before `lockout_at`, a user must have staked ≥50% of their *current sport-specific balance* (existing balance + that round's topup) or the shortfall is forfeited. Football and cricket get this checked weekly; F1 and golf get it checked once per race/tournament, since that's their natural cadence — same rule, different clock.

## League slot limits & purchasable expansion

The 5-league cap is global across all sports — a user's `group_members` rows are counted platform-wide, not per sport, since `groups` already isn't sport-scoped in the schema. The platform-wide leaderboard is not a `groups` row at all (it's just the unfiltered season query), so it's automatically exempt from this cap without needing a special case.

### profiles (extended)
| column | type | notes |
|---|---|---|
| extra_league_slots | int | default 0, increments in packs of 5 when purchased |

Effective cap for a user = `5 + extra_league_slots`.

### purchases
| column | type | notes |
|---|---|---|
| id | serial | |
| user_id | uuid (FK) | |
| product | text | e.g. 'league_slot_pack_5' |
| slots_granted | int | 5 for the standard pack |
| amount_paid | numeric | |
| currency | text | |
| payment_provider_ref | text | id from Stripe/Apple/Google, whichever processor is used |
| status | enum | pending / completed / refunded |
| created_at | timestamptz | |

### Design notes
- **One-time, not subscription**: recommended over recurring billing, since a league slot is a permanent capacity unlock with no ongoing cost to the platform, unlike something with continuous delivery cost (storage, data feeds, etc.). Subscriptions would just add billing complexity and refund disputes without matching value.
- **Real payment processing is a genuinely separate workstream** from everything else in this build — it pulls in a payment provider (Stripe is the standard choice for a web app), receipt verification, refund handling, and tax/invoicing depending on jurisdiction. None of this is mocked yet by design; this section just reserves the schema shape so adding it later isn't a migration headache.
- Even though league slots themselves aren't a wager, charging real money anywhere on the platform is worth flagging to a lawyer once before launch — it likely doesn't trigger gambling regulation (no wagering of real money against odds), but consumer protection and payment compliance rules (e.g. clear refund policy, PCI compliance via the payment provider) still apply.

## Country & favourite team — season-locked

### profiles (extended further)
| column | type | notes |
|---|---|---|
| country | text | |
| favourite_team_by_sport | jsonb | `{ "epl": "Arsenal", "nfl": "Chiefs", ... }` — only set for team-based sports |

### Locking rule
Both fields are editable only during a defined "edit window" at the start of each sport's season, then locked for the remainder of that season. If a user doesn't change a value during the window, the prior value persists unchanged — there's no forced reset.

Implementation approach: each sport's `betting_rounds` table effectively already tracks round number within its cadence. Add a `season_number` and treat the edit window as "the first round of a new `season_number` for that sport." A scheduled job (or simple application check) flips the window open when a new season's first round opens, and closed once that round locks/settles. This avoids needing a separate "edit window" table — it derives from data already being tracked for rounds.

Worth deciding for the real build, not necessary now: whether the edit window stays open for the entire first round (current mock behavior) or only for a short fixed period (e.g. 48 hours) at the very start of the season, since a long open window means a user could theoretically watch early-season results before locking in a "supportive" favourite team — harmless for vanity/social leaderboards, but worth being intentional about if it ever affects anything with real stakes attached.

## Company-sponsored leagues (planned, not built yet)

Not needed for initial launch, but worth designing for now so adding it later doesn't require restructuring the existing `groups` table.

### organizations
A company account, distinct from a regular player account — companies don't place bets, they sponsor and manage leagues.

| column | type | notes |
|---|---|---|
| id | serial | |
| name | text | |
| contact_email | text | |
| verified | boolean | gate for who's allowed to create sponsored leagues — presumably a manual approval step similar to the existing group-moderation queue, but for the organization itself rather than each league |
| created_at | timestamptz | |

### org_members
Lets a company have more than one staff member managing its leagues, with basic roles.

| column | type | notes |
|---|---|---|
| org_id | int (FK) | |
| user_id | uuid (FK) | references the same `profiles` table regular players use — a company rep is still just a user, with an additional org affiliation |
| role | enum | 'owner' / 'manager' |

### groups (extended)
| column | type | notes |
|---|---|---|
| sponsor_org_id | int (FK) nullable | set only for company-sponsored leagues |
| is_sponsored | boolean | derived from sponsor_org_id being set, but worth a real column for fast filtering |

### Resolved decisions
- **Player cap exemption**: company-sponsored leagues do **not** count against a player's personal 5-league limit — joining one is "free" from the player's perspective, same as the global leaderboard. This is the same kind of exemption already modeled for the global leaderboard, just extended to any `group` where `sponsor_org_id` is set.
- **Monetization**: companies pay to create/sponsor a league. This becomes a row in `purchases` (or a closely related table, since the product differs from the player-facing `league_slot_pack_5`) — something like `product = 'sponsored_league_creation'`, tied to the `org_id` rather than a player's `user_id`. Pricing tiers (e.g. by member cap, or duration) aren't decided yet, but the table shape already supports it.

### Still open, not needed now
- **Member cap**: regular private leagues cap at 100 — a sponsored league may reasonably want more (e.g. a large employer's internal league). Worth deciding whether this scales with what the company pays, or is a flat higher cap.
- **Branding**: pairs naturally with the existing `sponsor_slots` table — a sponsored league could auto-populate its leaderboard placement with the org's creative on creation, rather than requiring manual setup each time.

## Seeding gameweek odds from real bookmakers

### Source
Use a licensed odds aggregator API, not direct scraping of bookmaker sites (against most books' terms of service and fragile to layout changes). The Odds API is a reasonable starting point — broad sport coverage, transparent credit-based pricing, a usable free tier for prototyping. Verify before committing that it (or whichever provider is chosen) actually covers IPL cricket and F1/golf outright markets specifically, since those are less universally supported than EPL and major US sports across odds API providers.

### Conversion: bookmaker odds → fair starting probabilities
Bookmaker odds include a built-in margin (the "vig"), so raw odds can't be used directly as LMSR starting prices without first removing it, or day-one markets would start already skewed.

1. Convert each bookmaker's odds to implied probability per outcome:
   - Decimal odds: `implied_prob = 1 / decimal_odds`
   - American odds (positive): `implied_prob = 100 / (price + 100)`
   - American odds (negative): `implied_prob = -price / (-price + 100)`
2. Sum the implied probabilities across all outcomes in the market — this will be slightly over 100% (the vig). E.g. Home 45% + Draw 30% + Away 30% = 105%.
3. Normalize by dividing each outcome's implied probability by that sum, so they sum to exactly 100% — this is the de-vigged "fair" probability.
4. Convert the fair probabilities into LMSR starting `q` values for each outcome, solving for `q_i` such that `price_i = exp(q_i/b) / Σexp(q_j/b)` matches the de-vigged probability (closed form: set `q_i = b * ln(p_i)` up to a shared constant, since LMSR prices only depend on relative differences between `q` values).
5. If multiple bookmakers are returned, average their de-vigged probabilities first (a simple consensus price) rather than picking one book arbitrarily, since no single book's line should be treated as uniquely "correct."

### Where this runs
This is backend/cron work, not something the frontend mock can demonstrate live, since it requires a real API key and outbound network access neither of which the current mock has. It slots into the existing "sync fixtures" scheduled job: when a new round's markets are created, fetch odds for those fixtures, de-vig, and seed `q` before the round opens for betting — same job, one extra step.

## Sports → categories, competitions → the real unit

Originally "sport" (EPL, NFL, F1...) was the wallet-bearing unit. Supporting multiple leagues/tournaments per sport (EPL, Champions League, World Cup all under "Football") means restructuring: **sport becomes a grouping category** purely for navigation, and **competition becomes the actual unit everything else attaches to** — wallet, rounds, markets, season standings. This is a natural extension of the existing generalization, not a rewrite of the underlying mechanics.

### sport_categories
Just a lookup table for grouping/navigation — no wallet, no rounds, nothing financial attaches here.

| column | type | notes |
|---|---|---|
| id | serial | |
| key | text | 'football', 'rugby', 'american_football', 'cricket', 'motorsport', 'golf' |
| name | text | |

### competitions (replaces the old `sports` table as the operative unit)
| column | type | notes |
|---|---|---|
| id | serial | |
| category_id | int (FK) | |
| key | text | 'epl', 'ucl', 'fifa_world_cup', 'six_nations', 'rugby_world_cup', ... |
| name | text | |
| cadence | enum | 'weekly' / 'per_event' (same meaning as before) |
| is_special_event | boolean | true for World Cup, Euros, Six Nations, Rugby World Cup — anything that isn't a continuous season |
| active_window_start | timestamptz nullable | only set for special events |
| active_window_end | timestamptz nullable | only set for special events |

### wallets (revised again)
Now scoped per (user, competition) instead of per (user, sport) — confirmed: EPL and Champions League get fully separate balances even though both are "Football," same hybrid rule (existing balance + topup, 50% minimum) applied independently per competition.

**Season-end reset**: balance carries forward round-to-round *within* a season exactly as designed (existing balance + topup, 50% minimum, winnings added back), but resets to 0 at the start of a new season. This is what actually closes the "runaway winner" risk for good — the hybrid carryover rule bounds how much can be lost or hoarded *within* a season, but without a season-end reset, a strong early run could still compound into an unbeatable lead over a multi-year career. Resetting at season boundaries means every player starts each new season on exactly equal footing, regardless of how the previous one went — past performance only shows up in season-level leaderboard history (`gameweek_standings` equivalent), never as a carried balance advantage.

| column | type | notes |
|---|---|---|
| id | serial | |
| user_id | uuid (FK) | |
| competition_id | int (FK) | |
| balance | numeric | resets to 0 at season boundary, not preserved across seasons |

Unique constraint (user_id, competition_id). Every other table that previously referenced `sport_id` (betting_rounds, events, bets, sponsor_slots' league pairing, etc.) now references `competition_id` instead — same shape, renamed foreign key.

### Special event gating
A special-event competition (World Cup, Euros, Six Nations, Rugby World Cup) only accepts bets while `now()` falls within `[active_window_start, active_window_end]`. Outside that window:
- The competition still appears in navigation (so people know it exists and can plan for it), but its markets are non-interactive
- No wallet activity is possible — no topup, no forced-commitment check, since there's no "this week" to speak of when the tournament isn't running
- A scheduled job (or simple application check, same pattern as the lockout job) flips a competition's effective status as the window opens and closes, rather than this being purely a UI-layer check — server-side enforcement matters here since otherwise a determined client could bet on a "closed" World Cup market by hitting the API directly

### Worth deciding later, not now
- Real-world dates for these windows (World Cup is roughly every 4 years, Six Nations is annual ~Feb–March, Euros is roughly every 4 years alternating with the World Cup) need to be data-entered per edition, not hardcoded — these aren't fixed recurring dates the way "every Saturday" is for EPL.
- Whether a user can have an EPL favourite team and a separate World Cup favourite team (national side) under the country/favourite-team ranking feature — currently that feature is keyed per sport in the existing design notes, but with competitions now being the real unit, it likely needs to be keyed per competition instead. Flagging this now so it's not forgotten when this is actually built.

## Fix-before-launch items

### Age gating
The mock uses a self-declared checkbox at signup, which is enough to demonstrate the UX but not enough for production — a checkbox alone is weak verification and some app store / regional requirements expect a captured date of birth with an actual age calculation, not just an assertion.

Minimum age set to **17**, matching Apple's mandatory rating for apps with frequent/intense simulated gambling content (a rule that's applied globally since 2019, regardless of whether real money is involved). This isn't really a discretionary choice — Apple's own store-level 17+ rating sits on top of whatever in-app minimum is set, so an internal policy below 17 would be functionally overridden by the platform anyway. 17 is the cleanest alignment point; Google Play's IARC system reaches a similar Teen/Mature classification for the same content, though via a different mechanism.

| column | type | notes |
|---|---|---|
| profiles.date_of_birth | date | captured at signup, used to compute age server-side rather than trusting a client-side checkbox |
| profiles.age_verified_at | timestamptz | when the check passed |

Server-side signup logic rejects account creation if computed age < 17 — this check must happen on the backend, not just block a button in the UI client-side. Worth a final legal check before launch regardless, since some jurisdictions may have separate, stricter rules around simulated-gambling-adjacent products independent of app store policy.

### Postponed / voided fixtures
Resolved decision, implemented in the mock's settlement logic: a postponed fixture refunds the stake on any bet placed against it (treated as void, not won or lost), rather than being silently dropped or counted as a loss. The mock simulates an 8% chance per market of this happening, purely for demo visibility — real postponements come from the sports data feed's fixture status, not randomness.

| column | type | notes |
|---|---|---|
| events.status | enum (extended) | scheduled / live / finished / postponed / cancelled |
| bets.void | boolean | true if refunded due to a postponed/cancelled event |

Settlement job logic: when an event's status flips to postponed or cancelled, all bets against its market(s) get `void = true` and the stake is refunded to the user's balance (not treated as payout, not treated as forfeited) — same refund-not-payout principle as the mock. If a postponed match is later rescheduled within the same round, the market can reopen; if it falls outside the round (more likely), it stays void and the rescheduled fixture becomes a new market in whichever round it lands in.

### Liquidity scaling per competition
Resolved decision, implemented in the mock: each competition now has its own base LMSR liquidity (`b`) reflecting its expected participation, rather than one static value shared everywhere. High-traffic competitions (EPL, World Cup, NFL) get deeper starting liquidity so realistic stake sizes don't swing prices wildly; niche competitions (Premiership Rugby, IPL, Six Nations) get shallower liquidity calibrated to their smaller expected user base, so the market still feels responsive rather than artificially dead.

For the real build, this shouldn't stay purely static forever — worth revisiting once real usage data exists, since actual participation may not match these illustrative guesses. A more advanced version could adjust `b` based on a rolling average of actual stake volume per competition over recent rounds, rather than a value picked once at launch.

### Notification infrastructure
Not buildable in the browser-only mock (no backend, no push service), but the touchpoint is shown in the UI as a placeholder so the design is visible. Real implementation needs:

- A push notification service (e.g. Firebase Cloud Messaging for cross-platform, or APNs/FCM directly) plus an email fallback for users without push enabled
- A `notifications` or `scheduled_reminders` table, or simply additional logic in the existing lockout cron job: at T-1hr before a round's `lockout_at`, query all wallets in that competition where `committed_total < minimum_required` and haven't been reminded yet, send a push/email, and mark as sent (idempotency matters here — don't double-send on a retry)
- Settlement-complete notifications (results are in, here's your payout) and league-standings-change notifications (a rival overtook you) are natural fast-follow additions to the same infrastructure once the basic lockout reminder is working
- User-level notification preferences (opt out of push, keep email, etc.) — standard but easy to forget until a user asks for it

## Ad-boost / ad revenue model

Users can earn bonus nuts each round by watching short ads, up to a cap of **1000 nuts per round** with no limit on how many individual ad views it takes to reach that cap (at 50 nuts per view, that's up to 20 ad views per round). The cap resets at the start of every new round, so a highly engaged user could watch up to 20 ads every single gameweek — this is intentional and is the primary revenue mechanism.

### ad_views
| column | type | notes |
|---|---|---|
| id | serial | |
| user_id | uuid (FK) | |
| competition_id | int (FK) | which competition's wallet received the boost |
| round_id | int (FK) | for capping per round and revenue reporting |
| nuts_earned | int | always 50 for now; could vary by ad type later |
| ad_provider_ref | text | impression ID from the ad network for revenue reconciliation |
| viewed_at | timestamptz | |

### Notes
- The per-round 1000-nut cap is enforced server-side: `SUM(nuts_earned) WHERE user_id = ? AND round_id = ?` must be < 1000 before crediting any new view. Client-side enforcement alone is not enough since a determined user could call the credit API directly without actually watching an ad.
- Real ad network integration (e.g. Google AdMob for mobile, Google Ad Manager or Carbon Ads for web) means ad views are verified by the ad network before the server credits nuts — the server receives a callback from the ad provider confirming the view, not just a client-side "I watched it" claim.
- Revenue opportunity: at scale, even modest CPM rates ($3-8 per 1000 impressions is typical for rewarded video on mobile sports apps) across a user base watching 10-20 ads per gameweek per active competition starts adding up. Worth tracking `ad_provider_ref` from day one so revenue per impression can be attributed and optimised.
- This is the first genuinely recurring revenue mechanic in BYN (ad revenue per engagement), distinct from the one-time league slot purchases.

## Referral system

Every user gets a unique referral code on signup. When a new user signs up using that code, **both** the referrer and the new user receive 500 nuts — each choosing which competition's wallet the bonus goes to. There is no cap on how many friends can be referred (unlimited 500-nut bonuses per successful referral), but the bonus only applies to new registrations — an existing user entering someone's code later gets nothing.

### referral_codes
| column | type | notes |
|---|---|---|
| user_id | uuid (FK) | one code per user, generated at signup |
| code | text | unique, 6-char alphanumeric |

### referrals
| column | type | notes |
|---|---|---|
| id | serial | |
| referrer_id | uuid (FK) | the user who shared the code |
| referee_id | uuid (FK) | the new user who used the code |
| referrer_comp_id | int (FK) | which competition the referrer applied their 500 nuts to |
| referee_comp_id | int (FK) | which competition the new user applied their 500 nuts to |
| bonus_amount | int | 500 for both parties |
| created_at | timestamptz | |

### Notes
- The referee's bonus is applied at signup (they choose the competition during registration). The referrer's bonus is applied asynchronously — a job or webhook triggers when the new user completes registration and credits the referrer's chosen competition wallet.
- "New registration only" is enforced by checking `referee_id` doesn't already exist in `profiles` before crediting either party — prevents existing users gaming the system by re-registering.
- Worth tracking referral source analytics over time since referral chains reveal your most influential early users — useful for community management and potential ambassador programs.

## Scheduled jobs (cron)
1. **Sync fixtures** — pull upcoming EPL fixtures from the sports data feed, create `gameweeks`/`fixtures`/`markets` rows ahead of each week
2. **Lockout job** — runs at each gameweek's `lockout_at`: for any wallet with `committed_total < 500`, set `forfeited_amount` and flip `locked = true`; flip all that gameweek's `markets.status` to locked
3. **Settlement job** — triggered when fixture results come in: mark fixture finished, settle all bets on that market (payout = shares if outcome matches, else 0), once all fixtures in a gameweek are settled, write `gameweek_standings` rows and roll wallets to next gameweek's fresh 1000

## Stack recap
- Frontend: Next.js (React)
- Backend: Node.js (likely Next.js API routes / server actions to start — simpler than a separate service for v1)
- DB: Postgres via Supabase (also gives us Auth + cron via pg_cron or Supabase Edge Functions for free)
- Sports data: external fixtures/results feed, polled by the sync job
