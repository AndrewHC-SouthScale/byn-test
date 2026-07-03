import { useState, useMemo, useEffect } from "react";
import { supabase } from "./supabase.js";
import { ensureProfile, isDisplayNameTaken } from "./profileService.js";
import { loadUserState, persistBalance, applyRoundTopup, resetSeasonBalances, initRoundMarketsInDB, saveBetToDB, settleBetsInDB } from "./persistenceManager.js";
import { fetchUpcomingFixtures } from "./oddsService.js";
import { Trophy, Lock, CheckCircle2, AlertTriangle, ChevronRight, Award, Flame, LogIn, Wallet, CalendarClock, Eye, User, HelpCircle } from "lucide-react";

// ---------- LMSR core (outcome-count agnostic) ----------
function prices(q, b) {
  const exps = q.map((qi) => Math.exp(qi / b));
  const sum = exps.reduce((a, c) => a + c, 0);
  return exps.map((e) => e / sum);
}
function cost(q, b) {
  return b * Math.log(q.reduce((a, qi) => a + Math.exp(qi / b), 0));
}
function sharesForBudget(q, b, i, budget) {
  let lo = 0, hi = Math.max(budget * 20, b * 5);
  const c0 = cost(q, b);
  for (let n = 0; n < 60; n++) {
    const mid = (lo + hi) / 2;
    const qt = [...q]; qt[i] += mid;
    if (cost(qt, b) - c0 > budget) hi = mid; else lo = mid;
  }
  return lo;
}

// ---------- Profanity filter ----------
const BLOCKED_SUBSTRINGS = ["fuck", "shit", "bitch", "asshole", "cunt", "nigger", "faggot", "retard", "whore", "slut", "rape"];
function normalizeForFilter(text) {
  return text.toLowerCase()
    .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a")
    .replace(/5/g, "s").replace(/7/g, "t").replace(/@/g, "a").replace(/\$/g, "s")
    .replace(/[^a-z]/g, "");
}
function containsProfanity(text) {
  if (!text) return false;
  const n = normalizeForFilter(text);
  return BLOCKED_SUBSTRINGS.some((w) => n.includes(w));
}

// ---------- Sport categories & competitions ----------
const CATEGORIES = [
  { key: "football", name: "Football" },
  { key: "rugby", name: "Rugby" },
  { key: "basketball", name: "Basketball" },
  { key: "tennis", name: "Tennis" },
  { key: "american_football", name: "American Football" },
  { key: "cricket", name: "Cricket" },
  { key: "motorsport", name: "Motorsport" },
  { key: "golf", name: "Golf" },
];

// ---------- Seed odds: realistic de-vigged opening probabilities ----------
// Format: [home_prob, draw_prob, away_prob] for three-way markets
// These approximate real bookmaker consensus lines stripped of the vig
const TEAM_POOL_EPL = [
  ["Arsenal", "Chelsea",         [0.52, 0.25, 0.23]],
  ["Liverpool", "Man City",      [0.38, 0.26, 0.36]],
  ["Spurs", "Man United",        [0.44, 0.27, 0.29]],
  ["Newcastle", "Aston Villa",   [0.45, 0.27, 0.28]],
  ["Brighton", "West Ham",       [0.48, 0.27, 0.25]],
];
const TEAM_POOL_LA_LIGA = [
  ["Real Madrid", "Barcelona",       [0.40, 0.25, 0.35]],
  ["Atletico Madrid", "Sevilla",     [0.50, 0.26, 0.24]],
  ["Villarreal", "Athletic Club",    [0.42, 0.27, 0.31]],
  ["Real Betis", "Valencia",         [0.44, 0.27, 0.29]],
  ["Real Sociedad", "Getafe",        [0.52, 0.26, 0.22]],
];
const TEAM_POOL_UCL = [
  ["Real Madrid", "Bayern Munich", [0.42, 0.26, 0.32]],
  ["Man City", "PSG",              [0.48, 0.25, 0.27]],
  ["Inter Milan", "Barcelona",     [0.35, 0.27, 0.38]],
];
const TEAM_POOL_FIFA_WC = [
  ["Brazil", "Argentina",  [0.40, 0.27, 0.33]],
  ["France", "England",    [0.45, 0.26, 0.29]],
  ["Germany", "Spain",     [0.36, 0.28, 0.36]],
];
const TEAM_POOL_EUROS = [
  ["England", "Germany",  [0.43, 0.26, 0.31]],
  ["France", "Spain",     [0.40, 0.27, 0.33]],
  ["Italy", "Portugal",   [0.38, 0.28, 0.34]],
];
const TEAM_POOL_SIX_NATIONS = [
  ["England", "France",  [0.44, 0.14, 0.42]],
  ["Ireland", "Wales",   [0.65, 0.10, 0.25]],
  ["Scotland", "Italy",  [0.58, 0.12, 0.30]],
];
const TEAM_POOL_RUGBY_WC = [
  ["New Zealand", "South Africa", [0.48, 0.10, 0.42]],
  ["England", "France",           [0.40, 0.12, 0.48]],
  ["Ireland", "Australia",        [0.55, 0.11, 0.34]],
];
const TEAM_POOL_PREM_RUGBY = [
  ["Leicester Tigers", "Saracens",        [0.46, 0.12, 0.42]],
  ["Bath", "Northampton Saints",          [0.50, 0.12, 0.38]],
  ["Sale Sharks", "Exeter Chiefs",        [0.44, 0.13, 0.43]],
];
const TEAM_POOL_NFL = [
  ["Chiefs", "Bills",         [0.55, 0.00, 0.45]],
  ["Eagles", "Cowboys",       [0.48, 0.00, 0.52]],
  ["49ers", "Ravens",         [0.43, 0.00, 0.57]],
  ["Packers", "Bears",        [0.52, 0.00, 0.48]],
  ["Dolphins", "Patriots",    [0.58, 0.00, 0.42]],
];
const TEAM_POOL_NBA = [
  ["Celtics", "Lakers",    [0.58, 0.00, 0.42]],
  ["Warriors", "Bucks",    [0.52, 0.00, 0.48]],
  ["Nuggets", "Heat",      [0.55, 0.00, 0.45]],
];
const TEAM_POOL_ATP = [
  ["Sinner", "Alcaraz",   [0.48, 0.00, 0.52]],
  ["Djokovic", "Zverev",  [0.55, 0.00, 0.45]],
  ["Medvedev", "Rublev",  [0.60, 0.00, 0.40]],
];
const TEAM_POOL_WTA = [
  ["Swiatek", "Sabalenka",  [0.52, 0.00, 0.48]],
  ["Gauff", "Rybakina",     [0.45, 0.00, 0.55]],
  ["Pegula", "Jabeur",      [0.50, 0.00, 0.50]],
];
const TEAM_POOL_IPL = [
  ["Mumbai Indians", "Chennai Super Kings", [0.48, 0.04, 0.48]],
  ["RCB", "Kolkata Knight Riders",          [0.45, 0.04, 0.51]],
  ["Gujarat Titans", "Rajasthan Royals",    [0.50, 0.04, 0.46]],
];
const DRIVER_FIELD = ["Verstappen", "Norris", "Leclerc", "Hamilton", "Russell", "Piastri", "Sainz", "Alonso"];
const DRIVER_PROBS  = [0.32, 0.22, 0.13, 0.10, 0.08, 0.07, 0.05, 0.03];
const MOTOGP_FIELD = ["Bagnaia", "M.Marquez", "Martin", "Bastianini", "Di Giannantonio", "Binder", "Acosta", "Vinales"];
const MOTOGP_PROBS  = [0.28, 0.25, 0.18, 0.10, 0.07, 0.05, 0.04, 0.03];
const NASCAR_FIELD = ["Hamlin", "Larson", "Elliott", "Byron", "Blaney", "Truex Jr", "Bell", "Keselowski"];
const NASCAR_PROBS  = [0.18, 0.17, 0.15, 0.13, 0.12, 0.10, 0.08, 0.07];
const GOLFER_FIELD = ["Scheffler", "McIlroy", "Rahm", "Schauffele", "Morikawa", "Hovland", "Spieth", "DeChambeau"];
const GOLFER_PROBS  = [0.24, 0.18, 0.14, 0.12, 0.10, 0.09, 0.07, 0.06];
function probsToQ(probs, b) { return probs.map((p) => b * Math.log(Math.max(p, 0.001))); }
const F1_ROUNDS = ["Monaco GP", "Silverstone GP", "Monza GP", "Suzuka GP", "Las Vegas GP"];
const MOTOGP_ROUNDS = ["Mugello MotoGP", "Catalunya MotoGP", "Silverstone MotoGP", "Misano MotoGP", "Valencia MotoGP"];
const NASCAR_ROUNDS = ["Daytona 500", "Talladega", "Bristol", "Charlotte Motor Speedway", "Phoenix"];
const PGA_ROUNDS = ["The Masters", "PGA Championship", "The Open", "US Open", "The Players"];

