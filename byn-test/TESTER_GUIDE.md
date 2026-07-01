# BYN — Bet Your Nuts
## Beta Tester Guide (Mock / No Backend)

This is a play-money sports prediction market. Nothing here involves real money.
Your feedback will shape what gets built next, so please be specific about anything that feels confusing, broken, or missing.

---

## How to access the test version

**Option A — CodeSandbox (easiest, no install)**
1. Go to codesandbox.io and create a free account
2. New sandbox → Import from ZIP → upload the `byn-test` folder as a zip
3. Click the share button and send the URL to testers

**Option B — Run locally**
1. Install Node.js from nodejs.org (one-time install)
2. Open a terminal in the `byn-test` folder
3. Run: `npm install`
4. Run: `npm run dev`
5. Open: http://localhost:5173

**Option C — Deploy to web (share a real URL)**
1. Complete Option B steps 1-3
2. Run: `npm run build`
3. Upload the contents of the `dist/` folder to your web hosting (e.g. southscale.co.uk)
4. Share the URL

---

## Important things to know before testing

- **All data resets when you refresh the page.** Nothing is saved between sessions — this is intentional for the mock.
- **Rounds are compressed for testing.** A real season is 38 gameweeks; the demo uses 4 rounds so you can see the full season arc (including balance reset) quickly.
- **Bot players are simulated.** Six automated opponents place bets each round so leaderboards have real competition.
- **Special events (World Cup, Euros, Six Nations, Rugby World Cup) are gated** — they show a "not running" screen by default with a demo preview button.

---

## Test scenarios — please work through these in order

### 1. Sign-up flow
- [ ] Enter a display name and select your country
- [ ] Try entering a name with a swear word — it should be blocked with an error message
- [ ] Try clicking Continue without ticking the age confirmation — button should stay disabled
- [ ] Tick the age confirmation and proceed
- **What to check:** Does the sign-up flow feel clear? Is the 17+ age gate prominent enough?

### 2. How to Play (pre-login)
- [ ] Before signing in, tap "How does this work?"
- [ ] Read through all sections
- [ ] Tap "Back to sign up" and complete sign-in
- **What to check:** Is the explanation clear to someone who has never used a prediction market? What's confusing?

### 3. Upcoming round — Football / EPL
- [ ] After sign-in you should see the EPL Upcoming screen with fixture odds
- [ ] Read the timeline banner (opens 5 days before → locks 1 hour before)
- [ ] Tap "Open betting window" to start the round
- **What to check:** Does the upcoming state make sense? Does showing odds before betting opens feel useful?

### 4. Placing bets
- [ ] Select a fixture (e.g. Arsenal vs Chelsea)
- [ ] Select an outcome (home win, draw, away win)
- [ ] Use the slider to set a stake amount
- [ ] Tap "Place bet" and watch the price change
- [ ] Place multiple bets on different fixtures
- [ ] Try placing two bets on the same fixture (different outcomes) and check they both appear in Your Bets
- [ ] Check the wallet bar — it should track your committed amount vs the 50% minimum
- **What to check:** Is the betting flow intuitive? Does the price movement make sense to you?

### 5. Lockout and forfeiture
- [ ] Try advancing to lockout WITHOUT meeting the 50% minimum — you should see a forfeiture warning
- [ ] Start a fresh round, this time meet the minimum, then advance to lockout — no forfeiture
- **What to check:** Is the forfeiture rule communicated clearly enough in advance? Would you have known about it without the warning?

### 6. Results
- [ ] After lockout, tap "Simulate results & settle round"
- [ ] Check that winning bets show in green, losing bets in red, postponed in amber
- [ ] If you placed multiple bets on the same fixture, check all results appear
- **What to check:** Are the results easy to understand at a glance? Is the payout/loss amount clear?

### 7. Season arc
- [ ] Play through all 4 rounds of EPL
- [ ] After round 4, check that the balance resets to 0 for the new season
- [ ] Verify the season leaderboard shows your history
- **What to check:** Does the season reset feel fair? Is the leaderboard ranking meaningful?

### 8. Sport switching
- [ ] Switch from Football to Rugby (category pill at top)
- [ ] Try Premiership Rugby (regular weekly league)
- [ ] Try Six Nations (gated — should show "not running" screen)
- [ ] Switch to Motorsport → try F1 (outright field of 8 drivers) vs MotoGP vs NASCAR
- [ ] Switch to Basketball → NBA, Tennis → ATP/WTA
- **What to check:** Does each sport feel distinct? Is the outright market (F1/PGA/MotoGP) format clear?

### 9. Leagues
- [ ] Go to the Leagues tab
- [ ] Create a private league (try a rude name — it should be blocked)
- [ ] Note the "pending" status — it flips to "approved" after a short delay
- [ ] Copy the invite code and try joining a second league using it in a new browser tab (or just check the flow)
- [ ] Try creating 6 leagues — the 6th should be blocked with a cap message
- **What to check:** Is the invite code flow clear? Does the approval delay feel odd, or acceptable?

### 10. Rankings
- [ ] Go to the Rankings tab
- [ ] Set a favourite team for the current sport
- [ ] Switch between Global / Country / Favourite Team filters
- [ ] Note that country and favourite team are locked once round 1 is over (season lock)
- **What to check:** Is the season-lock rule on country/team clearly communicated? Are the three leaderboard views useful?

### 11. Profile
- [ ] Open the Profile screen (person icon + flag in the top-right)
- [ ] Check your username, country, and league slot usage are shown correctly
- [ ] Play a few rounds across two different sports, then check the Profile — it should show active games grouped by sport
- **What to check:** Is the profile summary useful? What information is missing that you'd want to see?

### 12. How to Play (in-app)
- [ ] Open How to Play (? icon in top-right)
- [ ] Read through — check it makes sense now that you've played a round
- [ ] Check the sport nav still works while in How to Play
- **What to check:** Is there anything in the actual game that the How to Play doesn't explain?

---

## Feedback format

Please share feedback in any format that's easiest for you, but specifically note:

1. **Broken:** anything that didn't work as expected
2. **Confusing:** anything you didn't understand on first read
3. **Missing:** features or information you expected to find but couldn't
4. **Suggestion:** anything you'd change or add

---

## Known limitations of this mock (not bugs)

- All data resets on page refresh — no persistence
- Push notifications aren't real (placeholder only)
- Odds are simulated, not live bookmaker data
- Company-sponsored leagues aren't built yet
- Purchasing extra league slots isn't wired up (shows placeholder)
- Special event dates (World Cup, Euros etc.) are simulated — the real app will gate these against actual tournament calendars
