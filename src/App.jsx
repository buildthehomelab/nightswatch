import { useState, useEffect, useRef, useMemo } from 'react';
import Dozzle from './components/Dozzle';
import TrueNas, { useTrueNas, nasIssues, fmtUptime } from './components/TrueNas';
import {
  useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle,
} from './components/TweaksPanel';
import { ISSUE_FIXTURES } from './data/fixtures';

const WEATHER_LOCATION = import.meta.env.VITE_WEATHER_LOCATION ?? "";

const ISSUE_TO_CONTAINER = {
"wan-down":       "pihole",
  "smart-tank":     "jellyfin",
  "disk-media":     "sonarr",
  "ups":            "watchtower",
};

const TWEAK_DEFAULTS = {
  state: "warnings",
  theme: "ink",
  density: "regular",
  showAmbient: true,
  showWeather: false,
  showNas: false,
};

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
    weekday: "long", month: "long", day: "numeric",
  });
}
function fmtTime(d) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function Ambient({ now, wanUp, uptime, weather, lastCheck, showWeather }) {
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
          <span className="v">{uptime}</span>
        </span>
        <span className="item">
          <span className="k">last check</span>
          <span className="v">{lastCheck}</span>
        </span>
      </div>
    </header>
  );
}

function Healthy({ now, uptime }) {
  const phrases = [
    "Nothing needs your attention.",
    "All quiet.",
    "Everything is as it should be.",
    "Nothing to report.",
  ];
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
        <span>{uptime} uptime</span>
        <span className="sep">·</span>
        <span>last incident 19 days ago</span>
      </div>
    </section>
  );
}

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

function Issue({ issue, isOpen, isFocused, onToggle, index, onOpenLogs }) {
  const ref = useRef(null);
  useEffect(() => {
    if (isFocused) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) return;
    const id = setTimeout(() => ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 360);
    return () => clearTimeout(id);
  }, [isOpen]);

  return (
    <div
      ref={ref}
      className={`issue ${issue.severity} ${isOpen ? "open" : ""} ${isFocused ? "focused" : ""} rise`}
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
            {issue.actions.map((a) => {
              if (typeof a === "object" && a.href) {
                return (
                  <a key={a.label} href={a.href} target="_blank" rel="noopener noreferrer"
                     className="action-link" onClick={(e) => e.stopPropagation()}>
                    {a.label}
                  </a>
                );
              }
              return <button key={a} onClick={(e) => e.stopPropagation()}>{a}</button>;
            })}
            {ISSUE_TO_CONTAINER[issue.id] && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenLogs(ISSUE_TO_CONTAINER[issue.id]); }}
                style={{ marginLeft: "auto" }}
              >
                open in dozzle ›
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IssueList({ issues, onOpenLogs }) {
  const [openId, setOpenId] = useState(issues[0]?.id ?? null);
  const [focusedIndex, setFocusedIndex] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        setFocusedIndex((i) => (i === null ? issues.length - 1 : Math.max(i - 1, 0)));
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setFocusedIndex((i) => (i === null ? 0 : Math.min(i + 1, issues.length - 1)));
      } else if (e.key === "Enter" && focusedIndex !== null) {
        e.preventDefault();
        const id = issues[focusedIndex]?.id;
        if (id) setOpenId((cur) => (cur === id ? null : id));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [issues, focusedIndex]);

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
          isFocused={focusedIndex === i}
          onToggle={() => { setFocusedIndex(i); setOpenId(openId === issue.id ? null : issue.id); }}
          onOpenLogs={onOpenLogs}
        />
      ))}
    </section>
  );
}

const SHORTCUTS = [
  { key: "j / k",    desc: "navigate issues" },
  { key: "enter",    desc: "expand / collapse issue" },
  { key: "h  or  ?", desc: "show this help" },
  { key: "l",        desc: "open log viewer" },
  { key: "r",        desc: "refresh status" },
  { key: "t",        desc: "toggle theme" },
  { key: "`",        desc: "toggle tweaks panel" },
  { key: "esc",      desc: "close overlay" },
];

