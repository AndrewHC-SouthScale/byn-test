import { useState, useMemo, useRef } from "react";
import { Trophy, RotateCcw, Shuffle, TrendingUp, TrendingDown } from "lucide-react";

// ---------- LMSR math ----------
// price_i = exp(q_i/b) / sum(exp(q_j/b))
// cost(q) = b * ln(sum(exp(q_j/b)))
function prices(q, b) {
  const exps = q.map((qi) => Math.exp(qi / b));
  const sum = exps.reduce((a, c) => a + c, 0);
  return exps.map((e) => e / sum);
}
function cost(q, b) {
  const sum = q.reduce((a, qi) => a + Math.exp(qi / b), 0);
  return b * Math.log(sum);
}
// Solve for shares delta such that spending `budget` on outcome i costs exactly `budget`.
function sharesForBudget(q, b, i, budget) {
  let lo = 0;
  let hi = Math.max(budget * 20, b * 5);
  const c0 = cost(q, b);
  for (let iter = 0; iter < 80; iter++) {
    const mid = (lo + hi) / 2;
    const qTest = [...q];
    qTest[i] += mid;
    const spent = cost(qTest, b) - c0;
    if (spent > budget) hi = mid;
    else lo = mid;
  }
  return lo;
}

const OUTCOMES = [
  { key: "home", label: "Arsenal", sub: "Home win", color: "#2FA86C", colorDim: "#1c5f3f" },
  { key: "draw", label: "Draw", sub: "Tie", color: "#D9A441", colorDim: "#7a5d28" },
  { key: "away", label: "Chelsea", sub: "Away win", color: "#C75146", colorDim: "#702c26" },
];

const BOT_NAMES = ["turf_tom", "kop_end_kid", "9pointer", "matchday_mo", "blue_or_bust", "gunner_84", "pundit_paula", "season_ticket_sam"];

