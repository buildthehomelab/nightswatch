import { useState, useEffect, useRef } from 'react';

const UI  = "https://patronus.vaultrona.com";
const API = "/truenas/api/v2.0";
const KEY                  = import.meta.env.VITE_TRUENAS_KEY ?? "";
const STOPPED_HIDE_MINUTES = Number(import.meta.env.VITE_STOPPED_APP_HIDE_MINUTES ?? 0) || 0;

const RELEASE_TTL     = 4 * 60 * 60 * 1000;
const LS_RELEASE_KEY  = 'truenas:releaseCache';

function lsLoadRelease() {
  try {
    const raw = localStorage.getItem(LS_RELEASE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    const now = Date.now();
    return new Map(
      Object.entries(obj)
        .filter(([, v]) => now - v.fetchedAt < RELEASE_TTL)
        .map(([k, v]) => [k, v])
    );
  } catch { return new Map(); }
}

function lsSaveRelease(map) {
  try {
    localStorage.setItem(LS_RELEASE_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch {}
}

const RELEASE_CACHE = lsLoadRelease();

export function fmtUptime(sec) {
  if (sec == null) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

export function fmtBytes(bytes) {
  if (bytes == null) return "—";
  const tb = bytes / (1024 ** 4);
  if (tb >= 0.95) return `${tb.toFixed(1)} TB`;
  const gb = bytes / (1024 ** 3);
  return `${gb.toFixed(1)} GB`;
}

const LINUXSERVER_UPSTREAM = {
  lidarr:      { owner: 'Lidarr',      repo: 'Lidarr' },
  sonarr:      { owner: 'Sonarr',      repo: 'Sonarr' },
  radarr:      { owner: 'Radarr',      repo: 'Radarr' },
  prowlarr:    { owner: 'Prowlarr',    repo: 'Prowlarr' },
  qbittorrent: { owner: 'qbittorrent', repo: 'qBittorrent' },
  readarr:     { owner: 'Readarr',     repo: 'Readarr' },
  bazarr:      { owner: 'morpheus65535', repo: 'bazarr' },
};

function imageToGithubRepo(image) {
  const name = image.split(':')[0];
  if (name.startsWith('lscr.io/linuxserver/')) {
    const slug = name.slice('lscr.io/linuxserver/'.length);
    return LINUXSERVER_UPSTREAM[slug] ?? { owner: 'linuxserver', repo: slug };
  }
  if (name.startsWith('linuxserver/')) {
    const slug = name.slice('linuxserver/'.length);
    return LINUXSERVER_UPSTREAM[slug] ?? { owner: 'linuxserver', repo: slug };
  }
  if (name.startsWith('ghcr.io/')) {
    const parts = name.slice('ghcr.io/'.length).split('/');
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
  }
  const parts = name.split('/');
  if (parts.length === 2) return { owner: parts[0], repo: parts[1] };
  return null;
}

async function ghFetch(owner, repo, path) {
  const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/${path}`);
  if (!r.ok) return null;
  return r.json();
}

async function fetchLatestRelease(image) {
  const cached = RELEASE_CACHE.get(image);
  if (cached && Date.now() - cached.fetchedAt < RELEASE_TTL) return cached.release;

  const repo = imageToGithubRepo(image);
  if (!repo) return null;

  try {
    // Try releases/latest first, fall back to first tag (linuxserver-style repos)
    let release = await ghFetch(repo.owner, repo.repo, 'releases/latest');
    if (!release) {
      const tags = await ghFetch(repo.owner, repo.repo, 'tags');
      if (Array.isArray(tags) && tags[0]) {
        release = { tag_name: tags[0].name, body: null, published_at: null };
      }
    }
    RELEASE_CACHE.set(image, { release: release ?? null, fetchedAt: Date.now() });
    lsSaveRelease(RELEASE_CACHE);
    return release ?? null;
  } catch {
    return null;
  }
}

function fmtStoppedAgo(since) {
  const secs = Math.floor((Date.now() - since) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

function fmtReleaseDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function trimChangelog(body, maxLen = 400) {
  if (!body) return null;

  // Jump to Changes section if present
  const changesIdx = body.search(/^##?\s+changes/im);
  let text = changesIdx >= 0 ? body.slice(changesIdx) : body;

  text = text
    .replace(/^##?\s*.+$/gm, '')                 // strip entire header lines
    .replace(/\*\*(.+?)\*\*/g, '$1')             // bold
    .replace(/\*(.+?)\*/g, '$1')                 // italic
    .replace(/`(.+?)`/g, '$1')                   // inline code
    .replace(/\b[0-9a-f]{40}\b\s*/g, '')         // full git SHAs
    .replace(/\*\s+/g, '\n• ')                   // list items → bullets
    .replace(/\n{2,}/g, '\n')                    // collapse blank lines
    .trim();

  if (text.length <= maxLen) return text;
  text = text.slice(0, maxLen);
  const lastNl = text.lastIndexOf('\n');
  return (lastNl > 80 ? text.slice(0, lastNl) : text) + '…';
}

async function fetchData() {
  const hdrs = { Authorization: `Bearer ${KEY}` };
  const [info, pools, apps] = await Promise.all([
    fetch(`${API}/system/info`, { headers: hdrs }).then(r => r.json()),
    fetch(`${API}/pool`,        { headers: hdrs }).then(r => r.json()),
    fetch(`${API}/app`,         { headers: hdrs }).then(r => r.json()).catch(() => []),
  ]);

  const appList = Array.isArray(apps) ? apps : [];

  const releaseMap = {};
  await Promise.all(
    appList
      .filter(a => a.upgrade_available && a.image_updates_available)
      .map(async a => {
        const image = a.active_workloads?.container_details?.[0]?.image;
        if (!image) return;
        const release = await fetchLatestRelease(image);
        if (release) releaseMap[a.id] = release;
      })
  );

  return { info, pools, apps: appList, releaseMap };
}

const LS_KEY = 'truenas:stoppedSince';

function lsLoad() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)).map(([k, v]) => [k, new Date(v)]));
  } catch { return new Map(); }
}

function lsSave(map) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(
      Object.fromEntries([...map].map(([k, v]) => [k, v.toISOString()]))
    ));
  } catch {}
}

export function useTrueNas() {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  const stoppedSince    = useRef(lsLoad());

  useEffect(() => {
    const refresh = () =>
      fetchData()
        .then(d => {
          const now = new Date();
          for (const app of (d.apps ?? [])) {
            if (app.state !== "RUNNING") {
              if (!stoppedSince.current.has(app.name)) {
                stoppedSince.current.set(app.name, now);
              }
            } else {
              stoppedSince.current.delete(app.name);
            }
          }
          lsSave(stoppedSince.current);
          setData({ ...d, stoppedSince: new Map(stoppedSince.current) });
          setErr(null);
        })
        .catch(e => setErr(e?.message ?? "fetch failed"));
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  return { data, err };
}

export function nasIssues(data) {
  if (!Array.isArray(data?.pools)) return [];
  const now = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  const issues = [];

  for (const pool of data.pools) {
    if (pool.status !== "ONLINE") {
      issues.push({
        id: `nas-pool-${pool.name}`,
        severity: "crit",
        label: "pool degraded",
        headline: `${pool.name}: pool status is ${pool.status.toLowerCase()}.`,
        source: `truenas · pool ${pool.name}`,
        when: "now",
        description: `ZFS pool "${pool.name}" is reporting status ${pool.status}. Data may be at risk. Check TrueNAS for failed drives or scrub errors.`,
        logs: [
          { t: now, level: "err", text: `[zfs] pool ${pool.name} status: ${pool.status}` },
        ],
        actions: [{ label: "open truenas ›", href: UI }],
      });
    }

    if (pool.size && pool.allocated / pool.size > 0.9) {
      const pct   = Math.round((pool.allocated / pool.size) * 100);
      const free  = fmtBytes(pool.size - pool.allocated);
      const total = fmtBytes(pool.size);
      issues.push({
        id: `nas-cap-${pool.name}`,
        severity: pct >= 95 ? "crit" : "warn",
        label: "disk space low",
        headline: `${pool.name} is at ${pct}%.`,
        source: `truenas · pool ${pool.name}`,
        when: "now",
        description: `Pool "${pool.name}" is ${pct}% full with ${free} free of ${total}. ZFS performance degrades above 80%; dataset writes may stall above 95%.`,
        logs: [
          { t: now, level: "warn", text: `[zfs] ${pool.name} capacity: ${pct}% (${free} free / ${total})` },
        ],
        actions: [{ label: "open truenas ›", href: UI }],
      });
    }
  }

  for (const app of (data.apps ?? [])) {
    if (app.state === "RUNNING") continue;
    const severity  = app.state === "CRASHED" ? "crit" : "warn";
    const since     = data.stoppedSince?.get(app.name);
    if (STOPPED_HIDE_MINUTES > 0 && since && (Date.now() - since) > STOPPED_HIDE_MINUTES * 60_000) continue;
    const stoppedAt = since
      ? since.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
      : null;
    const duration  = since ? fmtStoppedAgo(since) : null;
    const whenStr   = duration ? `stopped ${duration}` : "now";
    const descExtra = stoppedAt && duration
      ? ` Detected stopped at ${stoppedAt} (${duration}).`
      : "";
    issues.push({
      id: `nas-app-${app.name}`,
      severity,
      label: `app ${app.state?.toLowerCase() ?? "not running"}`,
      headline: `${app.name} is ${app.state?.toLowerCase() ?? "not running"}.`,
      source: `truenas · apps`,
      when: whenStr,
      description: `TrueNAS app "${app.name}" is in state ${app.state}${app.human_version ? ` (version ${app.human_version})` : ""}.${descExtra}`,
      logs: [
        { t: stoppedAt ?? now, level: severity === "crit" ? "err" : "warn", text: `[app] ${app.name}: state=${app.state}` },
      ],
      actions: [{ label: "open truenas apps ›", href: `${UI}/ui/apps/installed` }],
    });
  }

  for (const app of (data.apps ?? []).filter(a => a.upgrade_available)) {
    const image   = app.active_workloads?.container_details?.[0]?.image ?? null;
    const next    = app.latest_version ?? null;
    const isImage = app.image_updates_available && !next;
    const release = data.releaseMap?.[app.id] ?? null;
    const tag     = release?.tag_name ?? null;
    const relDate = fmtReleaseDate(release?.published_at);
    const changelog = trimChangelog(release?.body);

    const headline = next
      ? `${app.name}: update available → ${next}.`
      : tag
        ? `${app.name}: ${tag} is available.`
        : `${app.name}: ${isImage ? "image update available." : "update available."}`;

    const logs = [
      { t: now, level: "info", text: `[app] ${app.name}: upstream image updated` },
      ...(image ? [{ t: now, level: "info", text: `[app] image: ${image}` }] : []),
      ...(tag    ? [{ t: now, level: "info", text: `[app] latest: ${tag}${relDate ? ` · released ${relDate}` : ""}` }] : []),
    ];

    const description = changelog
      ? `New release available for ${app.name}.\n\n${changelog}`
      : next
        ? `${app.name} can be upgraded to ${next}.`
        : `${app.name} has a newer Docker image available.`;

    issues.push({
      id: `nas-app-update-${app.name}`,
      severity: "info",
      label: "app update",
      headline,
      source: "truenas · apps",
      when: relDate ? `released ${relDate}` : "now",
      description,
      logs,
      actions: [
        { label: "open truenas apps ›", href: `${UI}/ui/apps/installed` },
        ...(release?.html_url ? [{ label: "view release ›", href: release.html_url }] : []),
      ],
    });
  }

  return issues;
}

export default function TrueNas({ data, err }) {
  if (err) return (
    <div className="nas-strip rise">
      <span className="nas-item">
        <span className="nas-k">nas</span>
        <span className="nas-v nas-crit">{err}</span>
      </span>
    </div>
  );

  if (!data) return null;

  const { info, pools, apps } = data;
  const appList      = Array.isArray(apps) ? apps : [];
  const runningCount = appList.filter(a => a.state === "RUNNING").length;
  const updateCount  = appList.filter(a => a.upgrade_available).length;
  const hasAppIssue  = appList.some(a => a.state !== "RUNNING");
  const load1    = info?.loadavg?.[0]?.toFixed(2) ?? "—";
  const uptime   = fmtUptime(info?.uptime_seconds);
  const hostname = info?.hostname ?? "nas";

  return (
    <div className="nas-strip rise">
      <div className="nas-left">
        <span className="nas-item">
          <a href={UI} target="_blank" rel="noopener noreferrer" className="nas-link">
            {hostname}
          </a>
        </span>
        <span className="nas-item">
          <span className="nas-k">load</span>
          <span className="nas-v">{load1}</span>
        </span>
        <span className="nas-item">
          <span className="nas-k">up</span>
          <span className="nas-v">{uptime}</span>
        </span>
        {appList.length > 0 && (
          <span className="nas-item">
            <span className="nas-k">apps</span>
            <span className={`nas-v${hasAppIssue ? " nas-warn" : ""}`}>
              {runningCount} / {appList.length}
            </span>
          </span>
        )}
        {updateCount > 0 && (
          <span className="nas-item">
            <span className="nas-k">updates</span>
            <span className="nas-v nas-warn">{updateCount}</span>
          </span>
        )}
      </div>
      <div className="nas-right">
        {(Array.isArray(pools) ? pools : []).map(pool => {
          const ok  = pool.status === "ONLINE";
          const pct = pool.size ? Math.round((pool.allocated / pool.size) * 100) : null;
          const dotCls = !ok ? " crit" : pct >= 90 ? " crit" : pct >= 80 ? " warn" : "";
          const valCls = !ok ? " nas-crit" : pct >= 90 ? " nas-crit" : pct >= 80 ? " nas-warn" : "";
          return (
            <span key={pool.name} className="nas-item" title={`${fmtBytes(pool.allocated)} / ${fmtBytes(pool.size)}`}>
              <span className={`nas-dot${dotCls}`} />
              <span className="nas-k">{pool.name}</span>
              <span className={`nas-v${valCls}`}>
                {pct != null ? `${pct}%` : "—"}
                {!ok && <span className="nas-crit"> · {pool.status.toLowerCase()}</span>}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