function HelpOverlay({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`dozzle-scrim ${open ? "open" : ""}`} onClick={onClose} />
      <div className="help-overlay" style={{ display: open ? "flex" : "none" }}>
        <div className="help-inner">
          <div className="help-title">keyboard shortcuts</div>
          <table className="help-table">
            <tbody>
              {SHORTCUTS.map(({ key, desc }) => (
                <tr key={key}>
                  <td className="help-key">{key}</td>
                  <td className="help-desc">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="help-dismiss" onClick={onClose}>press esc or click to close</div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const themeRef = useRef(t.theme);
  const startTime = useRef(Date.now());
  useEffect(() => { themeRef.current = t.theme; }, [t.theme]);
  const [now, setNow] = useState(new Date());
  const [dozzleOpen, setDozzleOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { data: nasData, err: nasErr } = useTrueNas();
  const [wanUp, setWanUp] = useState(true);
  const [wanDownSince, setWanDownSince] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const wanFailCount = useRef(0);
  const [weather, setWeather] = useState("—");

  useEffect(() => {
    if (!WEATHER_LOCATION) return;
    const poll = async () => {
      try {
        const r = await fetch(`/wttr/${encodeURIComponent(WEATHER_LOCATION)}?format=1`);
        const text = (await r.text()).trim();
        // "⛅ +12°C" → strip leading +, collapse spaces, lowercase → "⛅ 12°c"
        const clean = text.replace(/^\+/, '').replace(/\s+/g, ' ').trim().toLowerCase();
        setWeather(clean || '—');
      } catch {}
    };
    poll();
    const id = setInterval(poll, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const openLogs = () => setDozzleOpen(true);

  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (e.key === "l" || e.key === "L") {
        if (dozzleOpen) return;
        e.preventDefault();
        openLogs();
      } else if (e.key === "h" || e.key === "H" || e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setNow(new Date());
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setTweak("theme", themeRef.current === "paper" ? "ink" : "paper");
      } else if (e.key === "Escape") {
        setHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dozzleOpen]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        await fetch("https://1.1.1.1", { mode: "no-cors", cache: "no-store" });
        wanFailCount.current = 0;
        setWanUp(true);
        setWanDownSince(null);
      } catch {
        wanFailCount.current += 1;
        if (wanFailCount.current >= 3) {
          setWanUp((prev) => {
            if (prev) setWanDownSince(new Date());
            return false;
          });
        }
      }
      setLastChecked(new Date());
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", t.theme === "ink" ? "dark" : "light");
    document.body.className = `density-${t.density}`;
  }, [t.theme, t.density]);

  const issues = useMemo(() => {
    const fixtureIssues = (() => {
      if (t.state === "healthy")  return [];
      if (t.state === "warnings") return ISSUE_FIXTURES.warnings;
      if (t.state === "critical") return ISSUE_FIXTURES.all;
      return [];
    })().filter((i) => i.id !== "wan-down");

    if (!wanUp) {
      const since = wanDownSince
        ? wanDownSince.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
        : "unknown";
      const wanIssue = {
        id: "wan-down",
        severity: "crit",
        label: "wan down",
        headline: "Internet connection is offline.",
        source: "connectivity check · 1.1.1.1",
        when: `since ${since}`,
        description: "Active connectivity check failed. Cannot reach 1.1.1.1 (Cloudflare). Outbound services are unreachable.",
        logs: [
          { t: since, level: "err", text: "[wan] fetch https://1.1.1.1 failed — network unreachable" },
        ],
        actions: ["restart pppoe", "ping ISP gateway", "ssh edgerouter"],
      };
      return [wanIssue, ...fixtureIssues];
    }

    return [...fixtureIssues, ...nasIssues(nasData)];
  }, [t.state, wanUp, wanDownSince, nasData]);

  const lastCheck = useMemo(() => {
    if (!lastChecked) return "never";
    const secs = Math.floor((now - lastChecked) / 1000);
    if (secs < 60) return "just now";
    const mins = Math.floor(secs / 60);
    return `${mins}m ago`;
  }, [now, lastChecked]);

  const uptime = useMemo(() => {
    if (nasData?.info?.uptime_seconds != null) return fmtUptime(nasData.info.uptime_seconds);
    const secs = Math.floor((now - startTime.current) / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }, [now, nasData]);

  const isHealthy = issues.length === 0;

  return (
    <>
      <div className="page">
        {t.showNas && <TrueNas data={nasData} err={nasErr} />}

        {t.showAmbient && (
          <Ambient
            now={now}
            wanUp={wanUp}
            uptime={uptime}
            weather={weather}
            lastCheck={lastCheck}
            showWeather={t.showWeather}
          />
        )}

        {isHealthy ? (
          <Healthy now={now} uptime={uptime} />
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
            <a href="#" onClick={(e) => { e.preventDefault(); openLogs(); }}>logs</a>
            {"   "}
            <a href="#" onClick={(e) => e.preventDefault()}>history</a>
          </span>
        </footer>
      </div>

      <Dozzle
        open={dozzleOpen}
        onClose={() => setDozzleOpen(false)}
      />

      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />

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
        <TweakToggle label="Show NAS strip"   value={t.showNas}     onChange={(v) => setTweak("showNas", v)} />
      </TweaksPanel>
    </>
  );
}