// active: true = visible in UI. Set false to hide without deleting — re-enable when ready.
const COMPETITIONS = [
  { key: "epl",         category: "football",         name: "EPL",              cadenceLabel: "Gameweek",   format: "three_way",        teamPool: TEAM_POOL_EPL,         midLabel: "Draw", special: false, baseLiquidity: 400, active: true  },
  { key: "laliga",      category: "football",         name: "La Liga",          cadenceLabel: "Matchday",   format: "three_way",        teamPool: TEAM_POOL_LA_LIGA,     midLabel: "Draw", special: false, baseLiquidity: 380, active: true  },
  { key: "ucl",         category: "football",         name: "Champions League", cadenceLabel: "Matchweek",  format: "three_way",        teamPool: TEAM_POOL_UCL,         midLabel: "Draw", special: false, baseLiquidity: 380, active: false },
  { key: "fifa_wc",     category: "football",         name: "World Cup",        cadenceLabel: "Round",      format: "three_way",        teamPool: TEAM_POOL_FIFA_WC,     midLabel: "Draw", special: false, baseLiquidity: 450, active: true  },
  { key: "euros",       category: "football",         name: "Euros",            cadenceLabel: "Round",      format: "three_way",        teamPool: TEAM_POOL_EUROS,       midLabel: "Draw", special: true,  baseLiquidity: 420, active: false },
  { key: "six_nations", category: "rugby",            name: "Six Nations",      cadenceLabel: "Round",      format: "three_way",        teamPool: TEAM_POOL_SIX_NATIONS, midLabel: "Draw", special: true,  baseLiquidity: 150, active: false },
  { key: "rugby_wc",    category: "rugby",            name: "Rugby World Cup",  cadenceLabel: "Round",      format: "three_way",        teamPool: TEAM_POOL_RUGBY_WC,    midLabel: "Draw", special: true,  baseLiquidity: 180, active: false },
  { key: "prem_rugby",  category: "rugby",            name: "Premiership Rugby",cadenceLabel: "Round",      format: "three_way",        teamPool: TEAM_POOL_PREM_RUGBY,  midLabel: "Draw", special: false, baseLiquidity: 100, active: false },
  { key: "nfl",         category: "american_football",name: "NFL",              cadenceLabel: "Week",       format: "three_way_no_draw",teamPool: TEAM_POOL_NFL,                           special: false, baseLiquidity: 380, active: true  },
  { key: "nba",         category: "basketball",       name: "NBA",              cadenceLabel: "Gameweek",   format: "three_way_no_draw",teamPool: TEAM_POOL_NBA,                           special: false, baseLiquidity: 350, active: false },
  { key: "ipl",         category: "cricket",          name: "IPL",              cadenceLabel: "Match day",  format: "three_way",        teamPool: TEAM_POOL_IPL,         midLabel: "Tie",  special: false, baseLiquidity: 150, active: false },
  { key: "atp",         category: "tennis",           name: "ATP Wimbledon",   cadenceLabel: "Round",      format: "three_way_no_draw",teamPool: TEAM_POOL_ATP,                           special: false, baseLiquidity: 250, active: true  },
  { key: "wta",         category: "tennis",           name: "WTA Wimbledon",   cadenceLabel: "Round",      format: "three_way_no_draw",teamPool: TEAM_POOL_WTA,                           special: false, baseLiquidity: 220, active: true  },
  { key: "f1",          category: "motorsport",       name: "F1",               cadenceLabel: "Race",       format: "outright",         field: DRIVER_FIELD, fieldProbs: DRIVER_PROBS,    roundNames: F1_ROUNDS,     special: false, baseLiquidity: 280, active: true  },
  { key: "motogp",      category: "motorsport",       name: "MotoGP",           cadenceLabel: "Race",       format: "outright",         field: MOTOGP_FIELD, fieldProbs: MOTOGP_PROBS,    roundNames: MOTOGP_ROUNDS, special: false, baseLiquidity: 220, active: false },
  { key: "nascar",      category: "motorsport",       name: "NASCAR",           cadenceLabel: "Race",       format: "outright",         field: NASCAR_FIELD, fieldProbs: NASCAR_PROBS,    roundNames: NASCAR_ROUNDS, special: false, baseLiquidity: 180, active: false },
  { key: "pga",         category: "golf",             name: "The Open",         cadenceLabel: "Tournament", format: "outright",         field: GOLFER_FIELD, fieldProbs: GOLFER_PROBS,    roundNames: PGA_ROUNDS,    special: false, baseLiquidity: 200, active: true  },
];
const MIN_COMMIT_FRACTION = 0.5;
const WEEKLY_TOPUP = 1000;
const BOTS = ["turf_tom", "kop_end_kid", "9pointer", "matchday_mo", "blue_or_bust", "gunner_84"];
const SEASON_LENGTH_DEMO = 4; // demo-only: real seasons are much longer, shortened here so the lock/unlock cycle is visible without dozens of clicks
const COUNTRIES = ["England", "Scotland", "Wales", "Ireland", "USA", "India", "Australia", "Canada", "New Zealand", "Nigeria", "South Africa"];
const FLAG_MAP = {
  "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "Wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "Ireland": "🇮🇪",
  "USA": "🇺🇸",
  "India": "🇮🇳",
  "Australia": "🇦🇺",
  "Canada": "🇨🇦",
  "New Zealand": "🇳🇿",
  "Nigeria": "🇳🇬",
  "South Africa": "🇿🇦",
};

function roundLabel(comp, roundNum) {
  if (comp.format === "outright") return comp.roundNames[(roundNum - 1) % comp.roundNames.length];
  return `${comp.cadenceLabel} ${roundNum}`;
}

function newRoundMarkets(comp, roundNum) {
  if (comp.format === "outright") {
    const field = [...comp.field];
    const probs = comp.fieldProbs;
    return [{ id: 0, name: `${roundLabel(comp, roundNum)} — winner`, outcomes: field, q: probsToQ(probs, comp.baseLiquidity), b: comp.baseLiquidity }];
  }
  const midLabel = comp.format === "three_way" ? comp.midLabel : null;
  return comp.teamPool.map(([home, away, seedProbs], i) => {
    const outcomes = midLabel ? [home, midLabel, away] : [home, away];
    const probs = midLabel ? seedProbs : [seedProbs[0], seedProbs[2]];
    const total = probs.reduce((a, p) => a + p, 0);
    const normProbs = probs.map((p) => p / total);
    return { id: i, name: `${home} vs ${away}`, outcomes, q: probsToQ(normProbs, comp.baseLiquidity), b: comp.baseLiquidity };
  });
}

// Convert live fixtures from The Odds API into BYN market format
function liveFixturesToMarkets(fixtures, comp) {
  if (!fixtures?.length) return null;

  // Outright market (F1, PGA etc) — single market with full field
  if (fixtures[0]?.format === 'outright') {
    const f = fixtures[0];
    return [{
      id: 0,
      name: f.name,
      outcomes: f.outcomes,
      q: probsToQ(f.probabilities, comp.baseLiquidity),
      b: comp.baseLiquidity,
      kickoff: f.kickoff,
      externalId: f.externalId,
    }];
  }

  // H2H markets (football, NFL etc) — one market per fixture
  return fixtures.slice(0, 10).map((f, i) => ({
    id: i,
    name: f.name,
    outcomes: f.outcomes,
    q: probsToQ(f.probabilities, comp.baseLiquidity),
    b: comp.baseLiquidity,
    kickoff: f.kickoff,
    externalId: f.externalId,
  }));
}

function allTeamsFor(comp) {
  if (comp.format === "outright") return [];
  const set = new Set();
  comp.teamPool.forEach(([h, a]) => { set.add(h); set.add(a); });
  return [...set];
}

function randomBotProfile() {
  const profile = { country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)], favouriteTeamByComp: {} };
  COMPETITIONS.forEach((c) => {
    const teams = allTeamsFor(c);
    if (teams.length) profile.favouriteTeamByComp[c.key] = teams[Math.floor(Math.random() * teams.length)];
  });
  return profile;
}

function botBetRound(markets, balance) {
  const minRequired = balance * MIN_COMMIT_FRACTION;
  let remaining = balance;
  const target = minRequired + Math.random() * (balance - minRequired) * 0.6;
  const bets = [];
  let committed = 0, guard = 0;
  while (committed < target && remaining > 20 && guard < 8) {
    guard++;
    const m = markets[Math.floor(Math.random() * markets.length)];
    const oi = Math.floor(Math.random() * m.outcomes.length);
    const stake = Math.min(remaining, Math.round(40 + Math.random() * Math.min(220, balance * 0.2)));
    const delta = sharesForBudget(m.q, m.b, oi, stake);
    m.q[oi] += delta;
    bets.push({ marketId: m.id, outcome: oi, stake, shares: delta });
    committed += stake;
    remaining -= stake;
  }
  const forfeited = committed < minRequired ? minRequired - committed : 0;
  return { bets, committed, forfeited };
}

function initCompetitionState(comp) {
  return {
    round: 1,
    stage: "betting",
    markets: newRoundMarkets(comp, 1),
    balance: 0,
    bets: [],
    forfeit: 0,
    botBalances: Object.fromEntries(BOTS.map((b) => [b, 0])),
    botBetsThisRound: {},
    botForfeitThisRound: {},
    season: [],
    previewMode: false, // demo-only override for special events outside their real window
  };
}

function SponsorBanner({ label, sublabel, houseAd }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 14px", borderRadius: 10, marginBottom: 12,
      background: houseAd ? "#16263F" : "repeating-linear-gradient(135deg, #1B2D4D, #1B2D4D 8px, #15233D 8px, #15233D 16px)",
      border: `1px ${houseAd ? "solid" : "dashed"} #3A5C8F`,
    }}>
      <div>
        <div className="mono" style={{ fontSize: 10, color: "#7FA8D9", letterSpacing: 0.5, textTransform: "uppercase" }}>{houseAd ? "House ad — slot unsold" : "Sponsored slot"}</div>
        <div className="sg" style={{ fontSize: 13, fontWeight: 600, color: "#F4F7F2" }}>{label}</div>
      </div>
      <div style={{ fontSize: 11, color: "#9DB8D9", textAlign: "right", maxWidth: 140 }}>{sublabel}</div>
    </div>
  );
}

