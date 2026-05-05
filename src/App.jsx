import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import SandboxPanel from './components/SandboxPanel';
import AmbientPopover from './components/AmbientPopover';
import { useTrueNas, nasIssues, fmtUptime, fmtAge, fmtBytes, fmtRate, UI as NAS_UI, POOL_WARN_PCT, POOL_CRIT_PCT, CPU_WARN_C, CPU_CRIT_C } from './services/truenas';
import { useCve, cveIssues, BASE_CVE_KEYWORDS } from './services/cve';
import { useDocker, dockerIssues, UI as DOCKER_UI } from './services/docker';
import { CVE_FIXTURES, ISSUE_FIXTURES } from './data/fixtures';
import { MOCK_NAS_STAGES } from './data/mockNas';
import { DEMO, WEATHER_LOCATION, SANDBOX_LEFT_URL, SANDBOX_RIGHT_URL } from './nwenv';
import {
  useCustomize, CustomizePanel, CustomizeColumn, CustomizeSection, CustomizeRadio, CustomizeToggle, CustomizeInput, BgImagePicker,
} from './components/CustomizePanel';

const SERVICE_CVE_KEYWORDS = {
  enableTruenas: 'truenas',
  enableDocker:  'docker',
};

const DEMO_STAGES = DEMO ? [
  { issues: [],                               nasData: MOCK_NAS_STAGES[0], duration: 10_000 },
  { issues: [ISSUE_FIXTURES.warnings[1]],     nasData: MOCK_NAS_STAGES[1], duration: 6_000  },
  { issues: [ISSUE_FIXTURES.warnings[0]],     nasData: MOCK_NAS_STAGES[2], duration: 8_000  },
  { issues: ISSUE_FIXTURES.critical,          nasData: MOCK_NAS_STAGES[3], duration: 13_000 },
] : null;

if (DEMO) document.title = 'Nightswatch [demo]';

const LS_IGNORED_KEY = 'nightswatch:ignored';
function loadIgnored() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_IGNORED_KEY) ?? '[]');
    if (raw.length && typeof raw[0] === 'string') return new Map(raw.map(k => [k, k]));
    return new Map(raw);
  } catch { return new Map(); }
}
function saveIgnored(map) {
  try { localStorage.setItem(LS_IGNORED_KEY, JSON.stringify([...map])); } catch {}
}

const SEV_ORDER = { crit: 0, warn: 1, info: 2 };

const ISSUE_TO_RIGHT_PANEL = {
  "wan-down": true,
};

const CUSTOMIZE_DEFAULTS = {
  theme: "dark",
  showWeather: false,
  showWan: true,
  showUptime: true,
  enableTruenas: DEMO,
  enableCve: false,
  enableDocker: DEMO,
  showNas: DEMO,
  showDocker: DEMO,
  showNasName: true,
  showNasLoad: true,
  showNasCpuTemp: true,
  showNasMemory: true,
  showNasApps: true,
  showNasPools: true,
  showNasNet: true,
  showDate: true,
  showRank: true,
  sandboxLeftUrl: SANDBOX_LEFT_URL,
  sandboxRightUrl: SANDBOX_RIGHT_URL,
  ambientPlacement: "bottom",
  bgFit: "cover",
  bgPosition: "center",
  bgDim: 0,
};

const MASTHEAD_STALE_MS = 4 * 60 * 60 * 1000;

const PHRASES = {
  healthy: {
    morning:   ["Rise and grind. Kidding.", "Morning. Everything behaved overnight.", "Still standing. Well rested.", "Early shift. Nothing to report.", "Caffeinate. Systems nominal."],
    afternoon: ["Live Laugh Lab.", "Boring is beautiful.", "Vibes: nominal.", "It's giving stable.", "Nothing on fire. Carry on."],
    evening:   ["Serenity now.", "No news is good news.", "Touch grass. Or don't.", "Quiet hours. Everything holding.", "Evenings are for the stable."],
    night:     ["You're still here? That's fine.", "Burning the midnight oil.", "Dark and quiet. All clear.", "Nothing moves. Good.", "live, laugh, love."],
  },
  wanDown:        ["The System is Down.", "404: Internet not found.", "The internet called in sick.", "Unplugged from the matrix."],
  ignoredDays:    ["You're cordially invited to go fuck yourself.", "Down with the System.", "We've been trying to reach you about your server's extended warranty.", "Outstanding. Truly outstanding.", "Cool cool cool cool cool.", "No thoughts, head empty, alerts ignored."],
  stale:          ["SNAFU: Situation normal, all fucked up.", "FUBAR.", "This is not a drill. (It hasn't been a drill for days.)", "We've been here before."],
  multiCrit:      ["everything is on fire. As it should be.", "Chaos reigns.", "Absolutely cooked.", "Full send.", "We're in the bad place."],
  critIgnored:    ["oh goodness.", "Yikes on bikes.", "Oh honey.", "Bless your heart.", "Sir, this is a Wendy's."],
  crit:           ["What in the Claude??!", "This is fine.", "Sending thoughts and prayers.", "Spicy.", "Please advise.", "RIP bozo.", "Red alert."],
  multiIssue:     ["everything is on fire.", "Yikes.", "Welp.", "Concerning.", "It do be like that.", "Vibes: off."],
  singleWarn:     ["One thing needs a look.", "Minor turbulence.", "A wrinkle.", "Noted."],
};

