// constants.js — BYN static data
// Moved out of App.jsx to reduce initial bundle size

// ── Categories ────────────────────────────────────────────────────────────────
export const CATEGORIES = [
  { key: "football",         name: "Football" },
  { key: "rugby",            name: "Rugby" },
  { key: "basketball",       name: "Basketball" },
  { key: "tennis",           name: "Tennis" },
  { key: "american_football",name: "American Football" },
  { key: "cricket",          name: "Cricket" },
  { key: "motorsport",       name: "Motorsport" },
  { key: "golf",             name: "Golf" },
];

// ── Team pools — realistic de-vigged opening probabilities ────────────────────
// Format: [home_prob, draw_prob, away_prob]
// Premier League 2026-27 — Gameweek 1 fixtures (21-24 Aug 2026)
// Probabilities are de-vigged opening estimates
export const TEAM_POOL_EPL = [
  ["Arsenal",          "Coventry City",     [0.78, 0.12, 0.10]],
  ["Hull City",        "Man United",        [0.32, 0.26, 0.42]],
  ["Everton",          "Crystal Palace",    [0.44, 0.27, 0.29]],
  ["Ipswich Town",     "Sunderland",        [0.42, 0.28, 0.30]],
  ["Nottm Forest",     "Leeds United",      [0.48, 0.26, 0.26]],
  ["Brentford",        "Tottenham",         [0.36, 0.26, 0.38]],
  ["Brighton",         "Aston Villa",       [0.40, 0.27, 0.33]],
  ["Man City",         "Bournemouth",       [0.72, 0.15, 0.13]],
  ["Newcastle United", "Liverpool",         [0.38, 0.27, 0.35]],
  ["Fulham",           "Chelsea",           [0.34, 0.27, 0.39]],
];
export const TEAM_POOL_LA_LIGA = [
  ["Real Madrid",    "Barcelona",       [0.40, 0.25, 0.35]],
  ["Atletico Madrid","Sevilla",         [0.50, 0.26, 0.24]],
  ["Villarreal",     "Athletic Club",   [0.42, 0.27, 0.31]],
  ["Real Betis",     "Valencia",        [0.44, 0.27, 0.29]],
  ["Real Sociedad",  "Getafe",          [0.52, 0.26, 0.22]],
];
export const TEAM_POOL_UCL = [
  ["Real Madrid",   "Bayern Munich",   [0.42, 0.26, 0.32]],
  ["Man City",      "PSG",             [0.48, 0.25, 0.27]],
  ["Inter Milan",   "Barcelona",       [0.35, 0.27, 0.38]],
];
export const TEAM_POOL_FIFA_WC = [
  ["Brazil",  "Argentina", [0.40, 0.00, 0.60]],
  ["France",  "England",   [0.55, 0.00, 0.45]],
  ["Germany", "Spain",     [0.48, 0.00, 0.52]],
];
export const TEAM_POOL_EUROS = [
  ["England", "Germany",  [0.43, 0.26, 0.31]],
  ["France",  "Spain",    [0.40, 0.27, 0.33]],
  ["Italy",   "Portugal", [0.38, 0.28, 0.34]],
];
export const TEAM_POOL_SIX_NATIONS = [
  ["England", "France",  [0.44, 0.14, 0.42]],
  ["Ireland", "Wales",   [0.65, 0.10, 0.25]],
  ["Scotland","Italy",   [0.58, 0.12, 0.30]],
];
export const TEAM_POOL_RUGBY_WC = [
  ["New Zealand",  "South Africa", [0.48, 0.10, 0.42]],
  ["England",      "France",       [0.40, 0.12, 0.48]],
  ["Ireland",      "Australia",    [0.55, 0.11, 0.34]],
];
export const TEAM_POOL_PREM_RUGBY = [
  ["Leicester Tigers","Saracens",          [0.46, 0.12, 0.42]],
  ["Bath",            "Northampton Saints",[0.50, 0.12, 0.38]],
  ["Sale Sharks",     "Exeter Chiefs",     [0.44, 0.13, 0.43]],
];
export const TEAM_POOL_URC = [
  ["Leinster",   "Bulls",     [0.55, 0.13, 0.32]],
  ["Stormers",   "Munster",   [0.44, 0.14, 0.42]],
  ["Glasgow",    "Sharks",    [0.46, 0.13, 0.41]],
  ["Lions",      "Ulster",    [0.42, 0.14, 0.44]],
];
export const TEAM_POOL_SUPER_RUGBY = [
  ["Crusaders",  "Blues",       [0.46, 0.10, 0.44]],
  ["Hurricanes", "Chiefs",      [0.48, 0.10, 0.42]],
  ["Brumbies",   "Highlanders", [0.50, 0.11, 0.39]],
];
export const TEAM_POOL_NATIONS_CHAMP = [
  ["South Africa", "England",     [0.58, 0.13, 0.29]],
  ["New Zealand",  "France",      [0.52, 0.14, 0.34]],
  ["Ireland",      "Australia",   [0.55, 0.14, 0.31]],
  ["Argentina",    "Scotland",    [0.48, 0.14, 0.38]],
  ["Fiji",         "Wales",       [0.44, 0.14, 0.42]],
  ["Japan",        "Italy",       [0.46, 0.14, 0.40]],
];
export const TEAM_POOL_RUGBY_CHAMP = [
  ["South Africa", "New Zealand", [0.46, 0.12, 0.42]],
  ["Argentina",    "Australia",   [0.48, 0.12, 0.40]],
  ["New Zealand",  "Argentina",   [0.55, 0.12, 0.33]],
];
export const TEAM_POOL_NFL = [
  ["Chiefs",   "Bills",    [0.55, 0.00, 0.45]],
  ["Eagles",   "Cowboys",  [0.48, 0.00, 0.52]],
  ["49ers",    "Ravens",   [0.43, 0.00, 0.57]],
  ["Packers",  "Bears",    [0.52, 0.00, 0.48]],
  ["Dolphins", "Patriots", [0.58, 0.00, 0.42]],
];
export const TEAM_POOL_NBA = [
  ["Celtics",  "Lakers",  [0.58, 0.00, 0.42]],
  ["Warriors", "Bucks",   [0.52, 0.00, 0.48]],
  ["Nuggets",  "Heat",    [0.55, 0.00, 0.45]],
];
// Combined ATP + WTA team pool for tennis (used when live API is unavailable)
export const TEAM_POOL_TENNIS = [
  ["[M] Sinner",   "[M] Alcaraz",   [0.48, 0.00, 0.52]],
  ["[M] Djokovic", "[M] Zverev",    [0.55, 0.00, 0.45]],
  ["[W] Swiatek",  "[W] Sabalenka", [0.52, 0.00, 0.48]],
  ["[W] Gauff",    "[W] Rybakina",  [0.45, 0.00, 0.55]],
];
export const TEAM_POOL_IPL = [
  ["Mumbai Indians",   "Chennai Super Kings", [0.48, 0.04, 0.48]],
  ["RCB",              "Kolkata Knight Riders",[0.45, 0.04, 0.51]],
  ["Gujarat Titans",   "Rajasthan Royals",    [0.50, 0.04, 0.46]],
];

