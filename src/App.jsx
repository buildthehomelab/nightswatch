import { useState, useEffect, useRef, useMemo } from 'react';
import Dozzle from './components/Dozzle';
import { useTrueNas, nasIssues, fmtUptime, fmtAge, fmtBytes, UI as NAS_UI, POOL_WARN_PCT, POOL_CRIT_PCT, CPU_WARN_C, CPU_CRIT_C, MEM_WARN_PCT, MEM_CRIT_PCT } from './components/TrueNas';
import {
  useCustomize, CustomizePanel, CustomizeSection, CustomizeRadio, CustomizeToggle,
} from './components/CustomizePanel';

const WEATHER_LOCATION = import.meta.env.VITE_WEATHER_LOCATION ?? "";

const ISSUE_TO_CONTAINER = {
"wan-down":       "pihole",
  "smart-tank":     "jellyfin",
  "disk-media":     "sonarr",
  "ups":            "watchtower",
};

const CUSTOMIZE_DEFAULTS = {
  theme: "ink",
  density: "compact",
  showWeather: false,
  showWan: true,
  showUptime: true,
  showNas: false,
  showNasName: true,
  showNasLoad: true,
  showNasCpuTemp: true,
  showNasMemory: true,
  showNasApps: true,
  showNasPools: true,
  showDate: true,
  ambientPlacement: "bottom",
};

const MASTHEAD_STALE_MS = 4 * 60 * 60 * 1000;

function mastheadPhrase(issues) {
  const crits = issues.filter(i => i.severity === 'crit');
  const warns = issues.filter(i => i.severity === 'warn');
  const ec = crits.length > 0 ? 'em-crit' : 'em-warn';

  const maxCritAge = crits.reduce((max, i) => Math.max(max, i.firstSeenTs ? Date.now() - i.firstSeenTs : 0), 0);
  if (maxCritAge >= MASTHEAD_STALE_MS) {
    const age = fmtAge(maxCritAge);
    const label = crits.length === 1 ? 'Critical issue' : `${crits.length} critical issues`;
    return <>{label} unresolved for <em className={ec}>over {age}.</em></>;
  }

  if (crits.length === 1 && warns.length === 0) {
    if (crits[0].id === 'wan-down') return <>Internet is <em className={ec}>down.</em></>;
    return <>One critical issue <em className={ec}>needs attention.</em></>;
  }
  if (crits.length > 1 && warns.length === 0) {
    return <>{crits.length} critical issues <em className={ec}>need attention.</em></>;
  }
  if (crits.length === 0 && warns.length === 1) {
    return <>One thing <em className={ec}>needs a look.</em></>;
  }
  if (crits.length === 0) {
    return <>A few things <em className={ec}>need a look.</em></>;
  }
  return <>{issues.length} things <em className={ec}>need attention.</em></>;
}

function mastheadEyebrow(issues) {
  const crits = issues.filter(i => i.severity === 'crit').length;
  const warns = issues.filter(i => i.severity === 'warn').length;
  const parts = [];
  if (crits) parts.push(`${crits} critical`);
  if (warns) parts.push(`${warns} warning${warns > 1 ? 's' : ''}`);
  return parts.join(' · ');
}


function fmtDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
}
function fmtTime(d) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function Ambient({ now, wanUp, uptime, weather, showWeather, showWan, showUptime, showNas, showNasName, showNasLoad, showNasCpuTemp, showNasMemory, showNasApps, showNasPools, showDate, placement, nasData }) {
  const pools    = Array.isArray(nasData?.pools) ? nasData.pools : [];
  const apps     = Array.isArray(nasData?.apps)  ? nasData.apps  : [];
  const running  = apps.filter(a => a.state === 'RUNNING').length;
  const load1    = nasData?.info?.loadavg?.[0]?.toFixed(2);
  const hostname = nasData?.info?.hostname ?? 'nas';
  const cpuTemp  = nasData?.cpuTemp ?? null;
  const cpuCls   = cpuTemp == null ? '' : cpuTemp >= CPU_CRIT_C ? ' crit' : cpuTemp >= CPU_WARN_C ? ' warn' : '';
  const physmem     = nasData?.info?.physmem ?? null;
  const memFree     = nasData?.memFree ?? null;
  const arcSize     = nasData?.arcSize ?? null;
  const memServices = physmem != null && memFree != null && arcSize != null
    ? Math.max(0, physmem - memFree - arcSize) : null;
  const memPct  = memServices != null && physmem ? Math.round((memServices / physmem) * 100) : null;
  const memCls  = memPct == null ? '' : memPct >= MEM_CRIT_PCT ? ' crit' : memPct >= MEM_WARN_PCT ? ' warn' : '';

  return (
    <footer className="ambient rise" data-placement={placement}>
      {showNas && nasData && (
        <div className="left">
          {showNasName && (
            <span className="item">
              <a href={NAS_UI} target="_blank" rel="noopener noreferrer" className="nas-link">{hostname}</a>
            </span>
          )}
          {showNasLoad && load1 && (
            <span className="item"><span className="k">load</span><span className="v">{load1}</span></span>
          )}
          {showNasCpuTemp && cpuTemp != null && (
            <span className="item">
              <span className="k">cpu</span>
              <span className={`v${cpuCls}`}>{cpuTemp}°C</span>
            </span>
          )}
          {showNasMemory && memPct != null && (
            <span className="item">
              <span className="k">mem</span>
              <span className={`v${memCls}`}>{memPct}%</span>
            </span>
          )}
          {showNasApps && apps.length > 0 && (
            <span className="item">
              <span className="k">apps</span>
              <span className="v">{running}/{apps.length}</span>
            </span>
          )}
          {showNasPools && pools.map(pool => {
            const pct    = pool.size ? Math.round((pool.allocated / pool.size) * 100) : null;
            const ok     = pool.status === 'ONLINE';
            const dotCls = !ok || pct >= POOL_CRIT_PCT ? ' crit' : pct >= POOL_WARN_PCT ? ' warn' : '';
            const valCls = !ok || pct >= POOL_CRIT_PCT ? ' crit' : pct >= POOL_WARN_PCT ? ' warn' : '';
            return (
              <span key={pool.name} className="item">
                <span className={`dot${dotCls}`} />
                <span className="k">{pool.name}</span>
                <span className={`v${valCls}`}>{pct != null ? `${pct}%` : '—'}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="mid">
        {showWeather && (
          <span className="item">
            <span className="k">outside</span>
            <span className="v">{weather}</span>
          </span>
        )}
        {showWan && (
          <span className="item">
            <span className="k">wan</span>
            <span className={`dot ${wanUp ? "" : "crit"}`}></span>
            <span className="v">{wanUp ? "up" : "down"}</span>
          </span>
        )}
        {showUptime && (
          <span className="item">
            <span className="k">uptime</span>
            <span className="v">{uptime}</span>
          </span>
        )}
      </div>

      {showDate && (
        <div className="right">
          <span className="item">
            <span className="v">{fmtTime(now)}</span>
            <span className="k">· {fmtDate(now)}</span>
          </span>
        </div>
      )}
    </footer>
  );
}

function Healthy({ now, uptime, nasData }) {
  const phrases = [
    "Nothing needs your attention.",
    "All quiet.",
    "Everything is as it should be.",
    "Nothing to report.",
  ];
  const phrase = phrases[now.getDate() % phrases.length];
  const apps = Array.isArray(nasData?.apps) ? nasData.apps : [];
  const running = apps.filter(a => a.state === 'RUNNING').length;
  return (
    <section className="healthy">
      <div className="rise rise-d1">
        <div className="masthead" style={{ padding: "0 0 28px" }} />
        <p className="hero">
          <em>{phrase}</em>
        </p>
      </div>
      <div className="sub rise rise-d2">
        {running > 0 && <><span>{running} services healthy</span><span className="sep">·</span></>}
        <span>{uptime} uptime</span>
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
          <Logs lines={issue.logs} />
          <div className="description">{issue.description}</div>
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
  const [openId, setOpenId] = useState(null);
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
{ key: "`",        desc: "toggle customize" },
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
  const [t, setTweak] = useCustomize(CUSTOMIZE_DEFAULTS);
  const themeRef = useRef(t.theme);
  const startTime = useRef(Date.now());
  useEffect(() => { themeRef.current = t.theme; }, [t.theme]);
  const [now, setNow] = useState(new Date());
  const [dozzleOpen, setDozzleOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { data: nasData, err: nasErr } = useTrueNas();
  const [wanUp, setWanUp] = useState(true);
  const [wanDownSince, setWanDownSince] = useState(null);
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
    const probe = (url) => fetch(url, { mode: "no-cors", cache: "no-store" }).then(() => true).catch(() => false);
    const check = async () => {
      const [cf, google] = await Promise.all([probe("https://1.1.1.1"), probe("https://8.8.8.8")]);
      if (cf || google) {
        wanFailCount.current = 0;
        setWanUp(true);
        setWanDownSince(null);
      } else {
        wanFailCount.current += 1;
        if (wanFailCount.current >= 3) {
          setWanUp((prev) => {
            if (prev) setWanDownSince(new Date());
            return false;
          });
        }
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", t.theme === "ink" ? "dark" : "light");
    document.body.className = "density-compact";
  }, [t.theme]);

  const issues = useMemo(() => {
    const liveIssues = nasIssues(nasData);
    if (!wanUp) {
      const since = wanDownSince
        ? wanDownSince.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
        : "unknown";
      const wanAge = wanDownSince ? Date.now() - wanDownSince.getTime() : 0;
      const wanWhen = wanAge >= 60 * 60 * 1000 ? `${fmtAge(wanAge)} down` : `since ${since}`;
      const wanIssue = {
        id: "wan-down",
        severity: "crit",
        label: "wan down",
        headline: "Internet connection is offline.",
        source: "connectivity check · 1.1.1.1 · 8.8.8.8",
        firstSeenTs: wanDownSince?.getTime() ?? null,
        when: wanWhen,
        description: "Active connectivity checks failed. Cannot reach 1.1.1.1 (Cloudflare) or 8.8.8.8 (Google). Outbound services are unreachable.",
        logs: [
          { t: since, level: "err", text: "[wan] probe 1.1.1.1 failed — network unreachable" },
          { t: since, level: "err", text: "[wan] probe 8.8.8.8 failed — network unreachable" },
        ],
        actions: ["restart pppoe", "ping ISP gateway", "ssh edgerouter"],
      };
      return [wanIssue, ...liveIssues];
    }
    return liveIssues;
  }, [wanUp, wanDownSince, nasData]);


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

        {isHealthy ? (
          <Healthy now={now} uptime={uptime} nasData={nasData} />
        ) : (
          <>
            <div className="masthead">
              <h1 className="rise rise-d1">
                {mastheadPhrase(issues)}
              </h1>
            </div>
            <IssueList issues={issues} onOpenLogs={openLogs} />
          </>
        )}

      </div>

      {(t.showWeather || t.showWan || t.showUptime || t.showNas || t.showDate) && (
        <Ambient
          now={now}
          wanUp={wanUp}
          uptime={uptime}
          weather={weather}
          showWeather={t.showWeather}
          showWan={t.showWan}
          showUptime={t.showUptime}
          showNas={t.showNas}
          showNasName={t.showNasName}
          showNasLoad={t.showNasLoad}
          showNasCpuTemp={t.showNasCpuTemp}
          showNasMemory={t.showNasMemory}
          showNasApps={t.showNasApps}
          showNasPools={t.showNasPools}
          showDate={t.showDate}
          placement={t.ambientPlacement}
          nasData={nasData}
        />
      )}

      <Dozzle
        open={dozzleOpen}
        onClose={() => setDozzleOpen(false)}
      />

      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />

      <CustomizePanel>
        <CustomizeRadio
          label="Theme"
          value={t.theme}
          options={[
            { value: "paper", label: "paper" },
            { value: "ink",   label: "ink" },
          ]}
          onChange={(v) => setTweak("theme", v)}
        />
        <CustomizeSection label="Ambient strip" />
        <CustomizeRadio
          label="Placement"
          value={t.ambientPlacement}
          options={[
            { value: "bottom", label: "bottom" },
            { value: "top",    label: "top" },
          ]}
          onChange={(v) => setTweak("ambientPlacement", v)}
        />
        <CustomizeToggle label="Date"     value={t.showDate}    onChange={(v) => setTweak("showDate", v)} />
        <CustomizeToggle label="TrueNAS" value={t.showNas} onChange={(v) => setTweak("showNas", v)} />
        <div className="twk-sub">
          <CustomizeToggle label="Name"  value={t.showNasName}  onChange={(v) => setTweak("showNasName", v)} />
          <CustomizeToggle label="Load"    value={t.showNasLoad}    onChange={(v) => setTweak("showNasLoad", v)} />
          <CustomizeToggle label="CPU Temp" value={t.showNasCpuTemp} onChange={(v) => setTweak("showNasCpuTemp", v)} />
          <CustomizeToggle label="Memory"  value={t.showNasMemory}  onChange={(v) => setTweak("showNasMemory", v)} />
          <CustomizeToggle label="Apps"    value={t.showNasApps}    onChange={(v) => setTweak("showNasApps", v)} />
          <CustomizeToggle label="Pools" value={t.showNasPools} onChange={(v) => setTweak("showNasPools", v)} />
        </div>
        <CustomizeToggle label="Uptime"   value={t.showUptime}  onChange={(v) => setTweak("showUptime", v)} />
        <CustomizeToggle label="WAN"      value={t.showWan}     onChange={(v) => setTweak("showWan", v)} />
        <CustomizeToggle label="Weather"  value={t.showWeather} onChange={(v) => setTweak("showWeather", v)} />
      </CustomizePanel>
    </>
  );
}