function healthyPhrasePool(now) {
  const h = now.getHours();
  if (h >= 5  && h < 12) return PHRASES.healthy.morning;
  if (h >= 12 && h < 18) return PHRASES.healthy.afternoon;
  if (h >= 18 && h < 23) return PHRASES.healthy.evening;
  return PHRASES.healthy.night;
}

function pickPhrase(arr) {
  const key = `nightswatch:phrase:${arr[0]}`;
  const ONE_MINUTE = 60_000;
  let last = {};
  try { last = JSON.parse(localStorage.getItem(key) ?? '{}'); } catch {}
  if (last.idx != null && Date.now() - (last.ts ?? 0) < ONE_MINUTE) {
    return arr[last.idx] ?? arr[0];
  }
  let idx = Math.floor(Math.random() * arr.length);
  if (arr.length > 1) {
    while (idx === last.idx) idx = Math.floor(Math.random() * arr.length);
  }
  try { localStorage.setItem(key, JSON.stringify({ idx, ts: Date.now() })); } catch {}
  return arr[idx];
}

function mastheadPhrase(issues, ignored) {
  const crits = issues.filter(i => i.severity === 'crit');
  const maxCritAge = crits.reduce((max, i) => Math.max(max, i.firstSeenTs ? Date.now() - i.firstSeenTs : 0), 0);

  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  const ignoredDays = [...(ignored?.keys() ?? [])].some(key => {
    const ts = Number(key.split(':').pop());
    return !isNaN(ts) && (Date.now() - ts) > TWO_DAYS;
  });

  if (issues.some(i => i.id === 'wan-down'))    return <em className="em-crit">{pickPhrase(PHRASES.wanDown)}</em>;
  if (ignoredDays)                               return <em className="em-crit">{pickPhrase(PHRASES.ignoredDays)}</em>;
  if (maxCritAge >= MASTHEAD_STALE_MS)           return <em className="em-crit">{pickPhrase(PHRASES.stale)}</em>;
  if (crits.length > 1)                          return <em className="em-crit">{pickPhrase(PHRASES.multiCrit)}</em>;
  if (crits.length > 0 && ignored?.size > 0)     return <em className="em-crit">{pickPhrase(PHRASES.critIgnored)}</em>;
  if (crits.length > 0)                          return <em className="em-crit">{pickPhrase(PHRASES.crit)}</em>;
  if (issues.length > 1)                         return <em className="em-crit">{pickPhrase(PHRASES.multiIssue)}</em>;
  return <em className="em-crit">{pickPhrase(PHRASES.singleWarn)}</em>;
}


function fmtDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
}
function fmtTime(d) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function GearIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function Ambient({ now, wanUp, wanDownSince, uptime, rank, cleanSince, weather, weatherForecast, startTimeMs, nasUptimeSeconds, nasVersion, showWeather, showWan, showUptime, showRank, showNas, showNasName, showNasLoad, showNasCpuTemp, showNasMemory, showNasApps, showNasPools, showNasNet, showDate, placement, nasData, toured, onOpenCustomize }) {
  const pools    = Array.isArray(nasData?.pools) ? nasData.pools : [];
  const apps     = Array.isArray(nasData?.apps)  ? nasData.apps  : [];
  const running  = apps.filter(a => a.state === 'RUNNING').length;
  const load1    = nasData?.info?.loadavg?.[0]?.toFixed(2);
  const hostname = nasData?.info?.hostname ?? 'nas';
  const cpuTemp  = nasData?.cpuTemp ?? null;
  const cpuCls   = cpuTemp == null ? '' : cpuTemp >= CPU_CRIT_C ? ' crit' : cpuTemp >= CPU_WARN_C ? ' warn' : '';
  const memFree = nasData?.memFree ?? null;

  const [popoverChip, setPopoverChip] = useState(null);
  const [popoverAnchor, setPopoverAnchor] = useState(null);
  const closeTimerRef = useRef(null);

  const openPopover = (chipId, e) => {
    clearTimeout(closeTimerRef.current);
    setPopoverChip(chipId);
    setPopoverAnchor(e.currentTarget.getBoundingClientRect());
  };
  const scheduleClose = () => {
    closeTimerRef.current = setTimeout(() => setPopoverChip(null), 250);
  };
  const cancelClose = () => clearTimeout(closeTimerRef.current);

  return (
    <footer className="ambient rise" data-placement={placement}>
      {showNas && nasData && (
        <div className="left">
          {showNasName && (
            <span className="item">
              <a href={NAS_UI} target="_blank" rel="noopener noreferrer" className="ambient-link">{hostname}</a>
            </span>
          )}
          {showNasLoad && load1 && (
            <span className="item item-pop" onMouseEnter={(e) => openPopover('load', e)} onMouseLeave={scheduleClose}>
              <span className="k">load</span><span className="v">{load1}</span>
            </span>
          )}
          {showNasCpuTemp && cpuTemp != null && (
            <span className="item item-pop" onMouseEnter={(e) => openPopover('cpu', e)} onMouseLeave={scheduleClose}>
              <span className="k">cpu</span>
              <span className={`v${cpuCls}`}>{cpuTemp}°C</span>
            </span>
          )}
          {showNasMemory && memFree != null && (
            <span className="item item-pop" onMouseEnter={(e) => openPopover('mem', e)} onMouseLeave={scheduleClose}>
              <span className="k">mem free</span>
              <span className="v">{fmtBytes(memFree)}</span>
            </span>
          )}
          {showNasNet && nasData?.netStats && (
            <span className="item item-pop" onMouseEnter={(e) => openPopover('net', e)} onMouseLeave={scheduleClose}>
              <span className="k">net</span>
              <span className="v">↓{fmtRate(nasData.netStats.rx)} ↑{fmtRate(nasData.netStats.tx)}</span>
            </span>
          )}
          {showNasApps && apps.length > 0 && (
            <span className="item item-pop" onMouseEnter={(e) => openPopover('apps', e)} onMouseLeave={scheduleClose}>
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
              <span key={pool.name} className="item item-pop" onMouseEnter={(e) => openPopover(pool.name, e)} onMouseLeave={scheduleClose}>
                <span className={`dot${dotCls}`} />
                <span className="k">{pool.name}</span>
                <span className={`v${valCls}`}>{pct != null ? `${pct}%` : '—'}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="right">
        {showDate && (
          <span className="item">
            <span className="v">{fmtTime(now)}</span>
            <span className="k">· {fmtDate(now)}</span>
          </span>
        )}
        {showWeather && (
          <span className="item item-pop" onMouseEnter={(e) => openPopover('weather', e)} onMouseLeave={scheduleClose}>
            <span className="k">outside</span>
            <span className="v">{weather}</span>
          </span>
        )}
        {showWan && (
          <span className="item item-pop" onMouseEnter={(e) => openPopover('wan', e)} onMouseLeave={scheduleClose}>
            <span className="k">wan</span>
            <span className={`dot${wanUp ? "" : " crit"}`}></span>
            <span className={`v${wanUp ? "" : " crit"}`}>{wanUp ? "up" : "down"}</span>
          </span>
        )}
        {showUptime && (
          <span className="item item-pop" onMouseEnter={(e) => openPopover('uptime', e)} onMouseLeave={scheduleClose}>
            <span className="k">uptime</span>
            <span className="v">{uptime}</span>
          </span>
        )}
        {showRank && rank && (
          <span className="item item-pop" onMouseEnter={(e) => openPopover('rank', e)} onMouseLeave={scheduleClose}>
            <span className="k">rank</span>
            <span className="v rank">{rank}</span>
          </span>
        )}
        <button
          className={`ambient-help${!toured ? ' ambient-help-first' : ''}`}
          onClick={onOpenCustomize}
          title="Customize (h / ?)"
        >{toured ? <GearIcon /> : 'configure ›'}</button>
      </div>
      <AmbientPopover
        chip={popoverChip}
        anchor={popoverAnchor}
        placement={placement}
        nasData={nasData}
        cleanSince={cleanSince}
        now={now}
        weatherForecast={weatherForecast}
        startTimeMs={startTimeMs}
        nasUptimeSeconds={nasUptimeSeconds}
        nasVersion={nasVersion}
        wanUp={wanUp}
        wanDownSince={wanDownSince}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      />
    </footer>
  );
}

const LS_CLEAN_KEY = 'nightswatch:cleanSince';
const LS_LAST_CRIT_KEY = 'nightswatch:lastCritAt';

function rankForDays(days) {
  if (days >= 100) return 'Lord Commander';
  if (days >= 30)  return 'First Ranger';
  if (days >= 7)   return 'Ranger';
  if (days >= 1)   return 'Steward';
  return 'Initiate';
}


function Healthy() {
  const pool = healthyPhrasePool(new Date());
  const bucketKey = pool[0];
  const [phrase, setPhrase] = useState(() => pickPhrase(pool));
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    setPhrase(pickPhrase(healthyPhrasePool(new Date())));
  }, [bucketKey]);
  useEffect(() => {
    const id = setInterval(() => setPhrase(pickPhrase(healthyPhrasePool(new Date()))), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <section className="healthy">
      <div className="rise rise-d1">
        <p className="hero">
          <em>{phrase}</em>
        </p>
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

function LoadDetail({ load1, load5, load15, cores, pct, trend, runningApps, jobs, warnAt, critAt }) {
  const barMax  = critAt * 2;
  const fillPct = Math.min((load1 / barMax) * 100, 100);
  const warnPct = Math.min((warnAt / barMax) * 100, 100);
  const critPct = Math.min((critAt / barMax) * 100, 100);
  const cls     = load1 >= critAt ? 'crit' : 'warn';

  return (
    <div className="ld">
      <div className="ld-stats">
        <div className="ld-stat">
          <span className="ld-stat-k">1-min</span>
          <span className={`ld-stat-v ld-stat-v--${cls}`}>{load1.toFixed(2)}</span>
        </div>
        <div className="ld-stat">
          <span className="ld-stat-k">5-min</span>
          <span className="ld-stat-v">{load5 != null ? load5.toFixed(2) : '—'}</span>
        </div>
        <div className="ld-stat">
          <span className="ld-stat-k">15-min</span>
          <span className="ld-stat-v">{load15 != null ? load15.toFixed(2) : '—'}</span>
        </div>
        {cores != null && (
          <div className="ld-stat">
            <span className="ld-stat-k">cores</span>
            <span className="ld-stat-v">{cores}</span>
          </div>
        )}
        {pct != null && (
          <div className="ld-stat">
            <span className="ld-stat-k">saturation</span>
            <span className={`ld-stat-v ld-stat-v--${cls}`}>{pct}%</span>
          </div>
        )}
      </div>

      <div className="ld-bar-wrap">
        <div className="ld-bar-track">
          <div className={`ld-bar-fill ld-bar-fill--${cls}`} style={{ width: `${fillPct}%` }} />
          <div className="ld-bar-marker ld-bar-marker--warn" style={{ left: `${warnPct}%` }} title={`warn ≥${warnAt}`} />
          {critPct < 98 && (
            <div className="ld-bar-marker ld-bar-marker--crit" style={{ left: `${critPct}%` }} title={`crit ≥${critAt}`} />
          )}
        </div>
        <div className="ld-bar-foot">
          <span className={`ld-bar-pct ld-bar-pct--${cls}`}>{load1.toFixed(2)}{trend ? ` ${trend}` : ''}</span>
          <span className="ld-bar-thr">warn ≥{warnAt} · crit ≥{critAt}</span>
        </div>
      </div>

      {jobs.length > 0 && (
        <div className="ld-section">
          <span className="ld-section-label">active jobs</span>
          <div className="ld-jobs">
            {jobs.map((j, i) => (
              <div key={i} className="ld-job">
                <span className="ld-job-method">{j.method}</span>
                {j.pct != null && <span className="ld-job-pct">{j.pct}%</span>}
                {j.desc && <span className="ld-job-desc">{j.desc}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {runningApps.length > 0 && (
        <div className="ld-section">
          <span className="ld-section-label">running apps</span>
          <div className="ld-chips">
            {runningApps.map(name => (
              <span key={name} className="ld-chip">{name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Issue({ issue, isOpen, isFocused, isFading, onToggle, index, onOpenPanel, onIgnore }) {
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
      className={`issue ${issue.severity} ${isOpen ? "open" : ""} ${isFocused ? "focused" : ""} ${isFading ? "ignoring" : ""} rise`}
      style={{ animationDelay: `${0.05 + index * 0.04}s` }}
      data-issue-id={issue.id}
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
          {issue.detail?.type === 'load'
            ? <LoadDetail {...issue.detail} />
            : <div className="description">{issue.description}</div>
          }
          <div className="actions">
            {issue.actions.map((a) => {
              if (typeof a === "object" && a !== null) {
                if (!a.href) return null;
                return (
                  <a key={a.label} href={a.href} target="_blank" rel="noopener noreferrer"
                     className="action-link" onClick={(e) => e.stopPropagation()}>
                    {a.label}
                  </a>
                );
              }
              return <button key={a} onClick={(e) => e.stopPropagation()}>{a}</button>;
            })}
            {issue.ignoreKey && (
              <button
                className="action-ignore"
                onClick={(e) => { e.stopPropagation(); onIgnore(issue.ignoreKey, issue.headline); }}
                style={{ marginLeft: "auto" }}
              >
                ignore ›
              </button>
            )}
            {ISSUE_TO_RIGHT_PANEL[issue.id] && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenPanel(); }}
              >
                open in panel ›
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IssueList({ issues, onOpenPanel, onIgnore }) {
  const [openId, setOpenId] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [filterSev, setFilterSev] = useState(null);
  const [fadingKey, setFadingKey] = useState(null);

  const handleIgnoreWithAnimation = (key, label) => {
    setFadingKey(key);
    setTimeout(() => {
      onIgnore(key, label);
      setFadingKey(null);
    }, 320);
  };

  const filtered = filterSev ? issues.filter(i => i.severity === filterSev) : issues;

  useEffect(() => {
    setFocusedIndex(null);
    setOpenId(null);
  }, [filterSev]);

  useEffect(() => {
    if (!openId) return;
    const handler = (e) => {
      const openEl = document.querySelector(`[data-issue-id="${openId}"]`);
      if (openEl && !openEl.contains(e.target)) {
        setOpenId(null);
        setFocusedIndex(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openId]);

  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        setFocusedIndex((i) => (i === null ? 0 : Math.max(i - 1, 0)));
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setFocusedIndex((i) => (i === null ? 0 : Math.min(i + 1, filtered.length - 1)));
      } else if (e.key === "Enter" && focusedIndex !== null) {
        e.preventDefault();
        const id = filtered[focusedIndex]?.id;
        if (id) setOpenId((cur) => (cur === id ? null : id));
      } else if (e.key === "1") {
        e.preventDefault();
        setFilterSev(f => f === "crit" ? null : "crit");
      } else if (e.key === "2") {
        e.preventDefault();
        setFilterSev(f => f === "warn" ? null : "warn");
      } else if (e.key === "3") {
        e.preventDefault();
        setFilterSev(f => f === "info" ? null : "info");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, focusedIndex]);

  const crits = issues.filter((i) => i.severity === "crit").length;
  const warns = issues.filter((i) => i.severity === "warn").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  const toggle = (sev) => setFilterSev(f => f === sev ? null : sev);

  const chips = [];
  if (crits) chips.push({ sev: "crit", label: `${crits} critical` });
  if (warns) chips.push({ sev: "warn", label: `${warns} warning${warns > 1 ? "s" : ""}` });
  if (infos) chips.push({ sev: "info", label: `${infos} advisor${infos > 1 ? "ies" : "y"}` });

  return (
    <section className={`issues${filtered.length === 0 ? ' empty' : ''}`}>
      <div className="section-label rise">
        <span className="count">
          {chips.map((c, i) => (
            <span key={c.sev}>
              {i > 0 && <span className="sep"> · </span>}
              <span
                className={`filter-chip filter-chip-${c.sev}${filterSev === c.sev ? " active" : ""}`}
                onClick={() => toggle(c.sev)}
              >{c.label}</span>
            </span>
          ))}
        </span>
      </div>
      {filtered.map((issue, i) => (
        <Issue
          key={issue.id}
          issue={issue}
          index={i}
          isOpen={openId === issue.id}
          isFocused={focusedIndex === i}
          isFading={fadingKey !== null && fadingKey === issue.ignoreKey}
          onToggle={() => {
            const isClosing = openId === issue.id;
            setFocusedIndex(isClosing ? null : i);
            setOpenId(isClosing ? null : issue.id);
          }}
          onOpenPanel={onOpenPanel}
          onIgnore={handleIgnoreWithAnimation}
        />
      ))}
    </section>
  );
}

const SHORTCUTS = [
  { key: "j / k",    desc: "navigate issues" },
  { key: "enter",    desc: "expand / collapse issue" },
  { key: "1 / 2 / 3", desc: "filter critical / warning / advisory" },
  { key: "` / ;",    desc: "toggle this panel" },
  { key: "h",        desc: "open left panel" },
  { key: "l",        desc: "open right panel" },
  { key: "r",             desc: "refresh status" },
  { key: "esc",      desc: "close overlay" },
];


export default function App() {
  const [t, setTweak] = useCustomize(CUSTOMIZE_DEFAULTS);
  const startTime = useRef(Date.now());
  const [now, setNow] = useState(new Date());
  const [toured, setTourred] = useState(() => !!localStorage.getItem('nightswatch:toured'));
  const markTourred = () => { setTourred(true); localStorage.setItem('nightswatch:toured', '1'); };
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [ignored, setIgnored] = useState(() => loadIgnored());
  const [cleanSince, setCleanSince] = useState(() =>
    DEMO ? new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() : localStorage.getItem(LS_CLEAN_KEY)
  );
  const [bgImage, setBgImage] = useState(() => {
    try { return localStorage.getItem('nightswatch:bgImage') ?? ''; } catch { return ''; }
  });
  const handleBgImageChange = useCallback((img) => {
    setBgImage(img);
    try {
      if (img) localStorage.setItem('nightswatch:bgImage', img);
      else localStorage.removeItem('nightswatch:bgImage');
    } catch {}
  }, []);
  const [demoStage, setDemoStage] = useState(0);

  useEffect(() => {
    if (!DEMO_STAGES || demoStage >= DEMO_STAGES.length - 1) return;
    const id = setTimeout(() => setDemoStage(s => s + 1), DEMO_STAGES[demoStage].duration);
    return () => clearTimeout(id);
  }, [demoStage]);

  const handleIgnore = (key, label) => {
    setIgnored(prev => {
      const next = new Map(prev);
      next.set(key, label);
      saveIgnored(next);
      return next;
    });
  };
  const handleUnignore = (key) => {
    setIgnored(prev => {
      const next = new Map(prev);
      next.delete(key);
      saveIgnored(next);
      return next;
    });
  };
  const { data: nasDataLive, err: nasErr } = useTrueNas(t.enableTruenas);
  const nasData = DEMO_STAGES ? DEMO_STAGES[demoStage].nasData : nasDataLive;
  const cveKeywords = useMemo(() => {
    const extras = Object.entries(SERVICE_CVE_KEYWORDS)
      .filter(([flag]) => t[flag])
      .map(([, kw]) => kw);
    const all = [...BASE_CVE_KEYWORDS, ...extras];
    return [...new Set(all)];
  }, [t.enableTruenas, t.enableDocker]);
  const { data: cveData, err: cveErr } = useCve(t.enableCve, cveKeywords);
  const { data: dockerData, err: dockerErr } = useDocker(t.enableDocker);
  const [wanUp, setWanUp] = useState(true);
  const [wanDownSince, setWanDownSince] = useState(null);
  const wanFailCount = useRef(0);
  const [weather, setWeather] = useState("—");
  const [weatherForecast, setWeatherForecast] = useState(null);

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
      try {
        const r2 = await fetch(`/wttr/${encodeURIComponent(WEATHER_LOCATION)}?format=j1`);
        const json = await r2.json();
        setWeatherForecast(json);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const openRightPanel = () => { setLeftOpen(false); setRightOpen(true); };

  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        if (!t.sandboxLeftUrl) return;
        setRightOpen(false);
        setLeftOpen(v => !v);
        if (!toured) markTourred();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        if (!t.sandboxRightUrl) return;
        setLeftOpen(false);
        setRightOpen(v => !v);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setNow(new Date());
      } else if (!toured && e.key === '?') {
        markTourred();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leftOpen, rightOpen, toured, t.sandboxLeftUrl, t.sandboxRightUrl]);

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
        const isNewlyDown = wanFailCount.current === 2;
        wanFailCount.current += 1;
        if (wanFailCount.current >= 3) {
          if (isNewlyDown) setWanDownSince(new Date());
          setWanUp(false);
        }
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", t.theme);
    document.body.className = `density-compact${bgImage ? ' has-bg-image' : ''}`;
  }, [t.theme, bgImage]);

  useEffect(() => {
    if (bgImage) {
      const dim = t.bgDim ?? 0;
      const dimLayer = dim > 0 ? `linear-gradient(rgba(0,0,0,${dim}),rgba(0,0,0,${dim})),` : '';
      document.body.style.backgroundImage = `${dimLayer}url(${bgImage})`;
      const fit = t.bgFit ?? 'cover';
      if (fit === 'tile') {
        document.body.style.backgroundSize = 'auto';
        document.body.style.backgroundRepeat = 'repeat';
      } else if (fit === 'contain') {
        document.body.style.backgroundSize = 'contain';
        document.body.style.backgroundRepeat = 'no-repeat';
      } else {
        document.body.style.backgroundSize = fit === 'stretch' ? '100% 100%' : 'cover';
        document.body.style.backgroundRepeat = 'no-repeat';
      }
      document.body.style.backgroundPosition = t.bgPosition ?? 'center';
      document.body.style.backgroundAttachment = 'fixed';
    } else {
      for (const p of ['background-image','background-size','background-repeat','background-position','background-attachment']) {
        document.body.style.removeProperty(p);
      }
    }
  }, [bgImage, t.bgFit, t.bgPosition, t.bgDim]);

  const issues = useMemo(() => {
    const liveIssues = [
      ...nasIssues(nasData),
      ...cveIssues(cveData, cveKeywords),
      ...dockerIssues(dockerData),
      ...(DEMO && t.enableCve
        ? demoStage >= 3 ? CVE_FIXTURES : demoStage >= 2 ? [CVE_FIXTURES[1]] : []
        : []),
      ...(DEMO_STAGES ? DEMO_STAGES.slice(0, demoStage + 1).flatMap(s => s.issues) : []),
    ];
    if (t.enableTruenas && nasErr) {
      liveIssues.unshift({
        id: "nas-unreachable",
        severity: "warn",
        label: "nas offline",
        headline: "Cannot reach TrueNAS.",
        source: "truenas · api",
        firstSeenTs: null,
        when: "now",
        description: `TrueNAS API is unreachable. Check that TRUENAS_HOST and TRUENAS_KEY are set correctly.\n\nError: ${nasErr}`,
        logs: [
          { t: "—", level: "err", text: `[truenas] fetch failed: ${nasErr}` },
        ],
        ignoreKey: null,
        actions: [{ label: "open truenas ›", href: NAS_UI }],
      });
    }
    if (t.enableCve && cveErr) {
      liveIssues.unshift({
        id: "cve-error",
        severity: "warn",
        label: "cve feed",
        headline: "Cannot reach NVD CVE feed.",
        source: "nvd · api",
        firstSeenTs: null,
        when: "now",
        description: `NVD API is unreachable. CVE data may be stale.\n\nError: ${cveErr}`,
        logs: [{ t: "—", level: "warn", text: `[cve] fetch failed: ${cveErr}` }],
        ignoreKey: null,
        actions: [{ label: "nvd status ›", href: "https://nvd.nist.gov/" }],
      });
    }
    if (t.enableDocker && dockerErr) {
      liveIssues.unshift({
        id: "docker-unreachable",
        severity: "warn",
        label: "docker offline",
        headline: "Cannot reach Docker daemon.",
        source: "docker · api",
        firstSeenTs: null,
        when: "now",
        description: `Docker API is unreachable. Check that DOCKER_SOCKET or DOCKER_HOST/DOCKER_PORT are configured.\n\nError: ${dockerErr}`,
        logs: [{ t: "—", level: "err", text: `[docker] fetch failed: ${dockerErr}` }],
        ignoreKey: null,
        actions: [...(DOCKER_UI ? [{ label: "open portainer ›", href: DOCKER_UI }] : [])],
      });
    }
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
        ignoreKey: `wan-down:${wanDownSince?.getTime() ?? 0}`,
        actions: ["restart pppoe", "ping ISP gateway", "ssh edgerouter"],
      };
      return [wanIssue, ...liveIssues];
    }
    return liveIssues;
  }, [wanUp, wanDownSince, nasData, nasErr, cveData, cveErr, cveKeywords, t.enableTruenas, t.enableCve, demoStage]);

  const visibleIssues = useMemo(
    () => issues
      .filter(i => !i.ignoreKey || !ignored.has(i.ignoreKey))
      .sort((a, b) => {
        const sevDiff = (SEV_ORDER[a.severity] ?? 3) - (SEV_ORDER[b.severity] ?? 3);
        if (sevDiff !== 0) return sevDiff;
        return (b.firstSeenTs ?? Date.now()) - (a.firstSeenTs ?? Date.now());
      }),
    [issues, ignored]
  );


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

  const isHealthy = visibleIssues.length === 0;
  const hasCrit = visibleIssues.some(i => i.severity === 'crit');
  const prevHasCritRef = useRef(hasCrit);

  // Mount: init cleanSince if missing and no crits
  useEffect(() => {
    if (DEMO) return;
    if (!hasCrit && !localStorage.getItem(LS_CLEAN_KEY)) {
      const ts = new Date().toISOString();
      localStorage.setItem(LS_CLEAN_KEY, ts);
      setCleanSince(ts);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Backfill from NAS uptime once per page load — extends cleanSince to system boot
  // if current streak is < NAS uptime and < 24h old (init code set it, not a real crit-clear)
  // Skipped if a crit was active and unresolved across sessions (lastCritAt still set)
  useEffect(() => {
    if (DEMO) return;
    if (!nasData?.info?.uptime_seconds) return;
    if (sessionStorage.getItem('nightswatch:backfillDone')) return;
    sessionStorage.setItem('nightswatch:backfillDone', '1');
    if (hasCrit || localStorage.getItem(LS_LAST_CRIT_KEY)) return;
    const raw = localStorage.getItem(LS_CLEAN_KEY);
    if (!raw) return;
    const msSinceClean = Date.now() - new Date(raw).getTime();
    const uptimeMs = nasData.info.uptime_seconds * 1000;
    if (uptimeMs > msSinceClean) {
      const ts = new Date(Date.now() - uptimeMs).toISOString();
      localStorage.setItem(LS_CLEAN_KEY, ts);
      setCleanSince(ts);
    }
  }, [nasData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track crit transitions: crit appears → hard reset + record when; crits clear → start new streak
  useEffect(() => {
    if (DEMO) return;
    const prev = prevHasCritRef.current;
    prevHasCritRef.current = hasCrit;
    if (!prev && hasCrit) {
      localStorage.removeItem(LS_CLEAN_KEY);
      localStorage.setItem(LS_LAST_CRIT_KEY, new Date().toISOString());
      setCleanSince(null);
    } else if (prev && !hasCrit) {
      const ts = new Date().toISOString();
      localStorage.setItem(LS_CLEAN_KEY, ts);
      localStorage.removeItem(LS_LAST_CRIT_KEY);
      setCleanSince(ts);
    }
  }, [hasCrit]);

  const rank = useMemo(() => {
    if (!cleanSince) return 'Initiate';
    const days = Math.floor((+now - new Date(cleanSince).getTime()) / 86_400_000);
    return rankForDays(days);
  }, [cleanSince, now]);

  return (
    <>
      <div className="page">

        {isHealthy ? (
          <Healthy />
        ) : (
          <>
            <div className="masthead">
              <h1 className="rise rise-d1">
                {mastheadPhrase(visibleIssues, ignored)}
              </h1>
            </div>
            <IssueList issues={visibleIssues} onOpenPanel={openRightPanel} onIgnore={handleIgnore} />
          </>
        )}

      </div>

      {(t.showWeather || t.showWan || t.showUptime || t.showNas || t.showDate || t.showRank) && (
        <Ambient
          now={now}
          wanUp={wanUp}
          wanDownSince={wanDownSince}
          uptime={uptime}
          rank={rank}
          cleanSince={cleanSince}
          weather={weather}
          weatherForecast={weatherForecast}
          startTimeMs={startTime.current}
          nasUptimeSeconds={nasData?.info?.uptime_seconds ?? null}
          nasVersion={nasData?.info?.version ?? null}
          showWeather={t.showWeather}
          showWan={t.showWan}
          showUptime={t.showUptime}
          showRank={t.showRank}
          showNas={t.showNas}
          showNasName={t.showNasName}
          showNasLoad={t.showNasLoad}
          showNasCpuTemp={t.showNasCpuTemp}
          showNasMemory={t.showNasMemory}
          showNasApps={t.showNasApps}
          showNasPools={t.showNasPools}
          showNasNet={t.showNasNet}
          showDate={t.showDate}
          placement={t.ambientPlacement}
          nasData={nasData}
          toured={toured}
          onOpenCustomize={() => { markTourred(); window.postMessage({ type: '__activate_edit_mode' }, '*'); }}
        />
      )}

      <SandboxPanel
        open={leftOpen}
        onClose={() => setLeftOpen(false)}
        url={t.sandboxLeftUrl}
        label="left panel"
        side="left"
      />
      <SandboxPanel
        open={rightOpen}
        onClose={() => setRightOpen(false)}
        url={t.sandboxRightUrl}
        label="right panel"
      />

      <CustomizePanel side={t.ambientPlacement === "bottom" ? "top" : "bottom"}>
        <CustomizeColumn wide>
          <CustomizeSection label="Theme" />
          <CustomizeRadio
            label="Theme"
            value={t.theme}
            options={[
              { value: "light", label: "light" },
              { value: "dark",  label: "dark" },
            ]}
            onChange={(v) => setTweak("theme", v)}
          />
          <CustomizeSection label="Background" />
          <BgImagePicker
            image={bgImage} fit={t.bgFit} position={t.bgPosition} dim={t.bgDim}
            onImageChange={handleBgImageChange}
            onChange={(edits) => setTweak(edits)}
          />
        </CustomizeColumn>
        <CustomizeColumn>
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
          <CustomizeToggle label="Date"    value={t.showDate}    onChange={(v) => setTweak("showDate", v)} />
          <CustomizeToggle label="Uptime"  value={t.showUptime}  onChange={(v) => setTweak("showUptime", v)} />
          <CustomizeToggle label="Rank"    value={t.showRank}    onChange={(v) => setTweak("showRank", v)} />
          <CustomizeToggle label="WAN"     value={t.showWan}     onChange={(v) => setTweak("showWan", v)} />
          <CustomizeToggle label="Weather" value={t.showWeather} onChange={(v) => setTweak("showWeather", v)} />
        </CustomizeColumn>
        <CustomizeColumn>
          <CustomizeSection label="TrueNAS" />
          <CustomizeToggle label="Enable"   value={t.enableTruenas}  onChange={(v) => setTweak("enableTruenas", v)} />
          {t.enableTruenas && <>
            <CustomizeToggle label="Ambient Strip" value={t.showNas}   onChange={(v) => setTweak("showNas", v)} />
            <div className="twk-subgroup">
              <CustomizeToggle label="Apps"     value={t.showNasApps}    onChange={(v) => setTweak("showNasApps", v)} />
              <CustomizeToggle label="CPU Temp" value={t.showNasCpuTemp} onChange={(v) => setTweak("showNasCpuTemp", v)} />
              <CustomizeToggle label="Load"     value={t.showNasLoad}    onChange={(v) => setTweak("showNasLoad", v)} />
              <CustomizeToggle label="Memory"   value={t.showNasMemory}  onChange={(v) => setTweak("showNasMemory", v)} />
              <CustomizeToggle label="Name"     value={t.showNasName}    onChange={(v) => setTweak("showNasName", v)} />
              <CustomizeToggle label="Network"  value={t.showNasNet}     onChange={(v) => setTweak("showNasNet", v)} />
              <CustomizeToggle label="Pools"    value={t.showNasPools}   onChange={(v) => setTweak("showNasPools", v)} />
            </div>
          </>}
        </CustomizeColumn>
        <CustomizeColumn>
          <CustomizeSection label="Security advisories" />
          <CustomizeToggle label="CVE feed" value={t.enableCve} onChange={(v) => setTweak("enableCve", v)} />
        </CustomizeColumn>
        <CustomizeColumn wide>
          <CustomizeSection label="Panels" />
          <CustomizeInput label="left panel" value={t.sandboxLeftUrl} onChange={(v) => setTweak("sandboxLeftUrl", v)} placeholder="https://…" />
          <CustomizeInput label="right panel" value={t.sandboxRightUrl} onChange={(v) => setTweak("sandboxRightUrl", v)} placeholder="https://…" />
        </CustomizeColumn>
        <CustomizeColumn>
          <CustomizeSection label="Ignored" />
          {(() => {
            const activeKeys = new Set(issues.map(i => i.ignoreKey).filter(Boolean));
            const active = [...ignored.entries()].filter(([k]) => activeKeys.has(k));
            return active.length === 0
              ? <span className="twk-empty">nothing ignored</span>
              : active.map(([key, label]) => (
                  <div key={key} className="twk-ignored-row">
                    <span className="twk-ignored-label" title={key}>{label || key}</span>
                    <button className="action-ignore" onClick={() => handleUnignore(key)}>unignore ›</button>
                  </div>
                ));
          })()}
        </CustomizeColumn>
        <CustomizeColumn wide push>
          <CustomizeSection label="Keyboard shortcuts" />
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
        </CustomizeColumn>
      </CustomizePanel>
    </>
  );
}