// ── Outright fields ───────────────────────────────────────────────────────────
export const DRIVER_FIELD  = ["Kimi Antonelli","George Russell","Charles Leclerc","Lewis Hamilton","Lando Norris","Oscar Piastri","Max Verstappen","Isack Hadjar","Carlos Sainz","Alexander Albon","Liam Lawson","Arvid Lindblad","Fernando Alonso","Lance Stroll","Esteban Ocon","Oliver Bearman","Nico Hülkenberg","Gabriel Bortoleto","Pierre Gasly","Franco Colapinto","Sergio Pérez","Valtteri Bottas"];
export const DRIVER_PROBS  = [0.20,0.17,0.12,0.11,0.08,0.07,0.06,0.03,0.03,0.02,0.02,0.01,0.01,0.01,0.01,0.01,0.01,0.01,0.01,0.00,0.00,0.00];
export const MOTOGP_FIELD  = ["Bagnaia","M.Marquez","Martin","Bastianini","Di Giannantonio","Binder","Acosta","Vinales"];
export const MOTOGP_PROBS  = [0.28, 0.25, 0.18, 0.10, 0.07, 0.05, 0.04, 0.03];
export const NASCAR_FIELD  = ["Hamlin","Larson","Elliott","Byron","Blaney","Truex Jr","Bell","Keselowski"];
export const NASCAR_PROBS  = [0.18, 0.17, 0.15, 0.13, 0.12, 0.10, 0.08, 0.07];
export const GOLFER_FIELD  = ["Scheffler","McIlroy","Rahm","Schauffele","Morikawa","Hovland","Spieth","DeChambeau"];
export const GOLFER_PROBS  = [0.24, 0.18, 0.14, 0.12, 0.10, 0.09, 0.07, 0.06];

