// app.jsx — Homelab Dashboard
const { useState, useEffect, useMemo } = React;

// Map issue IDs to the container Dozzle should focus on
const ISSUE_TO_CONTAINER = {
  "certs-jellyfin": "nginx",
  "updates-docker": "watchtower",
  "wan-down":       "pihole",
  "smart-tank":     "jellyfin",
  "disk-media":     "sonarr",
  "ups":            "watchtower",
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "state": "warnings",
  "theme": "paper",
  "density": "regular",
  "showAmbient": true,
  "showWeather": true
}/*EDITMODE-END*/;

// ── Greeting helper ─────────────────────────────────────
function greeting(d) {
  const h = d.getHours();
  if (h < 5)  return "Late night.";
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  if (h < 21) return "Good evening.";
  return "Good night.";
}

function fmtDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
function fmtTime(d) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ── Ambient header strip ────────────────────────────────
function Ambient({ now, wanUp, uptimeDays, weather, lastCheck, showWeather }) {
  return (
    <header className="ambient rise">
      <div className="left">
        <span className="item">
          <span className="v">{fmtTime(now)}</span>
          <span className="k">· {fmtDate(now).toLowerCase()}</span>
        </span>
      </div>
      <div className="right">
        {showWeather && (
          <span className="item">
            <span className="k">outside</span>
            <span className="v">{weather}</span>
          </span>
        )}
        <span className="item">
          <span className="k">wan</span>
          <span className={`dot ${wanUp ? "" : "crit"}`}></span>
          <span className="v">{wanUp ? "up" : "down"}</span>
        </span>
        <span className="item">
          <span className="k">uptime</span>
          <span className="v">{uptimeDays}d</span>
        </span>
        <span className="item">
          <span className="k">last check</span>
          <span className="v">{lastCheck}</span>
        </span>
      </div>
    </header>
  );
}

// ── Healthy state ───────────────────────────────────────
function Healthy({ now, uptimeDays }) {
  const phrases = [
    "Nothing needs your attention.",
    "All quiet.",
    "Everything is as it should be.",
    "Nothing to report.",
  ];
  // Stable per-day phrase
  const phrase = phrases[now.getDate() % phrases.length];
  return (
    <section className="healthy">
      <div className="rise rise-d1">
        <div className="masthead" style={{ padding: "0 0 28px" }}>
          <div className="eyebrow">{greeting(now)}</div>
        </div>
        <p className="hero">
          <em>{phrase}</em>
        </p>
      </div>
      <div className="sub rise rise-d2">
        <span>14 services healthy</span>
        <span className="sep">·</span>
        <span>{uptimeDays} days uptime</span>
        <span className="sep">·</span>
        <span>last incident 19 days ago</span>
      </div>
    </section>
  );
}

