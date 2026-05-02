import { useState, useEffect, useRef, useMemo } from 'react';
import Dozzle from './components/Dozzle';
import { useTrueNas, nasIssues, fmtUptime, fmtAge, fmtBytes, fmtRate, UI as NAS_UI, POOL_WARN_PCT, POOL_CRIT_PCT, CPU_WARN_C, CPU_CRIT_C } from './services/truenas';
import { useCve, cveIssues, BASE_CVE_KEYWORDS } from './services/cve';

const SERVICE_CVE_KEYWORDS = {
  enableTruenas: 'truenas',
};
import { CVE_FIXTURES } from './data/fixtures';

const DEMO = import.meta.env.DEMO === 'true';
import {
  useCustomize, CustomizePanel, CustomizeColumn, CustomizeSection, CustomizeRadio, CustomizeToggle,
} from './components/CustomizePanel';

const WEATHER_LOCATION = import.meta.env.VITE_WEATHER_LOCATION ?? "";

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

const ISSUE_TO_CONTAINER = {
  "wan-down": "pihole",
};

const CUSTOMIZE_DEFAULTS = {
  theme: "dark",
  showWeather: false,
  showWan: true,
  showUptime: true,
  enableTruenas: false,
  enableCve: false,
  showNas: false,
  showNasName: true,
  showNasLoad: true,
  showNasCpuTemp: true,
  showNasMemory: true,
  showNasApps: true,
  showNasPools: true,
  showNasNet: true,
  showDate: true,
  showRank: true,
  ambientPlacement: "bottom",
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
  const ec = crits.length > 0 ? 'em-crit' : 'em-warn';
  const maxCritAge = crits.reduce((max, i) => Math.max(max, i.firstSeenTs ? Date.now() - i.firstSeenTs : 0), 0);

  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  const ignoredDays = [...(ignored?.keys() ?? [])].some(key => {
    const ts = Number(key.split(':').pop());
    return !isNaN(ts) && (Date.now() - ts) > TWO_DAYS;
  });

  if (issues.some(i => i.id === 'wan-down'))    return <em className={ec}>{pickPhrase(PHRASES.wanDown)}</em>;
  if (ignoredDays)                               return <em className={ec}>{pickPhrase(PHRASES.ignoredDays)}</em>;
  if (maxCritAge >= MASTHEAD_STALE_MS)           return <em className={ec}>{pickPhrase(PHRASES.stale)}</em>;
  if (crits.length > 1)                          return <em className={ec}>{pickPhrase(PHRASES.multiCrit)}</em>;
  if (crits.length > 0 && ignored?.size > 0)     return <em className={ec}>{pickPhrase(PHRASES.critIgnored)}</em>;
  if (crits.length > 0)                          return <em className={ec}>{pickPhrase(PHRASES.crit)}</em>;
  if (issues.length > 1)                         return <em className="em-warn">{pickPhrase(PHRASES.multiIssue)}</em>;
  return <em className="em-warn">{pickPhrase(PHRASES.singleWarn)}</em>;
}


function fmtDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
}
function fmtTime(d) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function Ambient({ now, wanUp, uptime, rank, weather, showWeather, showWan, showUptime, showRank, showNas, showNasName, showNasLoad, showNasCpuTemp, showNasMemory, showNasApps, showNasPools, showNasNet, showDate, placement, nasData }) {
  const pools    = Array.isArray(nasData?.pools) ? nasData.pools : [];
  const apps     = Array.isArray(nasData?.apps)  ? nasData.apps  : [];
  const running  = apps.filter(a => a.state === 'RUNNING').length;
  const load1    = nasData?.info?.loadavg?.[0]?.toFixed(2);
  const hostname = nasData?.info?.hostname ?? 'nas';
  const cpuTemp  = nasData?.cpuTemp ?? null;
  const cpuCls   = cpuTemp == null ? '' : cpuTemp >= CPU_CRIT_C ? ' crit' : cpuTemp >= CPU_WARN_C ? ' warn' : '';
  const memFree = nasData?.memFree ?? null;

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
            <span className="item"><span className="k">load</span><span className="v">{load1}</span></span>
          )}
          {showNasCpuTemp && cpuTemp != null && (
            <span className="item">
              <span className="k">cpu</span>
              <span className={`v${cpuCls}`}>{cpuTemp}°C</span>
            </span>
          )}
          {showNasMemory && memFree != null && (
            <span className="item">
              <span className="k">mem free</span>
              <span className="v">{fmtBytes(memFree)}</span>
            </span>
          )}
          {showNasNet && nasData?.netStats && (
            <span className="item">
              <span className="k">net</span>
              <span className="v">↓{fmtRate(nasData.netStats.rx)} ↑{fmtRate(nasData.netStats.tx)}</span>
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
          {showNasNet && nasData?.netStats && (
            <span className="item">
              <span className="k">net</span>
              <span className="v">↓{fmtRate(nasData.netStats.rx)} ↑{fmtRate(nasData.netStats.tx)}</span>
            </span>
          )}
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
        {showRank && rank && (
          <span className="item">
            <span className="k">rank</span>
            <span className="v rank">{rank}</span>
          </span>
        )}
      </div>
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

const HEALTHY_MILESTONES = [7, 14, 30, 60, 90, 180, 365];

function Healthy({ uptime, nasData, now, cleanSince }) {
  const pool = healthyPhrasePool(now);
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
  const apps = Array.isArray(nasData?.apps) ? nasData.apps : [];
  const running = apps.filter(a => a.state === 'RUNNING').length;
  const cleanDays = cleanSince ? Math.floor((now - new Date(cleanSince)) / 86_400_000) : null;
  const milestoneNote = cleanDays != null && HEALTHY_MILESTONES.includes(cleanDays)
    ? `${cleanDays} days without incident`
    : null;
  return (
    <section className="healthy">
      <div className="rise rise-d1">
        <p className="hero">
          <em>{phrase}</em>
        </p>
      </div>
      <div className="sub rise rise-d2">
        {running > 0 && <><span>{running} services healthy</span><span className="sep">·</span></>}
        <span>{uptime} uptime</span>
        {milestoneNote && <><span className="sep">·</span><span className="milestone">{milestoneNote}</span></>}
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

function Issue({ issue, isOpen, isFocused, onToggle, index, onOpenLogs, onIgnore }) {
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
            {ISSUE_TO_CONTAINER[issue.id] && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenLogs(ISSUE_TO_CONTAINER[issue.id]); }}
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

function IssueList({ issues, onOpenLogs, onIgnore }) {
  const [openId, setOpenId] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [filterSev, setFilterSev] = useState(null);

  const filtered = filterSev ? issues.filter(i => i.severity === filterSev) : issues;

  useEffect(() => {
    setFocusedIndex(null);
    setOpenId(null);
  }, [filterSev]);

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
    <section className="issues">
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
          onToggle={() => { setFocusedIndex(i); setOpenId(openId === issue.id ? null : issue.id); }}
          onOpenLogs={onOpenLogs}
          onIgnore={onIgnore}
        />
      ))}
    </section>
  );
}