export default function PlatformMock() {
  const [showLoginHowTo, setShowLoginHowTo] = useState(false);
  const [screen, setScreen] = useState("login");
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setUserName(session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Player");
        // Check if profile exists — new users go to setup, returning users go to app
        const { data: existing } = await supabase
          .from('profiles')
          .select('id, display_name, country')
          .eq('id', session.user.id)
          .maybeSingle();
        if (existing) {
          if (existing.display_name) setUserName(existing.display_name);
          if (existing.country) setUserCountry(existing.country);
          const persisted = await loadUserState(session.user.id, COMPETITIONS);
          if (persisted && Object.keys(persisted).length > 0) {
            setCompData((prev) => {
              const updated = { ...prev };
              Object.entries(persisted).forEach(([key, state]) => {
                if (updated[key]) updated[key] = { ...updated[key], balance: state.balance };
              });
              return updated;
            });
          }
          setScreen("app");
        } else {
          setScreen("setup"); // new user — collect name, country, age
        }
      }
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setUserName(session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Player");
        // Check profile exists
        const { data: existing } = await supabase
          .from('profiles')
          .select('id, display_name, country')
          .eq('id', session.user.id)
          .maybeSingle();
        if (existing) {
          if (existing.display_name) setUserName(existing.display_name);
          if (existing.country) setUserCountry(existing.country);
          setScreen("app");
        } else {
          setScreen("setup");
        }
      } else {
        setScreen("login");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load live fixtures for active competitions on mount
  useEffect(() => {
    loadLiveFixtures("epl");
    loadLiveFixtures("fifa_wc");
    loadLiveFixtures("atp");
    loadLiveFixtures("wta");
    loadLiveFixtures("pga");
  }, []);

  async function signInWithGoogle() {
    setAuthError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "https://www.bynapp.online" },
    });
    if (error) setAuthError(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function completeSetup() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await ensureProfile(session.user, userName);
    if (referralInput.length >= 6) applyReferralBonus(referralBonusComp);
    const persisted = await loadUserState(session.user.id, COMPETITIONS);
    if (persisted && Object.keys(persisted).length > 0) {
      setCompData((prev) => {
        const updated = { ...prev };
        Object.entries(persisted).forEach(([key, state]) => {
          if (updated[key]) updated[key] = { ...updated[key], balance: state.balance };
        });
        return updated;
      });
    }
    setScreen("app");
  }
  const [userName, setUserName] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameTaken, setNameTaken] = useState(false);
  const [nameChecking, setNameChecking] = useState(false);
  const [nameEdited, setNameEdited] = useState(false); // only check after user types

  useEffect(() => {
    if (!nameEdited || !userName.trim() || nameError) { setNameTaken(false); return; }
    setNameChecking(true);
    const timer = setTimeout(async () => {
      const taken = await isDisplayNameTaken(userName.trim());
      setNameTaken(taken);
      setNameChecking(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [userName, nameError, nameEdited]);
  const [userCountry, setUserCountry] = useState(COUNTRIES[0]);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [userReferralCode] = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase());
  const [referralInput, setReferralInput] = useState("");
  const [referralBonusComp, setReferralBonusComp] = useState("epl");
  const [referralsEarned, setReferralsEarned] = useState(0);
  const [referralRewardComp, setReferralRewardComp] = useState("epl");
  const [copiedCode, setCopiedCode] = useState(false);
  const [favouriteTeamByComp, setFavouriteTeamByComp] = useState({});
  const [botProfiles] = useState(() => Object.fromEntries(BOTS.map((b) => [b, randomBotProfile()])));

  const [activeCategoryKey, setActiveCategoryKey] = useState("football");
  const [activeCompKey, setActiveCompKey] = useState("epl");
  const [tab, setTab] = useState("markets");
  const [compData, setCompData] = useState(() => Object.fromEntries(COMPETITIONS.map((c) => [c.key, initCompetitionState(c)])));

  const [stakeInput, setStakeInput] = useState(150);
  const [selMarket, setSelMarket] = useState(0);
  const [selOutcome, setSelOutcome] = useState(0);

  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupNameError, setGroupNameError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [activeGroupId, setActiveGroupId] = useState(null);
  const BASE_LEAGUE_SLOTS = 3;
  const [extraLeagueSlots] = useState(0);
  const MAX_GROUPS_PER_USER = BASE_LEAGUE_SLOTS + extraLeagueSlots;
  const MAX_MEMBERS = 100;

  const AD_BOOST_PER_VIEW = 50;
  const AD_BOOST_MAX = 1000;
  const [adBoostTotal, setAdBoostTotal] = useState(0);
  // Tracks Supabase round IDs and outcome ID maps per competition
  // { [compKey]: { roundId, dbOutcomeMap } }
  const [dbRoundState, setDbRoundState] = useState({});

  // Live fixtures loaded from The Odds API
  // { [compKey]: [{ name, outcomes, probabilities, kickoff, externalId }] }
  const [liveFixtures, setLiveFixtures] = useState({});
  const [fixturesLoading, setFixturesLoading] = useState(false);

  // Load live fixtures for the active competition
  async function loadLiveFixtures(compKey) {
    const comp = COMPETITIONS.find((c) => c.key === compKey);
    if (!comp) return;
    setFixturesLoading(true);
    try {
      const fixtures = await fetchUpcomingFixtures(compKey, 14);
      if (fixtures.length > 0) {
        setLiveFixtures((prev) => ({ ...prev, [compKey]: fixtures }));
      }
    } catch (err) {
      console.error('Error loading live fixtures:', err);
    } finally {
      setFixturesLoading(false);
    }
  }
  const [adBoostCompKey, setAdBoostCompKey] = useState("epl");
  const [adWatching, setAdWatching] = useState(false);

  function watchAd() {
    if (adBoostTotal >= AD_BOOST_MAX || adWatching) return;
    setAdWatching(true);
    setTimeout(() => {
      updateComp(adBoostCompKey, (s) => ({ ...s, balance: s.balance + AD_BOOST_PER_VIEW }));
      setAdBoostTotal((t) => Math.min(t + AD_BOOST_PER_VIEW, AD_BOOST_MAX));
      setAdWatching(false);
    }, 1500);
  }

  const comp = COMPETITIONS.find((c) => c.key === activeCompKey);
  const cd = compData[activeCompKey];
  const compsInCategory = COMPETITIONS.filter((c) => c.category === activeCategoryKey && c.active);
  const gated = comp.special && !cd.previewMode;

  function updateComp(key, fn) {
    setCompData((prev) => ({ ...prev, [key]: fn(prev[key]) }));
  }

  function selectCategory(catKey) {
    setActiveCategoryKey(catKey);
    const first = COMPETITIONS.find((c) => c.category === catKey && c.active);
    setActiveCompKey(first.key);
    setSelMarket(0);
    setSelOutcome(0);
    loadLiveFixtures(first.key);
  }

  function selectCompetition(key) {
    setActiveCompKey(key);
    setSelMarket(0);
    setSelOutcome(0);
    loadLiveFixtures(key);
  }

  const startOfRound = cd.balance + WEEKLY_TOPUP;
  const committed = cd.bets.reduce((a, b) => a + b.stake, 0);
  const remaining = startOfRound - committed;
  const minRequired = startOfRound * MIN_COMMIT_FRACTION;
  const meetsMin = committed >= minRequired;

  // Use live fixtures from Odds API if available, otherwise fall back to mock data
  const activeMarkets = useMemo(() => {
    const live = liveFixtures[activeCompKey];
    if (live?.length) {
      const converted = liveFixturesToMarkets(live, comp);
      if (converted?.length) return converted;
    }
    return cd.markets;
  }, [liveFixtures, activeCompKey, cd.markets, comp]);

  async function placeBet() {
    const stake = Math.min(stakeInput, remaining);
    if (stake <= 0) return;

    let priceBefore = 0;
    let delta = 0;
    let localMarketId = 0;

    // Update local state first for instant UI response
    updateComp(activeCompKey, (s) => {
      const markets = s.markets.map((m) => ({ ...m, q: [...m.q] }));
      const m = markets[selMarket];
      priceBefore = prices(m.q, m.b)[selOutcome];
      delta = sharesForBudget(m.q, m.b, selOutcome, stake);
      m.q[selOutcome] += delta;
      localMarketId = m.id;
      return { ...s, markets, bets: [...s.bets, { marketId: m.id, outcome: selOutcome, stake, shares: delta, priceAtExecution: priceBefore }] };
    });

    // Persist to Supabase in background
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const cd = compData[activeCompKey];
      let roundId = dbRoundState[activeCompKey]?.roundId;
      let dbOutcomeMap = dbRoundState[activeCompKey]?.dbOutcomeMap || {};


      // Lazily initialise round and markets in DB on first bet
      if (!roundId) {
        const result = await initRoundMarketsInDB(
          activeCompKey,
          cd.round,
          1,
          cd.markets
        );
        roundId = result.roundId;
        dbOutcomeMap = result.dbOutcomeMap;
        setDbRoundState((prev) => ({
          ...prev,
          [activeCompKey]: { roundId, dbOutcomeMap },
        }));
      }

      // Look up the Supabase outcome ID
      const outcomeKey = `local_${selMarket}_${selOutcome}`;
      const outcomeDbId = dbOutcomeMap[outcomeKey];


      if (outcomeDbId && roundId) {
        const saved = await saveBetToDB(session.user.id, {
          roundId,
          competitionKey: activeCompKey,
          outcomeDbId,
          stake,
          shares: delta,
          priceAtExecution: priceBefore,
        });
      } else {
      }
    } catch (err) {
      console.error('Error saving bet to DB:', err);
    }
  }

  function applyReferralBonus(compKey) {
    updateComp(compKey, (s) => ({ ...s, balance: s.balance + 500 }));
  }

  function simulateFriendJoining() {
    applyReferralBonus(referralRewardComp);
    setReferralsEarned((n) => n + 1);
  }

  function copyReferralCode() {
    navigator.clipboard?.writeText(userReferralCode).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function advanceToLockout() {
    updateComp(activeCompKey, (s) => {
      const markets = s.markets.map((m) => ({ ...m, q: [...m.q] }));
      const botBetsThisRound = {};
      const botForfeitThisRound = {};
      BOTS.forEach((name) => {
        const botStart = s.botBalances[name] + WEEKLY_TOPUP;
        const { bets, forfeited } = botBetRound(markets, botStart);
        botBetsThisRound[name] = bets;
        botForfeitThisRound[name] = forfeited;
      });
      const myForfeit = committed < minRequired ? minRequired - committed : 0;
      return { ...s, markets, botBetsThisRound, botForfeitThisRound, forfeit: myForfeit, stage: "locked" };
    });
  }

  async function simulateResults() {
    let myEndingBalance = 0;
    let resolvedMarkets = [];

    updateComp(activeCompKey, (s) => {
      const resolved = s.markets.map((m) => {
        if (Math.random() < 0.08) return { ...m, result: null, postponed: true };
        const p = prices(m.q, m.b);
        const r = Math.random();
        let cum = 0, result = m.outcomes.length - 1;
        for (let i = 0; i < m.outcomes.length; i++) { cum += p[i]; if (r <= cum) { result = i; break; } }
        return { ...m, result, postponed: false };
      });
      resolvedMarkets = resolved; // capture for DB persistence below

      const settle = (bets) => bets.reduce((acc, bet) => {
        const m = resolved.find((x) => x.id === bet.marketId);
        if (m.postponed) return { payout: acc.payout, refund: acc.refund + bet.stake };
        return { payout: acc.payout + (bet.outcome === m.result ? bet.shares : 0), refund: acc.refund };
      }, { payout: 0, refund: 0 });

      const myStart = s.balance + WEEKLY_TOPUP;
      const myCommitted = s.bets.reduce((a, b) => a + b.stake, 0);
      const mySettled = settle(s.bets);
      const myEnding = myStart - myCommitted - s.forfeit + mySettled.payout + mySettled.refund;
      myEndingBalance = myEnding;

      const newBotBalances = {};
      const rows = [];
      BOTS.forEach((name) => {
        const botStart = s.botBalances[name] + WEEKLY_TOPUP;
        const bets = s.botBetsThisRound[name] || [];
        const botCommitted = bets.reduce((a, b) => a + b.stake, 0);
        const forfeited = s.botForfeitThisRound[name] || 0;
        const botSettled = settle(bets);
        const ending = botStart - botCommitted - forfeited + botSettled.payout + botSettled.refund;
        newBotBalances[name] = ending;
        rows.push({ name, roundPayout: botSettled.payout, endingBalance: ending });
      });
      rows.push({ name: userName, roundPayout: mySettled.payout, endingBalance: myEnding });
      rows.sort((a, b) => b.endingBalance - a.endingBalance);
      const withRank = rows.map((r, i) => ({ ...r, rank: i + 1, round: s.round }));

      return { ...s, markets: resolved, balance: myEnding, botBalances: newBotBalances, season: [...s.season, ...withRank], stage: "settled" };
    });

    // Persist to Supabase
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await persistBalance(session.user.id, activeCompKey, myEndingBalance);

      // Get roundId — from memory state if available, otherwise fetch from DB
      let roundId = dbRoundState[activeCompKey]?.roundId;
      let dbOutcomeMap = dbRoundState[activeCompKey]?.dbOutcomeMap || {};

      if (!roundId) {
        // Not in memory — fetch from DB using current round number
        const currentCdForRound = compData[activeCompKey];
        const { data: roundRow } = await supabase
          .from('betting_rounds')
          .select('id')
          .eq('competition_id', (await supabase.from('competitions').select('id').eq('key', activeCompKey).maybeSingle()).data?.id)
          .eq('round_number', currentCdForRound.round)
          .maybeSingle();
        roundId = roundRow?.id;

        // Also rebuild outcome map from DB
        if (roundId) {
          const { data: markets } = await supabase
            .from('markets')
            .select('id, market_outcomes(id, sort_order)')
            .eq('round_id', roundId);
          if (markets?.length) {
            const sorted = [...markets].sort((a, b) => a.id - b.id);
            sorted.forEach((m, mi) => {
              m.market_outcomes?.sort((a, b) => a.sort_order - b.sort_order).forEach((o) => {
                dbOutcomeMap[`local_${mi}_${o.sort_order}`] = o.id;
              });
            });
          }
        }
      }

      if (roundId && resolvedMarkets.length) {
        // 1. Mark winning outcomes in market_outcomes table
        const winnerUpdates = [];
        resolvedMarkets.forEach((m, mi) => {
          if (m.postponed || m.result === null) return;
          const winnerKey = `local_${mi}_${m.result}`;
          const winnerOutcomeId = dbOutcomeMap[winnerKey];
          if (winnerOutcomeId) {
            winnerUpdates.push({ id: winnerOutcomeId, is_winner: true });
          }
        });
        if (winnerUpdates.length) {
          await supabase.from('market_outcomes').upsert(winnerUpdates);
        }

        // 2. Mark round as settled
        await supabase
          .from('betting_rounds')
          .update({ status: 'settled' })
          .eq('id', roundId);

        // 3. Settle individual bets with payouts
        const { data: unsettledBets } = await supabase
          .from('bets')
          .select('id, market_outcome_id, stake, shares')
          .eq('round_id', roundId)
          .eq('user_id', session.user.id)
          .eq('settled', false);

        if (unsettledBets?.length) {
          // Build a lookup: outcomeDbId → { won, postponed, shares, stake }
          const outcomeResults = {};
          resolvedMarkets.forEach((m, mi) => {
            m.outcomes.forEach((_, oi) => {
              const key = `local_${mi}_${oi}`;
              const outcomeId = dbOutcomeMap[key];
              if (outcomeId) {
                outcomeResults[outcomeId] = {
                  won: !m.postponed && m.result === oi,
                  postponed: m.postponed,
                };
              }
            });
          });

          const updates = unsettledBets.map((bet) => {
            const result = outcomeResults[bet.market_outcome_id];
            const payout = result?.won ? bet.shares
              : result?.postponed ? bet.stake
              : 0;
            return { id: bet.id, settled: true, payout };
          });

          if (updates.length) {
            await supabase.from('bets').upsert(updates);
          }
        }
      }
    } catch (err) {
      console.error('Error persisting after settlement:', err);
    }
  }

  async function nextRound() {
    let newSeasonStarting = false;
    updateComp(activeCompKey, (s) => {
      newSeasonStarting = s.round >= SEASON_LENGTH_DEMO;
      const nextRoundNum = newSeasonStarting ? 1 : s.round + 1;
      return {
        ...s,
        round: nextRoundNum,
        markets: newRoundMarkets(comp, nextRoundNum),
        bets: [],
        forfeit: 0,
        balance: newSeasonStarting ? 0 : s.balance,
        botBalances: newSeasonStarting ? Object.fromEntries(BOTS.map((b) => [b, 0])) : s.botBalances,
        botBetsThisRound: {},
        botForfeitThisRound: {},
        stage: "betting",
      };
    });
    setAdBoostTotal(0);
    setSelMarket(0);
    setSelOutcome(0);
    // Clear DB round state so it reinitialises on next bet
    setDbRoundState((prev) => { const n = { ...prev }; delete n[activeCompKey]; return n; });

    // If season is resetting, zero out the wallet in Supabase too
    if (newSeasonStarting) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) await persistBalance(session.user.id, activeCompKey, 0);
      } catch (err) {
        console.error('Error resetting balance for new season:', err);
      }
    }
  }

  function togglePreview() {
    updateComp(activeCompKey, (s) => ({ ...s, previewMode: !s.previewMode }));
  }

  const seasonByUser = useMemo(() => {
    const names = [userName, ...BOTS];
    return names.map((name) => {
      const rows = cd.season.filter((r) => r.name === name);
      const latest = rows[rows.length - 1];
      const top3 = rows.filter((r) => r.rank <= 3).length;
      const avgRank = rows.length ? (rows.reduce((a, r) => a + r.rank, 0) / rows.length).toFixed(1) : "-";
      const isMe = name === userName;
      const country = isMe ? userCountry : botProfiles[name].country;
      const favouriteTeam = isMe ? favouriteTeamByComp[comp.key] : botProfiles[name].favouriteTeamByComp[comp.key];
      return { name, currentBalance: latest ? latest.endingBalance : 0, weeksPlayed: rows.length, top3, avgRank, country, favouriteTeam };
    }).sort((a, b) => b.currentBalance - a.currentBalance);
  }, [cd.season, userName, userCountry, favouriteTeamByComp, botProfiles, comp]);

  function genInviteCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

  function createGroup() {
    if (!newGroupName.trim()) return;
    if (containsProfanity(newGroupName)) { setGroupNameError("That league name isn't allowed. Try something else."); return; }
    setGroupNameError("");
    const myGroupCount = groups.filter((g) => g.members.includes(userName)).length;
    if (myGroupCount >= MAX_GROUPS_PER_USER) return;
    const group = { id: Math.random().toString(36).slice(2), name: newGroupName.trim(), status: "pending", inviteCode: genInviteCode(), members: [userName] };
    setGroups((g) => [...g, group]);
    setNewGroupName("");
    setTimeout(() => setGroups((g) => g.map((x) => (x.id === group.id ? { ...x, status: "approved" } : x))), 1500);
  }

  function joinGroup() {
    setJoinError("");
    const myGroupCount = groups.filter((g) => g.members.includes(userName)).length;
    if (myGroupCount >= MAX_GROUPS_PER_USER) { setJoinError(`You're already in ${MAX_GROUPS_PER_USER} leagues, the max allowed.`); return; }
    const group = groups.find((g) => g.inviteCode === joinCode.trim().toUpperCase());
    if (!group) { setJoinError("No league found with that invite code."); return; }
    if (group.status !== "approved") { setJoinError("This league is still pending approval."); return; }
    if (group.members.includes(userName)) { setJoinError("You're already in this league."); return; }
    if (group.members.length >= MAX_MEMBERS) { setJoinError("This league is full."); return; }
    setGroups((g) => g.map((x) => (x.id === group.id ? { ...x, members: [...x.members, userName] } : x)));
    setJoinCode("");
  }

  if (authLoading) {
    return (
      <div style={{ ...shell, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{fontImports}</style>
        <div style={{ textAlign: "center" }}>
          <svg viewBox="0 0 80 80" width="48" height="48" style={{ marginBottom: 12 }}>
            <rect x="0" y="0" width="80" height="80" rx="18" fill="#2FA86C"/>
            <polygon points="40,14 63,27 63,53 40,66 17,53 17,27" fill="none" stroke="#0A1F1A" strokeWidth="2.5"/>
            <circle cx="40" cy="40" r="10" fill="none" stroke="#0A1F1A" strokeWidth="2.5"/>
          </svg>
          <div className="sg" style={{ color: "#7FBFA0", fontSize: 13 }}>Loading BYN...</div>
        </div>
      </div>
    );
  }

  if (screen === "login") {
    if (showLoginHowTo) {
      return (
        <div style={shell}><style>{fontImports}</style>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg viewBox="0 0 80 80" width="36" height="36" style={{ flexShrink: 0 }}><rect x="0" y="0" width="80" height="80" rx="18" fill="#2FA86C"/><polygon points="40,14 63,27 63,53 40,66 17,53 17,27" fill="none" stroke="#0A1F1A" strokeWidth="2.5"/><circle cx="40" cy="40" r="10" fill="none" stroke="#0A1F1A" strokeWidth="2.5"/></svg>
              <div className="sg" style={{ fontSize: 18, fontWeight: 700 }}>How to play</div>
            </div>
            <button onClick={() => setShowLoginHowTo(false)} className="sg" style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #1c5f3f", background: "transparent", color: "#7FBFA0", fontSize: 12, fontWeight: 600 }}>Back to sign in</button>
          </div>
          <HowToPlayScreen />
          <button onClick={() => setShowLoginHowTo(false)} className="sg" style={{ width: "100%", marginTop: 4, padding: 12, borderRadius: 10, border: "none", background: "#2FA86C", color: "#0A1F1A", fontWeight: 700, fontSize: 14 }}>Got it — back to sign in</button>
        </div></div>
      );
    }
    return (
      <div style={shell}><style>{fontImports}</style>
      <div style={{ maxWidth: 380, margin: "120px auto 0", textAlign: "center" }}>
        <svg viewBox="0 0 300 110" width="260" style={{ marginBottom: 16, display: "block", margin: "0 auto 16px" }}>
          <polygon points="55,8 91,29 91,71 55,92 19,71 19,29" fill="#0A1F1A" stroke="#2FA86C" strokeWidth="1.5"/>
          <circle cx="55" cy="50" r="16" fill="#2FA86C" opacity="0.15"/>
          <circle cx="55" cy="50" r="16" fill="none" stroke="#2FA86C" strokeWidth="1.5"/>
          <line x1="39" y1="50" x2="71" y2="50" stroke="#2FA86C" strokeWidth="0.5" opacity="0.4"/>
          <line x1="55" y1="34" x2="55" y2="66" stroke="#2FA86C" strokeWidth="0.5" opacity="0.4"/>
          <text x="113" y="42" fontFamily="'Space Grotesk', system-ui, sans-serif" fontWeight="700" fontSize="38" fill="#F4F7F2" letterSpacing="2">BYN</text>
          <line x1="113" y1="50" x2="203" y2="50" stroke="#2FA86C" strokeWidth="1"/>
          <text x="113" y="66" fontFamily="system-ui, sans-serif" fontWeight="400" fontSize="10" fill="#7FBFA0" letterSpacing="2">BET YOUR NUTS</text>
        </svg>
        <p style={{ color: "#9DBFAF", fontSize: 13, marginBottom: 24 }}>No real money — just bragging rights.</p>
        {authError && <div style={{ fontSize: 12, color: "#E0998F", marginBottom: 12 }}>{authError}</div>}
        <button onClick={signInWithGoogle} className="sg" style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: "#2FA86C", color: "#0A1F1A", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
          <LogIn size={16} /> Continue with Google
        </button>
        <button disabled className="sg" style={{ width: "100%", padding: "13px", borderRadius: 10, border: "1px solid #1c5f3f", background: "transparent", color: "#5E8775", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
           Continue with Apple (coming soon)
        </button>
        <button onClick={() => setShowLoginHowTo(true)} className="sg" style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #2f6b4d", background: "#16352A", color: "#7FBFA0", fontWeight: 600, fontSize: 13 }}>
          How does this work? →
        </button>
      </div></div>
    );
  }

  if (screen === "setup") {
    return (
      <div style={shell}><style>{fontImports}</style>
      <div style={{ maxWidth: 380, margin: "80px auto 0", textAlign: "center" }}>
        <svg viewBox="0 0 80 80" width="48" height="48" style={{ marginBottom: 16, display: "block", margin: "0 auto 16px" }}>
          <rect x="0" y="0" width="80" height="80" rx="18" fill="#2FA86C"/>
          <polygon points="40,14 63,27 63,53 40,66 17,53 17,27" fill="none" stroke="#0A1F1A" strokeWidth="2.5"/>
          <circle cx="40" cy="40" r="10" fill="none" stroke="#0A1F1A" strokeWidth="2.5"/>
        </svg>
        <div className="sg" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Welcome to BYN</div>
        <p style={{ color: "#9DBFAF", fontSize: 13, marginBottom: 24 }}>Set up your profile to start playing.</p>

        <input
          placeholder="Pick a display name"
          value={userName}
          onChange={(e) => { setUserName(e.target.value); setNameEdited(true); setNameError(containsProfanity(e.target.value) ? "That name isn't allowed. Try something else." : ""); setNameTaken(false); }}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${nameError || nameTaken ? "#C75146" : nameEdited && userName.trim() && !nameChecking && !nameTaken ? "#2FA86C" : "#1c5f3f"}`, background: "#0F2920", color: "#F4F7F2", marginBottom: 6, fontSize: 14, textAlign: "left" }}
        />
        {nameError && <div style={{ fontSize: 11, color: "#E0998F", marginBottom: 8, textAlign: "left" }}>{nameError}</div>}
        {!nameError && nameEdited && userName.trim() && nameChecking && <div style={{ fontSize: 11, color: "#7FBFA0", marginBottom: 8, textAlign: "left" }}>Checking availability...</div>}
        {!nameError && nameEdited && userName.trim() && !nameChecking && nameTaken && <div style={{ fontSize: 11, color: "#E0998F", marginBottom: 8, textAlign: "left" }}>That name is already taken — please choose another.</div>}
        {!nameError && nameEdited && userName.trim() && !nameChecking && !nameTaken && <div style={{ fontSize: 11, color: "#2FA86C", marginBottom: 8, textAlign: "left" }}>✓ Name available</div>}

        <select value={userCountry} onChange={(e) => setUserCountry(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #1c5f3f", background: "#0F2920", color: "#F4F7F2", marginBottom: 14, fontSize: 14 }}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 16, textAlign: "left", fontSize: 11, color: "#9DBFAF", cursor: "pointer" }}>
          <input type="checkbox" checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} style={{ marginTop: 2, accentColor: "#2FA86C" }} />
          <span>I confirm I am 17 years of age or older. BYN is play-money only — no real-money wagering.</span>
        </label>

        <div style={{ background: "#0F2920", border: "1px solid #1c5f3f", borderRadius: 10, padding: 12, marginBottom: 16, textAlign: "left" }}>
          <div className="sg" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Got a referral code? <span style={{ color: "#7FBFA0", fontWeight: 400 }}>(optional)</span></div>
          <input placeholder="Enter code e.g. A1B2C3" value={referralInput} onChange={(e) => setReferralInput(e.target.value.toUpperCase())} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #1c5f3f", background: "#16352A", color: "#F4F7F2", marginBottom: 8, fontSize: 13 }}/>
          {referralInput.length >= 6 && (
            <>
              <div style={{ fontSize: 11, color: "#2FA86C", marginBottom: 6 }}>✓ Code accepted — apply your 500 nut welcome bonus to:</div>
              <select value={referralBonusComp} onChange={(e) => setReferralBonusComp(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #1c5f3f", background: "#16352A", color: "#F4F7F2", fontSize: 13 }}>
                {COMPETITIONS.filter((c) => c.active).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </>
          )}
        </div>

        <button
          disabled={!userName.trim() || !!nameError || nameTaken || nameChecking || !ageConfirmed}
          onClick={completeSetup}
          className="sg"
          style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: userName.trim() && !nameError && !nameTaken && !nameChecking && ageConfirmed ? "#2FA86C" : "#1c5f3f", color: "#0A1F1A", fontWeight: 700, fontSize: 15 }}
        >
          Start playing →
        </button>
      </div></div>
    );
  }

  return (
    <div style={shell}>
      <style>{fontImports}</style>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg viewBox="0 0 80 80" width="42" height="42" style={{ flexShrink: 0 }}>
              <rect x="0" y="0" width="80" height="80" rx="18" fill="#2FA86C"/>
              <polygon points="40,14 63,27 63,53 40,66 17,53 17,27" fill="none" stroke="#0A1F1A" strokeWidth="2.5"/>
              <circle cx="40" cy="40" r="10" fill="none" stroke="#0A1F1A" strokeWidth="2.5"/>
            </svg>
            <div>
              <div style={{ color: "#7FBFA0", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>{comp.name} &middot; {roundLabel(comp, cd.round)}</div>
              <div className="sg" style={{ fontSize: 18, fontWeight: 700 }}>{userName}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setTab(tab === "profile" ? "markets" : "profile")}
              title="Profile"
              style={{ height: 34, padding: "0 10px", borderRadius: 17, border: `1px solid ${tab === "profile" ? "#2FA86C" : "#1c5f3f"}`, background: tab === "profile" ? "#16352A" : "transparent", color: tab === "profile" ? "#2FA86C" : "#7FBFA0", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
            >
              <User size={15} />
              <span style={{ fontSize: 15, lineHeight: 1 }}>{FLAG_MAP[userCountry] || "🏳️"}</span>
            </button>
            <button
              onClick={() => setTab(tab === "howto" ? "markets" : "howto")}
              title="How to play"
              style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${tab === "howto" ? "#2FA86C" : "#1c5f3f"}`, background: tab === "howto" ? "#16352A" : "transparent", color: tab === "howto" ? "#2FA86C" : "#7FBFA0", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <HelpCircle size={15} />
            </button>
            <button
              onClick={signOut}
              title="Sign out"
              className="sg"
              style={{ height: 34, padding: "0 10px", borderRadius: 17, border: "1px solid #1c5f3f", background: "transparent", color: "#5E8775", fontSize: 11, fontWeight: 600 }}
            >
              Sign out
            </button>
            <StageBadge stage={gated ? "gated" : cd.stage} />
          </div>
        </div>

        {/* Category switcher — only shows categories with at least one active competition */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto" }}>
          {CATEGORIES.filter((c) => COMPETITIONS.some((comp) => comp.category === c.key && comp.active)).map((c) => (
            <button
              key={c.key}
              onClick={() => selectCategory(c.key)}
              className="sg"
              style={{
                padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                border: `1px solid ${activeCategoryKey === c.key ? "#2FA86C" : "#1c5f3f"}`,
                background: activeCategoryKey === c.key ? "#16352A" : "transparent",
                color: activeCategoryKey === c.key ? "#2FA86C" : "#9DBFAF",
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Competition switcher — always visible */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
          {compsInCategory.map((c) => (
            <button
              key={c.key}
              onClick={() => { selectCompetition(c.key); setTab("markets"); }}
              className="mono"
              style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4,
                border: `1px solid ${activeCompKey === c.key ? "#2FA86C" : "#16352A"}`,
                background: activeCompKey === c.key ? "#16352A" : "#0F2920",
                color: activeCompKey === c.key ? "#2FA86C" : "#9DBFAF",
              }}
            >
              {c.special && <CalendarClock size={11} />}
              {c.name}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <ProfileSummaryScreen
            userName={userName}
            compData={compData}
            groups={groups}
            userCountry={userCountry}
            favouriteTeamByComp={favouriteTeamByComp}
            FLAG_MAP={FLAG_MAP}
            baseLeagueSlots={BASE_LEAGUE_SLOTS}
            extraLeagueSlots={extraLeagueSlots}
            maxLeagueSlots={MAX_GROUPS_PER_USER}
            adBoostTotal={adBoostTotal}
            adBoostMax={AD_BOOST_MAX}
            adBoostPerView={AD_BOOST_PER_VIEW}
            adBoostCompKey={adBoostCompKey}
            setAdBoostCompKey={setAdBoostCompKey}
            adWatching={adWatching}
            watchAd={watchAd}
            userReferralCode={userReferralCode}
            referralsEarned={referralsEarned}
            referralRewardComp={referralRewardComp}
            setReferralRewardComp={setReferralRewardComp}
            simulateFriendJoining={simulateFriendJoining}
            copyReferralCode={copyReferralCode}
            copiedCode={copiedCode}
          />
        )}

        {tab === "howto" && <HowToPlayScreen />}

        {tab !== "profile" && tab !== "howto" && (
          <>
        <SponsorBanner label="BYN — Bet Your Nuts" sublabel="No real money — just bragging rights." houseAd />

        {gated ? (
          <div style={{ ...card, textAlign: "center" }}>
            <CalendarClock size={24} color="#D9A441" style={{ marginBottom: 8 }} />
            <div className="sg" style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{comp.name} isn't running right now</div>
            <div style={{ fontSize: 12, color: "#9DBFAF", marginBottom: 14 }}>
              {comp.name} is a special event — markets only open during the real tournament window, and there's no wallet activity outside it. In the real build this is enforced server-side, not just hidden in the UI.
            </div>
            <button onClick={togglePreview} className="sg" style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #1c5f3f", background: "transparent", color: "#7FBFA0", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Eye size={13} /> Preview tournament window (demo only)
            </button>
          </div>
        ) : (
          <>
            {comp.special && cd.previewMode && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "#2B1E15", marginBottom: 12, fontSize: 11, color: "#E0B872" }}>
                <span>Previewing {comp.name} as if its tournament window were open (demo only).</span>
                <button onClick={togglePreview} className="mono" style={{ background: "none", border: "none", color: "#E0B872", textDecoration: "underline", fontSize: 11 }}>exit preview</button>
              </div>
            )}

            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9DBFAF", marginBottom: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Wallet size={13} /> {comp.name} balance carried in: <span className="mono" style={{ color: "#F4F7F2" }}>{Math.round(cd.balance)}</span> + {WEEKLY_TOPUP} nuts this round</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9DBFAF", marginBottom: 6 }}>
                <span>Committed</span>
                <span className="mono">{Math.round(committed)} / {Math.round(startOfRound)}</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: "#16352A", overflow: "hidden", position: "relative" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (committed / startOfRound) * 100)}%`, background: meetsMin ? "#2FA86C" : "#D9A441", transition: "width .3s" }} />
                <div style={{ position: "absolute", top: 0, left: `${MIN_COMMIT_FRACTION * 100}%`, width: 2, height: 10, background: "#C75146" }} />
              </div>
              <div style={{ fontSize: 11, color: meetsMin ? "#7FBFA0" : "#D9A441", marginTop: 6 }}>
                {meetsMin
                  ? `Minimum met (${Math.round(minRequired)}). Anything left over stays in your ${comp.name} account.`
                  : `Need ${Math.round(minRequired - committed)} more staked before lockout, or that shortfall is forfeited (max loss: 50% of ${Math.round(startOfRound)}).`}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, margin: "16px 0", overflowX: "auto" }}>
              <button onClick={() => setTab("markets")} className="sg" style={tabStyle(tab === "markets")}>Games</button>
              <button onClick={() => setTab("leagues")} className="sg" style={tabStyle(tab === "leagues")}>
                Leagues {groups.filter((g) => g.members.includes(userName)).length > 0 && `(${groups.filter((g) => g.members.includes(userName)).length})`}
              </button>
              <button onClick={() => setTab("rankings")} className="sg" style={tabStyle(tab === "rankings")}>Rankings</button>
            </div>

            {tab === "leagues" && (
              <LeaguesScreen
                userName={userName} groups={groups} newGroupName={newGroupName} setNewGroupName={setNewGroupName}
                createGroup={createGroup} groupNameError={groupNameError} joinCode={joinCode} setJoinCode={setJoinCode}
                joinGroup={joinGroup} joinError={joinError} maxGroups={MAX_GROUPS_PER_USER}
                activeGroupId={activeGroupId} setActiveGroupId={setActiveGroupId} seasonByUser={seasonByUser} compName={comp.name}
              />
            )}

            {tab === "rankings" && (
              <RankingsScreen
                seasonByUser={seasonByUser}
                userName={userName}
                userCountry={userCountry}
                comp={comp}
                favouriteTeamByComp={favouriteTeamByComp}
                allTeams={allTeamsFor(comp)}
                editWindowOpen={cd.round === 1}
              />
            )}

            {tab === "markets" && (
              <>
                {/* Favourite team prompt — shown at season start for team sports */}
                {cd.round === 1 && allTeamsFor(comp).length > 0 && (
                  <div style={{ ...card, marginBottom: 12, border: "1px solid #2FA86C" }}>
                    <div className="sg" style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: "#2FA86C" }}>
                      New season — pick your favourite {comp.name} team
                    </div>
                    <div style={{ fontSize: 11, color: "#9DBFAF", marginBottom: 10 }}>
                      This sets your team leaderboard in Rankings. Locked after this round.
                    </div>
                    <select
                      value={favouriteTeamByComp[comp.key] || ""}
                      onChange={(e) => setFavouriteTeamByComp((prev) => ({ ...prev, [comp.key]: e.target.value }))}
                      style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #2FA86C", background: "#16352A", color: "#F4F7F2", fontSize: 13 }}
                    >
                      <option value="">Select a team...</option>
                      {allTeamsFor(comp).map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {favouriteTeamByComp[comp.key] && (
                      <div style={{ fontSize: 11, color: "#2FA86C", marginTop: 6 }}>
                        ✓ {favouriteTeamByComp[comp.key]} selected — locked in after this round
                      </div>
                    )}
                  </div>
                )}

                {cd.stage === "betting" && (
                  <>
                    {fixturesLoading && (
                      <div style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: 8, background: "#16352A", marginBottom: 8, fontSize: 11, color: "#7FBFA0" }}>
                        <span>⏳</span><span>Loading live fixtures...</span>
                      </div>
                    )}
                    {!fixturesLoading && liveFixtures[activeCompKey]?.length > 0 && (
                      <div style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: 8, background: "#0D2B1A", border: "1px solid #2f6b4d", marginBottom: 8, fontSize: 11, color: "#2FA86C" }}>
                        <span>🟢</span><span>Live fixtures — odds seeded from real bookmaker data</span>
                      </div>
                    )}
                    {!fixturesLoading && !liveFixtures[activeCompKey]?.length && (
                      <div style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: 8, background: "#16352A", marginBottom: 8, fontSize: 11, color: "#9DBFAF" }}>
                        <span>📋</span><span>Demo fixtures — no upcoming matches found in the next 7 days</span>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, padding: 10, borderRadius: 8, background: "#16352A", marginBottom: 12, fontSize: 11, color: "#7FBFA0" }}>
                      <span>🔔</span>
                      <span>In the real app, you'd get a push notification 1 hour before lockout if you haven't met your minimum stake yet — not simulated here, just showing where it'd surface.</span>
                    </div>
                    <div style={{ ...card, marginTop: 0 }}>
                      <div className="sg" style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Place a bet</div>
                      {activeMarkets.map((m, mi) => {
                        const p = prices(m.q, m.b);
                        const wide = m.outcomes.length > 4;
                        return (
                          <div key={m.id} style={{ marginBottom: 10, padding: 10, borderRadius: 10, border: `1.5px solid ${selMarket === mi ? "#2FA86C" : "#16352A"}`, background: "#0F2920" }}>
                            <div className="sg" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, cursor: "pointer" }} onClick={() => setSelMarket(mi)}>{m.name}</div>
                            <div style={{ display: "flex", flexDirection: wide ? "column" : "row", gap: 6 }}>
                              {m.outcomes.map((label, oi) => (
                                <button
                                  key={oi}
                                  onClick={() => { setSelMarket(mi); setSelOutcome(oi); }}
                                  className="mono"
                                  style={{
                                    flex: wide ? "none" : 1, display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: wide ? "7px 10px" : "8px 4px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                    border: `1px solid ${selMarket === mi && selOutcome === oi ? "#2FA86C" : "#1c5f3f"}`,
                                    background: selMarket === mi && selOutcome === oi ? "#16352A" : "transparent",
                                    color: "#F4F7F2", textAlign: wide ? "left" : "center",
                                  }}
                                >
                                  <span>{wide ? label : label.slice(0, 3)}</span>
                                  <span style={{ color: "#7FBFA0", fontSize: 11 }}>{(p[oi] * 100).toFixed(0)}%</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      <SponsorBanner label="BYN — Bet Your Nuts" sublabel="No real money — just bragging rights." houseAd />
                      <input
                        type="range" min={10} max={Math.max(10, Math.round(remaining))} step={10}
                        value={Math.min(stakeInput, Math.max(10, Math.round(remaining)))}
                        onChange={(e) => setStakeInput(Number(e.target.value))}
                        style={{ width: "100%", marginTop: 6 }}
                      />
                      <div style={{ textAlign: "center", fontSize: 13, marginBottom: 10 }}>
                        <span className="mono" style={{ fontWeight: 700 }}>{Math.min(stakeInput, Math.round(remaining))}</span> nuts on <span style={{ color: "#2FA86C" }}>{activeMarkets[selMarket]?.outcomes[selOutcome]}</span>
                      </div>
                      <button
                        onClick={placeBet}
                        disabled={remaining <= 0}
                        className="sg"
                        style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: remaining > 0 ? "#2FA86C" : "#1c5f3f", color: "#0A1F1A", fontWeight: 700, fontSize: 14 }}
                      >
                        Place bet
                      </button>
                    </div>

                    {cd.bets.length > 0 && <BetList bets={cd.bets} markets={activeMarkets} />}

                    <button onClick={advanceToLockout} className="sg" style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 10, border: "1px solid #1c5f3f", background: "transparent", color: "#9DBFAF", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Lock size={14} /> Advance to lockout (1hr before first start) <ChevronRight size={14} />
                    </button>
                  </>
                )}

                {cd.stage === "locked" && (
                  <div style={{ ...card, marginTop: 0 }}>
                    <div className="sg" style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <Lock size={14} color="#D9A441" /> Markets locked
                    </div>
                    {cd.forfeit > 0 ? (
                      <div style={{ display: "flex", gap: 8, padding: 10, background: "#2B1E15", borderRadius: 8, fontSize: 12, color: "#E0B872", marginBottom: 10 }}>
                        <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                        You committed {Math.round(committed)} of the {Math.round(minRequired)} required. {Math.round(cd.forfeit)} nuts forfeited.
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, padding: 10, background: "#16352A", borderRadius: 8, fontSize: 12, color: "#7FBFA0", marginBottom: 10 }}>
                        <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> Minimum commitment met, nothing forfeited. {Math.round(remaining)} nuts stay in your account.
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "#9DBFAF", marginBottom: 10 }}>{BOTS.length} other simulated users also placed their bets this round.</div>
                    <BetList bets={cd.bets} markets={cd.markets} />
                    <button onClick={simulateResults} className="sg" style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 10, border: "none", background: "#2FA86C", color: "#0A1F1A", fontWeight: 700, fontSize: 14 }}>
                      Simulate results &amp; settle round
                    </button>
                  </div>
                )}

                {cd.stage === "settled" && (
                  <>
                    <div style={{ ...card, marginTop: 0 }}>
                      <div className="sg" style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Results</div>
                      {cd.markets.map((m) => {
                        const betsOnMarket = cd.bets.filter((b) => b.marketId === m.id);
                        return (
                          <div key={m.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #16352A" }}>
                            <div className="sg" style={{ fontSize: 13, fontWeight: 600, color: "#9DBFAF", marginBottom: 6 }}>{m.name}</div>
                            {m.postponed ? (
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: 8, background: "#2B1E15", border: "1px solid #7a5d28" }}>
                                <span style={{ fontSize: 12, color: "#D9A441" }}>Postponed — bets refunded</span>
                                {betsOnMarket.length > 0 && <span className="mono" style={{ fontSize: 12, color: "#D9A441" }}>+{Math.round(betsOnMarket.reduce((a, b) => a + b.stake, 0))} nuts back</span>}
                              </div>
                            ) : betsOnMarket.length > 0 ? (
                              betsOnMarket.map((bet, bi) => {
                                const won = bet.outcome === m.result;
                                return (
                                  <div key={bi} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: 8, marginBottom: 4, background: won ? "#0D2B1A" : "#2B1010", border: `1px solid ${won ? "#2f6b4d" : "#6b2f2f"}` }}>
                                    <div>
                                      <div style={{ fontSize: 12, color: "#9DBFAF" }}>Your bet: <span style={{ color: "#F4F7F2", fontWeight: 600 }}>{m.outcomes[bet.outcome]}</span></div>
                                      <div style={{ fontSize: 11, color: "#7FBFA0", marginTop: 1 }}>Result: <span style={{ color: won ? "#2FA86C" : "#C75146", fontWeight: 600 }}>{m.outcomes[m.result]}</span></div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                      <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: won ? "#2FA86C" : "#C75146" }}>
                                        {won ? `+${Math.round(bet.shares)}` : `-${Math.round(bet.stake)}`}
                                      </div>
                                      <div style={{ fontSize: 10, color: "#7FBFA0" }}>nuts</div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div style={{ padding: "7px 10px", borderRadius: 8, background: "#16352A", fontSize: 12, color: "#5E8775" }}>
                                No bet placed &mdash; result: <span style={{ color: "#9DBFAF", fontWeight: 600 }}>{m.outcomes[m.result]}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div style={{ paddingTop: 4, fontSize: 13 }}>
                        Payout this round: <span className="mono" style={{ fontWeight: 700, color: "#2FA86C" }}>{Math.round(cd.season.find((r) => r.round === cd.round && r.name === userName)?.roundPayout || 0)}</span> nuts
                      </div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        {cd.round >= SEASON_LENGTH_DEMO
                          ? <span>Season complete — your balance of <span className="mono" style={{ fontWeight: 700 }}>{Math.round(cd.balance)}</span> resets to <span className="mono" style={{ fontWeight: 700, color: "#D9A441" }}>0</span> for the new season.</span>
                          : <span>New balance carrying into {roundLabel(comp, cd.round + 1)}: <span className="mono" style={{ fontWeight: 700 }}>{Math.round(cd.balance)}</span></span>}
                      </div>
                    </div>

                    <div style={{ ...card, marginTop: 12 }}>
                      <div className="sg" style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <Award size={15} color="#D9A441" /> {roundLabel(comp, cd.round)} standings
                      </div>
                      {cd.season.filter((r) => r.round === cd.round).map((r) => (
                        <div key={r.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", color: r.name === userName ? "#2FA86C" : "#F4F7F2", fontWeight: r.name === userName ? 700 : 400 }}>
                          <span>#{r.rank} {r.name}</span>
                          <span className="mono">{Math.round(r.endingBalance)}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ ...card, marginTop: 12 }}>
                      <div className="sg" style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <Flame size={15} color="#C75146" /> {comp.name} season leaderboard
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "4px 10px", fontSize: 11, color: "#7FBFA0", marginBottom: 4 }}>
                        <span>Player</span><span>Balance</span><span>Top 3s</span><span>Avg rank</span>
                      </div>
                      {seasonByUser.map((r) => (
                        <div key={r.name} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "4px 10px", fontSize: 13, padding: "5px 0", color: r.name === userName ? "#2FA86C" : "#F4F7F2", fontWeight: r.name === userName ? 700 : 400 }}>
                          <span>{r.name}</span>
                          <span className="mono">{Math.round(r.currentBalance)}</span>
                          <span className="mono">{r.top3}/{r.weeksPlayed}</span>
                          <span className="mono">{r.avgRank}</span>
                        </div>
                      ))}
                    </div>

                    <button onClick={nextRound} className="sg" style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 10, border: "none", background: "#2FA86C", color: "#0A1F1A", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      Start {roundLabel(comp, cd.round >= SEASON_LENGTH_DEMO ? 1 : cd.round + 1)} <ChevronRight size={14} />
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}

function BetList({ bets, markets }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, color: "#7FBFA0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Your bets this round</div>
      {bets.map((b, i) => {
        const m = markets.find((mk) => mk.id === b.marketId);
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", color: "#F4F7F2", borderBottom: "1px solid #16352A" }}>
            <span>{m.name} &middot; {m.outcomes[b.outcome]}</span>
            <span className="mono">{Math.round(b.stake)} nuts</span>
          </div>
        );
      })}
    </div>
  );
}

function StageBadge({ stage }) {
  const map = {
    betting:  { label: "Open",       color: "#2FA86C" },
    locked:   { label: "Locked",     color: "#D9A441" },
    settled:  { label: "Settled",    color: "#9DBFAF" },
    gated:    { label: "Not active", color: "#5E8775" },
  };
  const s = map[stage] || map["betting"];
  return <div className="mono" style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, border: `1px solid ${s.color}`, color: s.color }}>{s.label}</div>;
}

function tabStyle(active) {
  return {
    flex: 1, padding: "9px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: `1px solid ${active ? "#2FA86C" : "#1c5f3f"}`,
    background: active ? "#16352A" : "transparent",
    color: active ? "#2FA86C" : "#9DBFAF",
  };
}

function LeaguesScreen({ userName, groups, newGroupName, setNewGroupName, createGroup, groupNameError, joinCode, setJoinCode, joinGroup, joinError, maxGroups, activeGroupId, setActiveGroupId, seasonByUser, compName }) {
  const myGroups = groups.filter((g) => g.members.includes(userName));
  const activeGroup = groups.find((g) => g.id === activeGroupId) || myGroups[0];

  return (
    <div>
      <div style={card}>
        <div className="sg" style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Create a private league</div>
        <input
          placeholder="League name"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${groupNameError ? "#C75146" : "#1c5f3f"}`, background: "#16352A", color: "#F4F7F2", marginBottom: 6, fontSize: 13 }}
        />
        {groupNameError && <div style={{ fontSize: 11, color: "#E0998F", marginBottom: 6 }}>{groupNameError}</div>}
        <button onClick={createGroup} className="sg" style={{ width: "100%", padding: 10, borderRadius: 8, border: "none", background: "#2FA86C", color: "#0A1F1A", fontWeight: 700, fontSize: 13 }}>
          Create league
        </button>
        <div style={{ fontSize: 11, color: "#7FBFA0", marginTop: 6 }}>{myGroups.length}/{maxGroups} leagues joined &mdash; this cap is shared across all sports and competitions, not per competition. The global leaderboard doesn't count against it. New leagues need approval before the invite code works.</div>
        {myGroups.length >= maxGroups && (
          <div style={{ fontSize: 11, color: "#D9A441", marginTop: 6 }}>
            You've hit your league limit. Purchasing extra slots (packs of 3) isn't wired up yet in this mock &mdash; the real version will offer that here.
          </div>
        )}
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <div className="sg" style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Join with an invite code</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="e.g. A1B2C3"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #1c5f3f", background: "#16352A", color: "#F4F7F2", fontSize: 13 }}
          />
          <button onClick={joinGroup} className="sg" style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "#2FA86C", color: "#0A1F1A", fontWeight: 700, fontSize: 13 }}>
            Join
          </button>
        </div>
        {joinError && <div style={{ fontSize: 12, color: "#E0998F", marginTop: 6 }}>{joinError}</div>}
      </div>

      {myGroups.length > 0 && (
        <div style={{ ...card, marginTop: 12 }}>
          <div className="sg" style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Your leagues</div>
          {myGroups.map((g) => (
            <div
              key={g.id}
              onClick={() => setActiveGroupId(g.id)}
              style={{ padding: 10, borderRadius: 8, marginBottom: 6, cursor: "pointer", border: `1.5px solid ${activeGroup?.id === g.id ? "#2FA86C" : "#16352A"}`, background: "#16352A" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="sg" style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</span>
                <span className="mono" style={{ fontSize: 11, color: g.status === "approved" ? "#7FBFA0" : "#D9A441" }}>{g.status}</span>
              </div>
              <div style={{ fontSize: 11, color: "#9DBFAF", marginTop: 2 }}>{g.members.length} member{g.members.length !== 1 ? "s" : ""} &middot; invite code <span className="mono">{g.inviteCode}</span></div>
            </div>
          ))}
        </div>
      )}

      {activeGroup && (
        <div style={{ ...card, marginTop: 12 }}>
          <div className="sg" style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{activeGroup.name} &mdash; {compName} leaderboard</div>
          <SponsorBanner label="Sponsor this league" sublabel="e.g. local club, brand" />
          {seasonByUser.filter((r) => activeGroup.members.includes(r.name)).length === 0 && (
            <div style={{ fontSize: 12, color: "#5E8775" }}>No rounds settled yet for this league's members.</div>
          )}
          {seasonByUser.filter((r) => activeGroup.members.includes(r.name)).map((r, i) => (
            <div key={r.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", color: r.name === userName ? "#2FA86C" : "#F4F7F2", fontWeight: r.name === userName ? 700 : 400 }}>
              <span>#{i + 1} {r.name}</span>
              <span className="mono">{Math.round(r.currentBalance)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RankingsScreen({ seasonByUser, userName, userCountry, comp, favouriteTeamByComp, allTeams, editWindowOpen }) {
  const [filter, setFilter] = useState("global");
  const myFavouriteTeam = favouriteTeamByComp[comp.key];
  const hasTeams = allTeams.length > 0;

  const filtered = useMemo(() => {
    if (filter === "country") return seasonByUser.filter((r) => r.country === userCountry);
    if (filter === "team") return seasonByUser.filter((r) => r.favouriteTeam === myFavouriteTeam);
    return seasonByUser;
  }, [filter, seasonByUser, userCountry, myFavouriteTeam]);

  return (
    <div>
      <div style={{ ...card, marginBottom: 12 }}>
        <div className="sg" style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Your ranking profile</div>

        {/* Country — set at signup, never changeable */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, background: "#16352A", marginBottom: hasTeams ? 10 : 0 }}>
          <div>
            <div style={{ fontSize: 10, color: "#7FBFA0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Country</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#F4F7F2" }}>{FLAG_MAP[userCountry] || "🌍"} {userCountry}</div>
          </div>
          <div style={{ fontSize: 10, color: "#5E8775" }}>Set at sign-up</div>
        </div>

        {/* Favourite team — selected in Games tab at season start, display only here */}
        {hasTeams && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: "#7FBFA0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Favourite {comp.name} team</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, background: "#16352A" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#F4F7F2" }}>
                {myFavouriteTeam || <span style={{ color: "#5E8775" }}>Not set — pick one in the Games tab at season start</span>}
              </div>
              {myFavouriteTeam && <div style={{ fontSize: 10, color: "#5E8775" }}>Locked this season</div>}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button onClick={() => setFilter("global")} className="sg" style={tabStyle(filter === "global")}>Global</button>
        <button onClick={() => setFilter("country")} className="sg" style={tabStyle(filter === "country")}>{userCountry}</button>
        {hasTeams && (
          <button onClick={() => setFilter("team")} className="sg" style={tabStyle(filter === "team")} disabled={!myFavouriteTeam}>
            {myFavouriteTeam || "Pick a team"}
          </button>
        )}
      </div>

      <div style={card}>
        <div className="sg" style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
          {comp.name} &mdash; {filter === "global" ? "global leaderboard" : filter === "country" ? `${userCountry} leaderboard` : `${myFavouriteTeam || ""} fans leaderboard`}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "4px 10px", fontSize: 11, color: "#7FBFA0", marginBottom: 4 }}>
          <span>Player</span><span>Balance</span><span>Country</span>
        </div>
        {filtered.length === 0 && <div style={{ fontSize: 12, color: "#5E8775", padding: "8px 0" }}>No players match this filter yet.</div>}
        {filtered.map((r, i) => (
          <div key={r.name} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "4px 10px", fontSize: 13, padding: "5px 0", color: r.name === userName ? "#2FA86C" : "#F4F7F2", fontWeight: r.name === userName ? 700 : 400 }}>
            <span>#{i + 1} {r.name}</span>
            <span className="mono">{Math.round(r.currentBalance)}</span>
            <span className="mono" style={{ color: "#7FBFA0" }}>{r.country}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowToPlayScreen() {
  const Section = ({ title, children }) => (
    <div style={{ ...card, marginBottom: 12 }}>
      <div className="sg" style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#D9E5DE", lineHeight: 1.6 }}>{children}</div>
    </div>
  );

  return (
    <div>
      <Section title="The basics">
        Every round, you get <strong>1000 fresh credits</strong> added to whatever balance you already have in that competition. Credits are play-money only — nothing here is real money, in either direction. Around the app you'll see them called <strong>nuts</strong> (it's a BYN thing) — same credits, just our name for them.
      </Section>

      <Section title="You have to actually play">
        You must stake at least <strong>50% of your total balance</strong> before the round locks (1 hour before the first match, race, or event starts). Bet less than that and the shortfall is forfeited — but you can never lose more than that 50%, even if you stake nothing at all. Anything you stake above the minimum, and any winnings, stay in your account and roll into the next round.
      </Section>

      <Section title="How a round works">
        <strong>1. Open</strong> — markets are live, place bets on any outcome.<br />
        <strong>2. Locked</strong> — betting closes 1 hour before the first event starts, no more changes.<br />
        <strong>3. Settled</strong> — results come in, winners get paid, the next round begins.
      </Section>

      <Section title="How the odds actually work">
        Unlike a normal bookmaker, nobody at BYN sets the odds. Prices move automatically based on what everyone is betting — if a lot of nuts pile onto one outcome, that price rises and the others fall to compensate, since all outcomes in a market always add up to 100%.
        <br /><br />
        This means the percentage you see isn't a guess — it's literally what the crowd collectively believes right now. Bet early and you might get a better price than someone who waits until everyone agrees with you.
      </Section>

      <Section title="How payouts work">
        Whatever price you see when you place a bet is locked in for you — your payout doesn't change even if the price moves afterward. If your pick wins, you get paid based on that locked-in price. If it loses, that stake is gone. There's no in-between.
      </Section>

      <Section title="Seasons">
        Each competition runs its own season at its own pace — weekly for leagues, round-by-round for tournaments, race-by-race for motorsport. At the end of a season, balances reset to 0 for everyone, so nobody carries an advantage into the next one. Your results live on in the season leaderboard, not in your balance.
      </Section>

      <Section title="Leagues & rankings">
        Create a private league and invite friends with a code, or check the Rankings tab to see how you stack up globally, against your country, or against fellow fans of your favourite team. Everything is scored the same way — most nuts, most consistent finishes.
      </Section>
    </div>
  );
}

function ProfileSummaryScreen({ userName, compData, groups, userCountry, favouriteTeamByComp, FLAG_MAP, baseLeagueSlots, extraLeagueSlots, maxLeagueSlots, adBoostTotal, adBoostMax, adBoostPerView, adBoostCompKey, setAdBoostCompKey, adWatching, watchAd, userReferralCode, referralsEarned, referralRewardComp, setReferralRewardComp, simulateFriendJoining, copyReferralCode, copiedCode }) {
  const myGroups = groups.filter((g) => g.members.includes(userName));
  const leaguesUsed = myGroups.length;
  const extraPurchased = extraLeagueSlots; // in packs of 3
  const packsBought = Math.floor(extraLeagueSlots / 3);

  // Seasons played = number of distinct competitions where season data exists
  const seasonsPlayed = COMPETITIONS.filter((c) => compData[c.key].season.some((r) => r.name === userName)).length;

  // Favourite teams — only competitions where one has been set
  const favouriteTeams = COMPETITIONS.filter((c) => favouriteTeamByComp[c.key]).map((c) => ({
    comp: c.name,
    team: favouriteTeamByComp[c.key],
  }));

  return (
    <div>
      <div className="sg" style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Profile</div>

      {/* User info card */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div className="sg" style={{ fontSize: 20, fontWeight: 700 }}>{userName}</div>
            <div style={{ fontSize: 12, color: "#7FBFA0", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
              <span>{FLAG_MAP[userCountry] || "🌍"}</span>
              <span>{userCountry}</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: "#2FA86C" }}>{seasonsPlayed}</div>
            <div style={{ fontSize: 10, color: "#7FBFA0" }}>competitions active</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #16352A", paddingTop: 10 }}>
          <div style={{ fontSize: 11, color: "#7FBFA0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Favourite teams</div>
          {favouriteTeams.length === 0 ? (
            <div style={{ fontSize: 12, color: "#5E8775" }}>None set yet — head to Rankings to pick your favourites.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {favouriteTeams.map(({ comp, team }) => (
                <div key={comp} style={{ padding: "4px 10px", borderRadius: 999, background: "#16352A", border: "1px solid #2f6b4d", fontSize: 12 }}>
                  <span style={{ color: "#7FBFA0" }}>{comp}: </span>
                  <span style={{ color: "#F4F7F2", fontWeight: 600 }}>{team}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid #16352A", paddingTop: 10, marginTop: 10 }}>
          <div style={{ fontSize: 11, color: "#7FBFA0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Nuts boost — watch ads</div>
          <div style={{ fontSize: 12, color: "#9DBFAF", marginBottom: 10 }}>
            Watch a short ad to earn <span className="mono" style={{ color: "#F4F7F2", fontWeight: 600 }}>+{adBoostPerView} nuts</span>. You can boost up to <span className="mono" style={{ color: "#F4F7F2" }}>{adBoostMax} nuts per round</span> — the cap resets every new round.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#16352A", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (adBoostTotal / adBoostMax) * 100)}%`, background: adBoostTotal >= adBoostMax ? "#C75146" : "#D9A441", transition: "width .4s" }} />
            </div>
            <span className="mono" style={{ fontSize: 12, color: adBoostTotal >= adBoostMax ? "#C75146" : "#D9A441", whiteSpace: "nowrap" }}>{adBoostTotal} / {adBoostMax}</span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#7FBFA0", marginBottom: 4 }}>Boost which competition?</div>
            <select
              value={adBoostCompKey}
              onChange={(e) => setAdBoostCompKey(e.target.value)}
              disabled={adBoostTotal >= adBoostMax}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #1c5f3f", background: "#16352A", color: "#F4F7F2", fontSize: 13 }}
            >
              {COMPETITIONS.map((c) => (
                <option key={c.key} value={c.key}>{c.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={watchAd}
            disabled={adBoostTotal >= adBoostMax || adWatching}
            className="sg"
            style={{
              width: "100%", padding: 11, borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700,
              background: adBoostTotal >= adBoostMax ? "#16352A" : adWatching ? "#1c5f3f" : "#D9A441",
              color: adBoostTotal >= adBoostMax ? "#5E8775" : "#0A1F1A",
            }}
          >
            {adBoostTotal >= adBoostMax
              ? "Round boost limit reached — resets next round"
              : adWatching
                ? "Watching ad…"
                : `Watch ad → +${adBoostPerView} nuts`}
          </button>
        </div>

        <div style={{ borderTop: "1px solid #16352A", paddingTop: 10, marginTop: 10 }}>
          <div style={{ fontSize: 11, color: "#7FBFA0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>League slots</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#16352A", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (leaguesUsed / maxLeagueSlots) * 100)}%`, background: leaguesUsed >= maxLeagueSlots ? "#C75146" : "#2FA86C", transition: "width .3s" }} />
            </div>
            <span className="mono" style={{ fontSize: 12, color: leaguesUsed >= maxLeagueSlots ? "#C75146" : "#F4F7F2", whiteSpace: "nowrap" }}>{leaguesUsed} / {maxLeagueSlots} used</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            <StatPill label="Included free" value={baseLeagueSlots} neutral />
            <StatPill label="Purchased" value={extraLeagueSlots > 0 ? `+${extraLeagueSlots} (${packsBought} pack${packsBought !== 1 ? "s" : ""})` : "None"} neutral />
            <StatPill label="Remaining" value={maxLeagueSlots - leaguesUsed} ok={leaguesUsed < maxLeagueSlots} />
          </div>
          {leaguesUsed >= maxLeagueSlots && (
            <div style={{ fontSize: 11, color: "#D9A441", marginTop: 8 }}>All slots used — purchase a pack of 3 extra slots to join or create more leagues.</div>
          )}
        </div>

        {/* Referrals section */}
        <div style={{ borderTop: "1px solid #16352A", paddingTop: 10, marginTop: 10 }}>
          <div style={{ fontSize: 11, color: "#7FBFA0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Refer a friend</div>
          <div style={{ fontSize: 12, color: "#9DBFAF", marginBottom: 10 }}>
            Share your code and you both get <span className="mono" style={{ color: "#F4F7F2", fontWeight: 600 }}>500 nuts</span> when they sign up. No limit on how many friends you can refer.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, padding: "10px 12px", borderRadius: 8, background: "#16352A", border: "1px solid #2f6b4d" }}>
              <div style={{ fontSize: 10, color: "#7FBFA0", marginBottom: 2 }}>Your referral code</div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "#2FA86C", letterSpacing: 2 }}>{userReferralCode}</div>
            </div>
            <button onClick={copyReferralCode} className="sg" style={{ padding: "0 14px", borderRadius: 8, border: "1px solid #2f6b4d", background: copiedCode ? "#16352A" : "transparent", color: copiedCode ? "#2FA86C" : "#7FBFA0", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
              {copiedCode ? "✓ Copied!" : "Copy code"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            <StatPill label="Friends referred" value={referralsEarned} neutral />
            <StatPill label="Nuts earned" value={`${referralsEarned * 500}`} ok={referralsEarned > 0} />
          </div>
          <div style={{ fontSize: 11, color: "#7FBFA0", marginBottom: 6 }}>When a friend joins, apply your 500 nut bonus to:</div>
          <select
            value={referralRewardComp}
            onChange={(e) => setReferralRewardComp(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #1c5f3f", background: "#16352A", color: "#F4F7F2", fontSize: 13, marginBottom: 8 }}
          >
            {COMPETITIONS.filter((c) => c.active).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
          <button onClick={simulateFriendJoining} className="sg" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #2f6b4d", background: "transparent", color: "#7FBFA0", fontSize: 12, fontWeight: 600 }}>
            Simulate a friend joining with your code (demo only)
          </button>
        </div>
      </div>

      {CATEGORIES.map((cat) => {
        const compsInCat = COMPETITIONS.filter((c) => c.category === cat.key && c.active);
        const activeComps = compsInCat.filter((c) => {
          const cd = compData[c.key];
          return cd.balance > 0 || cd.bets.length > 0 || cd.season.length > 0;
        });
        if (activeComps.length === 0) return null;
        return (
          <div key={cat.key} style={{ marginBottom: 16 }}>
            <div className="sg" style={{ fontSize: 11, fontWeight: 700, color: "#7FBFA0", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{cat.name}</div>
            {activeComps.map((comp) => {
              const cd = compData[comp.key];
              const startOfRound = cd.balance + WEEKLY_TOPUP;
              const committed = cd.bets.reduce((a, b) => a + b.stake, 0);
              const minRequired = startOfRound * MIN_COMMIT_FRACTION;
              const meetsMin = committed >= minRequired;
              const mySeasonRows = cd.season.filter((r) => r.name === userName);
              const latestRank = mySeasonRows.length ? mySeasonRows[mySeasonRows.length - 1].rank : null;
              const totalPlayers = mySeasonRows.length ? cd.season.filter((r) => r.round === mySeasonRows[mySeasonRows.length - 1].round).length : null;
              const top3 = mySeasonRows.filter((r) => r.rank <= 3).length;
              const roundsPlayed = mySeasonRows.length;
              return (
                <div key={comp.key} style={{ ...card, marginBottom: 8, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div className="sg" style={{ fontSize: 14, fontWeight: 700 }}>{comp.name}</div>
                      <div style={{ fontSize: 11, color: "#7FBFA0" }}>{roundLabel(comp, cd.round)} &middot; {cd.stage}</div>
                    </div>
                    <div className="mono" style={{ fontSize: 12, color: "#2FA86C", fontWeight: 700, textAlign: "right" }}>
                      {Math.round(startOfRound)} nuts
                      <div style={{ fontSize: 10, color: "#7FBFA0", fontWeight: 400 }}>balance</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    <StatPill label="Committed" value={`${Math.round(committed)}`} ok={meetsMin} />
                    <StatPill label="Min required" value={`${Math.round(minRequired)}`} neutral />
                    <StatPill label="Current rank" value={latestRank ? `#${latestRank}/${totalPlayers}` : "—"} neutral />
                    <StatPill label="Top 3 finishes" value={roundsPlayed ? `${top3}/${roundsPlayed}` : "—"} neutral />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {compsInactiveSummary(compData, userName)}

      {myGroups.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="sg" style={{ fontSize: 11, fontWeight: 700, color: "#7FBFA0", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>My leagues</div>
          {myGroups.map((g) => (
            <div key={g.id} style={{ ...card, marginBottom: 8, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="sg" style={{ fontSize: 13, fontWeight: 700 }}>{g.name}</div>
                <div style={{ fontSize: 11, color: "#7FBFA0" }}>{g.members.length} member{g.members.length !== 1 ? "s" : ""}</div>
              </div>
              <div className="mono" style={{ fontSize: 11, color: g.status === "approved" ? "#7FBFA0" : "#D9A441" }}>{g.status}</div>
            </div>
          ))}
        </div>
      )}

      {myGroups.length === 0 && (
        <div style={{ ...card, fontSize: 12, color: "#5E8775", textAlign: "center", padding: 20 }}>
          No leagues yet — head to the Leagues tab to create or join one.
        </div>
      )}
    </div>
  );
}

function compsInactiveSummary(compData, userName) {
  const inactive = COMPETITIONS.filter((c) => {
    if (!c.active) return false;
    const cd = compData[c.key];
    return cd.balance === 0 && cd.bets.length === 0 && cd.season.length === 0;
  });
  if (inactive.length === 0) return null;
  const grouped = CATEGORIES.map((cat) => ({ ...cat, comps: inactive.filter((c) => c.category === cat.key) })).filter((g) => g.comps.length > 0);
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="sg" style={{ fontSize: 11, fontWeight: 700, color: "#5E8775", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Not yet active</div>
      <div style={{ ...card, padding: "10px 14px" }}>
        {grouped.map((cat) => (
          <div key={cat.key} style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#7FBFA0", fontWeight: 600 }}>{cat.name}: </span>
            <span style={{ fontSize: 12, color: "#5E8775" }}>{cat.comps.map((c) => c.name).join(", ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatPill({ label, value, ok, neutral }) {
  const color = neutral ? "#9DBFAF" : ok ? "#2FA86C" : "#D9A441";
  return (
    <div style={{ background: "#16352A", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
      <div className="mono" style={{ fontSize: 13, fontWeight: 600, color }}>{value}</div>
      <div style={{ fontSize: 9, color: "#5E8775", marginTop: 2 }}>{label}</div>
    </div>
  );
}

const shell = { minHeight: "100vh", background: "linear-gradient(180deg, #0A1F1A 0%, #0D241D 100%)", color: "#F4F7F2", fontFamily: "'Inter', system-ui, sans-serif", padding: "24px 16px 60px" };
const card = { background: "#0F2920", border: "1px solid #1c5f3f", borderRadius: 14, padding: 16 };
const fontImports = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
  .sg { font-family: 'Space Grotesk', sans-serif; }
  .mono { font-family: 'IBM Plex Mono', monospace; }
  button { cursor: pointer; }
  input[type=range] { accent-color: #2FA86C; }
`;