// ── Logs renderer ───────────────────────────────────────
function Logs({ lines }) {
  return (
    <div className="logs">
      {lines.map((l, i) => (
        <div key={i}>
          <span className="ts">{l.t}</span>{"  "}
          <span className={l.level === "err" ? "err" : l.level === "warn" ? "warn" : ""}>
            {l.text}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Issue row ───────────────────────────────────────────
function Issue({ issue, isOpen, onToggle, index, onOpenLogs }) {
  return (
    <div
      className={`issue ${issue.severity} ${isOpen ? "open" : ""} rise`}
      style={{ animationDelay: `${0.05 + index * 0.04}s` }}
      onClick={onToggle}
    >
      <div className="severity">{issue.label}</div>
      <div className="body">
        <div className="headline">
          {issue.headline}
          <span className="chev">›</span>
        </div>
        <div className="meta">
          <span className="source">{issue.source}</span>
        </div>
      </div>
      <div className="when">{issue.when}</div>

      <div className="details">
        <div className="details-inner" onClick={(e) => e.stopPropagation()}>
          <div className="description">{issue.description}</div>
          <Logs lines={issue.logs} />
          <div className="actions">
            {issue.actions.map((a) => (
              <button key={a} onClick={(e) => e.stopPropagation()}>{a}</button>
            ))}
            <button
              onClick={(e) => { e.stopPropagation(); onOpenLogs(ISSUE_TO_CONTAINER[issue.id] || "sonarr"); }}
              style={{ marginLeft: "auto" }}
            >
              open in dozzle ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Issue list ──────────────────────────────────────────
function IssueList({ issues, onOpenLogs }) {
  const [openId, setOpenId] = useState(issues[0]?.id ?? null);

  const crits = issues.filter((i) => i.severity === "crit").length;
  const warns = issues.filter((i) => i.severity === "warn").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  const summary = [];
  if (crits) summary.push(`${crits} critical`);
  if (warns) summary.push(`${warns} warning${warns > 1 ? "s" : ""}`);
  if (infos) summary.push(`${infos} advisor${infos > 1 ? "ies" : "y"}`);

  return (
    <section className="issues">
      <div className="section-label rise">
        <span>Needs attention</span>
        <span className="count">{summary.join(" · ")}</span>
      </div>
      {issues.map((issue, i) => (
        <Issue
          key={issue.id}
          issue={issue}
          index={i}
          isOpen={openId === issue.id}
          onToggle={() => setOpenId(openId === issue.id ? null : issue.id)}
          onOpenLogs={onOpenLogs}
        />
      ))}
    </section>
  );
}

// ── Main App ────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [now, setNow] = useState(new Date());
  const [dozzleOpen, setDozzleOpen] = useState(false);
  const [dozzleContainer, setDozzleContainer] = useState("sonarr");

  const openLogs = (container) => {
    setDozzleContainer(container || "sonarr");
    setDozzleOpen(true);
  };

  // Keyboard shortcut: L opens Dozzle
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === "l" || e.key === "L") && !dozzleOpen &&
          !["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        openLogs("sonarr");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dozzleOpen]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", t.theme === "ink" ? "dark" : "light");
    document.body.className = `density-${t.density}`;
  }, [t.theme, t.density]);

  const issues = useMemo(() => {
    if (t.state === "healthy")  return [];
    if (t.state === "warnings") return window.ISSUE_FIXTURES.warnings;
    if (t.state === "critical") return window.ISSUE_FIXTURES.all;
    return [];
  }, [t.state]);

  const wanUp = !issues.some((i) => i.id === "wan-down");
  const lastCheck = useMemo(() => {
    const sec = Math.floor((Date.now() - now.getTime()) / 1000);
    return "just now";
  }, [now]);

  const isHealthy = issues.length === 0;

  return (
    <>
      <div className="page">
        {t.showAmbient && (
          <Ambient
            now={now}
            wanUp={wanUp}
            uptimeDays={42}
            weather="14° · clear"
            lastCheck={lastCheck}
            showWeather={t.showWeather}
          />
        )}

        {isHealthy ? (
          <Healthy now={now} uptimeDays={42} />
        ) : (
          <>
            <div className="masthead">
              <div className="eyebrow rise">{greeting(now)}</div>
              <h1 className="rise rise-d1">
                A few things <em>need a look.</em>
              </h1>
            </div>
            <IssueList issues={issues} onOpenLogs={openLogs} />
          </>
        )}

        <footer className="footnote rise rise-d3">
          <span>homelab · {fmtDate(now).toLowerCase()}</span>
          <span>
            <a href="#" onClick={(e) => e.preventDefault()}>all services</a>
            {"   "}
            <a href="#" onClick={(e) => { e.preventDefault(); openLogs("sonarr"); }}>logs</a>
            {"   "}
            <a href="#" onClick={(e) => e.preventDefault()}>history</a>
          </span>
        </footer>
      </div>

      <Dozzle
        open={dozzleOpen}
        onClose={() => setDozzleOpen(false)}
        initialContainer={dozzleContainer}
      />

      <TweaksPanel>
        <TweakSection label="State (demo)" />
        <TweakRadio
          label="Show"
          value={t.state}
          options={[
            { value: "healthy",  label: "calm" },
            { value: "warnings", label: "warn" },
            { value: "critical", label: "crit" },
          ]}
          onChange={(v) => setTweak("state", v)}
        />

        <TweakSection label="Appearance" />
        <TweakRadio
          label="Theme"
          value={t.theme}
          options={[
            { value: "paper", label: "paper" },
            { value: "ink",   label: "ink" },
          ]}
          onChange={(v) => setTweak("theme", v)}
        />
        <TweakRadio
          label="Density"
          value={t.density}
          options={[
            { value: "compact", label: "compact" },
            { value: "regular", label: "regular" },
          ]}
          onChange={(v) => setTweak("density", v)}
        />

        <TweakSection label="Ambient strip" />
        <TweakToggle label="Show ambient bar" value={t.showAmbient} onChange={(v) => setTweak("showAmbient", v)} />
        <TweakToggle label="Show weather"     value={t.showWeather} onChange={(v) => setTweak("showWeather", v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