const SHORTCUTS = [
  { key: "j / k",    desc: "navigate issues" },
  { key: "enter",    desc: "expand / collapse issue" },
  { key: "1 / 2 / 3", desc: "filter critical / warning / advisory" },
  { key: "h  /  ?  /  `", desc: "toggle this panel" },
  { key: "l",             desc: "open log viewer" },
  { key: "r",             desc: "refresh status" },
  { key: "esc",      desc: "close overlay" },
];


export default function App() {
  const [t, setTweak] = useCustomize(CUSTOMIZE_DEFAULTS);
  const startTime = useRef(Date.now());
  const [now, setNow] = useState(new Date());
  const [dozzleOpen, setDozzleOpen] = useState(false);
  const [dozzleContainer, setDozzleContainer] = useState(null);
  const [ignored, setIgnored] = useState(() => loadIgnored());
  const [cleanSince, setCleanSince] = useState(() =>
    DEMO ? new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() : localStorage.getItem(LS_CLEAN_KEY)
  );

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
  const { data: nasData, err: nasErr } = useTrueNas(t.enableTruenas);
  const cveKeywords = useMemo(() => {
    const extras = Object.entries(SERVICE_CVE_KEYWORDS)
      .filter(([flag]) => t[flag])
      .map(([, kw]) => kw);
    const all = [...BASE_CVE_KEYWORDS, ...extras];
    return [...new Set(all)];
  }, [t.enableTruenas]);
  const { data: cveData, err: cveErr } = useCve(t.enableCve, cveKeywords);
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

  const openLogs = (container) => { setDozzleContainer(container || null); setDozzleOpen(true); };

  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        if (dozzleOpen) { setDozzleOpen(false); return; }
        openLogs();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setNow(new Date());
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
    document.body.className = "density-compact";
  }, [t.theme]);

  const issues = useMemo(() => {
    const liveIssues = [
      ...nasIssues(nasData),
      ...cveIssues(cveData, cveKeywords),
      ...(DEMO && t.enableCve ? CVE_FIXTURES : []),
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
  }, [wanUp, wanDownSince, nasData, nasErr, cveData, cveErr, cveKeywords, t.enableTruenas, t.enableCve]);

  const visibleIssues = useMemo(
    () => issues.filter(i => !i.ignoreKey || !ignored.has(i.ignoreKey)),
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
          <Healthy uptime={uptime} nasData={nasData} now={now} cleanSince={cleanSince} />
        ) : (
          <>
            <div className="masthead">
              <h1 className="rise rise-d1">
                {mastheadPhrase(visibleIssues, ignored)}
              </h1>
            </div>
            <IssueList issues={visibleIssues} onOpenLogs={openLogs} onIgnore={handleIgnore} />
          </>
        )}

      </div>

      {(t.showWeather || t.showWan || t.showUptime || t.showNas || t.showDate || t.showRank) && (
        <Ambient
          now={now}
          wanUp={wanUp}
          uptime={uptime}
          rank={rank}
          weather={weather}
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
        />
      )}

      <Dozzle
        open={dozzleOpen}
        onClose={() => setDozzleOpen(false)}
        initialContainer={dozzleContainer}
      />

      <CustomizePanel side={t.ambientPlacement === "bottom" ? "top" : "bottom"}>
        <CustomizeColumn>
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