// ── Round names ───────────────────────────────────────────────────────────────
export const F1_ROUNDS      = ["Monaco GP","Silverstone GP","Monza GP","Suzuka GP","Las Vegas GP"];
export const MOTOGP_ROUNDS  = ["Mugello MotoGP","Catalunya MotoGP","Silverstone MotoGP","Misano MotoGP","Valencia MotoGP"];
export const NASCAR_ROUNDS  = ["Daytona 500","Talladega","Bristol","Charlotte Motor Speedway","Phoenix"];
export const PGA_ROUNDS     = ["The Masters","PGA Championship","The Open","US Open","The Players"];

// ── Competitions ──────────────────────────────────────────────────────────────
// active: true = visible in UI. Set false to hide without deleting.
export const COMPETITIONS = [
  { key: "epl",          category: "football",          name: "Premier League",       icon: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", cadenceLabel: "Gameweek",   format: "three_way",         teamPool: TEAM_POOL_EPL,            midLabel: "Draw", special: false, baseLiquidity: 400, active: true  },
  { key: "laliga",       category: "football",          name: "La Liga",              icon: "🇪🇸", cadenceLabel: "Matchday",   format: "three_way",         teamPool: TEAM_POOL_LA_LIGA,        midLabel: "Draw", special: false, baseLiquidity: 380, active: true  },
  { key: "ucl",          category: "football",          name: "Champions League",     icon: "⭐", cadenceLabel: "Matchweek",  format: "three_way",         teamPool: TEAM_POOL_UCL,            midLabel: "Draw", special: false, baseLiquidity: 380, active: false },
  { key: "fifa_wc",      category: "football",          name: "FIFA WC 26",           icon: "🏆", cadenceLabel: "Round",      format: "three_way_no_draw", teamPool: TEAM_POOL_FIFA_WC,                          special: false, baseLiquidity: 450, active: true  },
  { key: "euros",        category: "football",          name: "Euros",                icon: "🇪🇺", cadenceLabel: "Round",      format: "three_way",         teamPool: TEAM_POOL_EUROS,          midLabel: "Draw", special: true,  baseLiquidity: 420, active: false },
  { key: "six_nations",  category: "rugby",             name: "Six Nations",          icon: "🌍", cadenceLabel: "Round",      format: "three_way",         teamPool: TEAM_POOL_SIX_NATIONS,    midLabel: "Draw", special: true,  baseLiquidity: 150, active: false },
  { key: "rugby_wc",     category: "rugby",             name: "Rugby World Cup",      icon: "🏆", cadenceLabel: "Round",      format: "three_way",         teamPool: TEAM_POOL_RUGBY_WC,       midLabel: "Draw", special: true,  baseLiquidity: 180, active: false },
  { key: "prem_rugby",   category: "rugby",             name: "Premiership Rugby",    icon: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", cadenceLabel: "Round",      format: "three_way",         teamPool: TEAM_POOL_PREM_RUGBY,     midLabel: "Draw", special: false, baseLiquidity: 100, active: false },
  { key: "urc",          category: "rugby",             name: "URC",                  icon: "🌍", cadenceLabel: "Round",      format: "three_way",         teamPool: TEAM_POOL_URC,            midLabel: "Draw", special: false, baseLiquidity: 120, active: false },
  { key: "super_rugby",  category: "rugby",             name: "Super Rugby",          icon: "🌏", cadenceLabel: "Round",      format: "three_way_no_draw", teamPool: TEAM_POOL_SUPER_RUGBY,                      special: false, baseLiquidity: 120, active: false },
  { key: "nations_champ",category: "rugby",             name: "Nations Champ.",       icon: "🌐", cadenceLabel: "Round",      format: "three_way",         teamPool: TEAM_POOL_NATIONS_CHAMP,  midLabel: "Draw", special: false, baseLiquidity: 200, active: true  },
  { key: "rugby_champ",  category: "rugby",             name: "Rugby Champ.",         icon: "🏉", cadenceLabel: "Round",      format: "three_way",         teamPool: TEAM_POOL_RUGBY_CHAMP,    midLabel: "Draw", special: false, baseLiquidity: 160, active: false },
  { key: "nfl",          category: "american_football", name: "NFL",                  icon: "🏈", cadenceLabel: "Week",       format: "three_way_no_draw", teamPool: TEAM_POOL_NFL,                              special: false, baseLiquidity: 380, active: true  },
  { key: "nba",          category: "basketball",        name: "NBA",                  icon: "🏀", cadenceLabel: "Gameweek",   format: "three_way_no_draw", teamPool: TEAM_POOL_NBA,                              special: false, baseLiquidity: 350, active: false },
  { key: "ipl",          category: "cricket",           name: "IPL",                  icon: "🏏", cadenceLabel: "Match day",  format: "three_way",         teamPool: TEAM_POOL_IPL,            midLabel: "Tie",  special: false, baseLiquidity: 150, active: false },
  { key: "tennis",       category: "tennis",            name: "Wimbledon",            icon: "🎾", cadenceLabel: "Round",      format: "three_way_no_draw", teamPool: TEAM_POOL_TENNIS,                           special: false, baseLiquidity: 250, active: true  },
  { key: "f1",           category: "motorsport",        name: "F1",                   icon: "🏎️", cadenceLabel: "Race",       format: "outright",          field: DRIVER_FIELD,  fieldProbs: DRIVER_PROBS,  roundNames: F1_ROUNDS,     special: false, baseLiquidity: 280, active: true  },
  { key: "motogp",       category: "motorsport",        name: "MotoGP",               icon: "🏍️", cadenceLabel: "Race",       format: "outright",          field: MOTOGP_FIELD,  fieldProbs: MOTOGP_PROBS,  roundNames: MOTOGP_ROUNDS, special: false, baseLiquidity: 220, active: false },
  { key: "nascar",       category: "motorsport",        name: "NASCAR",               icon: "🏁", cadenceLabel: "Race",       format: "outright",          field: NASCAR_FIELD,  fieldProbs: NASCAR_PROBS,  roundNames: NASCAR_ROUNDS, special: false, baseLiquidity: 180, active: false },
  { key: "pga",          category: "golf",              name: "The Open",             icon: "⛳", cadenceLabel: "Tournament", format: "outright",          field: GOLFER_FIELD,  fieldProbs: GOLFER_PROBS,  roundNames: PGA_ROUNDS,    special: false, baseLiquidity: 200, active: true  },
];

// ── Game constants ────────────────────────────────────────────────────────────
export const MIN_COMMIT_FRACTION = 0.5;
export const WEEKLY_TOPUP = 1000;
export const SEASON_LENGTH_DEMO = 4;
export const BASE_LEAGUE_SLOTS = 3;
export const MAX_MEMBERS = 100;
export const AD_BOOST_PER_VIEW = 50;
export const AD_BOOST_MAX = 1000;

// ── Bots (remove before go-live) ─────────────────────────────────────────────
export const BOTS = ["turf_tom","kop_end_kid","9pointer","matchday_mo","blue_or_bust","gunner_84"];

// ── Countries & flags ─────────────────────────────────────────────────────────
export const COUNTRIES = [
  "England","Scotland","Wales","Ireland","USA",
  "India","Australia","Canada","New Zealand","Nigeria","South Africa"
];
export const FLAG_MAP = {
  "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "Ireland": "🇮🇪", "USA": "🇺🇸", "India": "🇮🇳",
  "Australia": "🇦🇺", "Canada": "🇨🇦", "New Zealand": "🇳🇿",
  "Nigeria": "🇳🇬", "South Africa": "🇿🇦",
};