export default function AMMSimulator() {
  const [b, setB] = useState(300);
  const [q, setQ] = useState([0, 0, 0]);
  const [credits] = useState(1000);
  const [selected, setSelected] = useState("home");
  const [stake, setStake] = useState(150);
  const [history, setHistory] = useState([]);
  const idxOf = (k) => OUTCOMES.findIndex((o) => o.key === k);

  const p = useMemo(() => prices(q, b), [q, b]);

  function placeBet(outcomeKey, amount, actor = "you") {
    const i = idxOf(outcomeKey);
    const before = prices(q, b)[i];
    const delta = sharesForBudget(q, b, i, amount);
    const newQ = [...q];
    newQ[i] += delta;
    setQ(newQ);
    const after = prices(newQ, b)[i];
    setHistory((h) => [
      {
        actor,
        outcome: outcomeKey,
        amount,
        shares: delta,
        before,
        after,
        impliedOddsBefore: 1 / before,
        id: Math.random().toString(36).slice(2),
      },
      ...h,
    ].slice(0, 12));
  }

  function reset() {
    setQ([0, 0, 0]);
    setHistory([]);
  }

  function simulateCrowd() {
    let curQ = [...q];
    const newEntries = [];
    for (let n = 0; n < 5; n++) {
      const i = Math.floor(Math.random() * 3);
      const amount = Math.round(40 + Math.random() * 260);
      const before = prices(curQ, b)[i];
      const delta = sharesForBudget(curQ, b, i, amount);
      curQ[i] += delta;
      const after = prices(curQ, b)[i];
      newEntries.push({
        actor: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
        outcome: OUTCOMES[i].key,
        amount,
        shares: delta,
        before,
        after,
        impliedOddsBefore: 1 / before,
        id: Math.random().toString(36).slice(2),
      });
    }
    setQ(curQ);
    setHistory((h) => [...newEntries.reverse(), ...h].slice(0, 12));
  }

  const maxStake = Math.floor(credits * 0.5);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0A1F1A 0%, #0D241D 100%)",
        color: "#F4F7F2",
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: "24px 16px 60px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .sg { font-family: 'Space Grotesk', sans-serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        button { cursor: pointer; }
        input[type=range] { accent-color: #2FA86C; }
        .outcome-btn { transition: all 0.15s ease; }
        .outcome-btn:hover { transform: translateY(-1px); }
        .pitch-seg { transition: width 0.5s cubic-bezier(.4,0,.2,1); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #1c5f3f; border-radius: 3px; }
      `}</style>

      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#7FBFA0", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
            <Trophy size={14} /> Gameweek market &middot; LMSR pricing engine
          </div>
          <h1 className="sg" style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
            Arsenal <span style={{ color: "#7FBFA0", fontWeight: 500 }}>vs</span> Chelsea
          </h1>
          <p style={{ color: "#9DBFAF", fontSize: 13, marginTop: 4 }}>
            Prices below are the market's live implied probability. They move automatically as credits are staked &mdash; nobody sets these odds by hand.
          </p>
        </div>

        {/* Pitch bar */}
        <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", marginBottom: 8, border: "1px solid #1c5f3f" }}>
          {OUTCOMES.map((o, i) => (
            <div
              key={o.key}
              className="pitch-seg"
              style={{ width: `${(p[i] * 100).toFixed(2)}%`, background: o.color }}
              title={`${o.label}: ${(p[i] * 100).toFixed(1)}%`}
            />
          ))}
        </div>

        {/* Outcome tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
          {OUTCOMES.map((o, i) => {
            const isSel = selected === o.key;
            const last = history.find((h) => h.outcome === o.key);
            const moved = last ? last.after - last.before : 0;
            return (
              <button
                key={o.key}
                className="outcome-btn"
                onClick={() => setSelected(o.key)}
                style={{
                  background: isSel ? "#16352A" : "#0F2920",
                  border: `1.5px solid ${isSel ? o.color : "#1c5f3f"}`,
                  borderRadius: 12,
                  padding: "12px 8px",
                  textAlign: "left",
                  color: "#F4F7F2",
                }}
              >
                <div style={{ fontSize: 11, color: "#9DBFAF", marginBottom: 2 }}>{o.sub}</div>
                <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{o.label}</div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: o.color }}>
                  {(p[i] * 100).toFixed(1)}%
                </div>
                <div className="mono" style={{ fontSize: 11, color: "#7FBFA0", marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                  {(1 / p[i]).toFixed(2)}x
                  {moved !== 0 && (moved > 0
                    ? <TrendingUp size={11} color="#2FA86C" />
                    : <TrendingDown size={11} color="#C75146" />)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bet panel */}
        <div style={{ background: "#0F2920", border: "1px solid #1c5f3f", borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span className="sg" style={{ fontSize: 14, fontWeight: 700 }}>Place a bet</span>
            <span className="mono" style={{ fontSize: 12, color: "#9DBFAF" }}>
              Balance: {credits} &middot; min. commit {maxStake}
            </span>
          </div>

          <div style={{ marginBottom: 12 }}>
            <input
              type="range"
              min={10}
              max={credits}
              step={10}
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9DBFAF" }}>
              <span>10</span>
              <span className="mono" style={{ color: "#F4F7F2", fontSize: 15, fontWeight: 600 }}>{stake} credits</span>
              <span>{credits}</span>
            </div>
          </div>

          <button
            onClick={() => placeBet(selected, stake)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 10,
              border: "none",
              background: OUTCOMES[idxOf(selected)].color,
              color: "#0A1F1A",
              fontWeight: 700,
              fontSize: 14,
            }}
            className="sg"
          >
            Stake {stake} on {OUTCOMES[idxOf(selected)].label} &middot; pays {(stake / p[idxOf(selected)]).toFixed(0)} if right
          </button>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={simulateCrowd}
              style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1px solid #1c5f3f", background: "transparent", color: "#7FBFA0", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <Shuffle size={13} /> Simulate other users betting
            </button>
            <button
              onClick={reset}
              style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #1c5f3f", background: "transparent", color: "#9DBFAF", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>

        {/* Liquidity control */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9DBFAF", marginBottom: 4 }}>
            <span>Market liquidity (b) &mdash; lower = prices swing harder per bet</span>
            <span className="mono">{b}</span>
          </div>
          <input type="range" min={50} max={800} step={10} value={b} onChange={(e) => setB(Number(e.target.value))} style={{ width: "100%" }} />
        </div>

        {/* Trade history */}
        <div>
          <div className="sg" style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#9DBFAF", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Order flow
          </div>
          {history.length === 0 && (
            <div style={{ fontSize: 13, color: "#5E8775", padding: "16px 0" }}>No bets placed yet &mdash; stake above or simulate the crowd.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
            {history.map((h) => {
              const o = OUTCOMES[idxOf(h.outcome)];
              return (
                <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#0F2920", borderRadius: 8, border: "1px solid #16352A", fontSize: 12 }}>
                  <div>
                    <span style={{ color: "#F4F7F2", fontWeight: 600 }}>{h.actor}</span>
                    <span style={{ color: "#7FBFA0" }}> staked </span>
                    <span className="mono" style={{ color: "#F4F7F2" }}>{h.amount}</span>
                    <span style={{ color: "#7FBFA0" }}> on </span>
                    <span style={{ color: o.color, fontWeight: 600 }}>{o.label}</span>
                  </div>
                  <div className="mono" style={{ color: "#9DBFAF" }}>
                    {(h.before * 100).toFixed(1)}% &rarr; {(h.after * 100).toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
