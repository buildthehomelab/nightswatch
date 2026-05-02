import { useState, useEffect, useRef } from 'react';
import { MOCK_NAS_DATA } from '../data/mockNas';

export const UI  = import.meta.env.VITE_TRUENAS_URL ?? "";
const API = "/truenas/api/v2.0";
const STOPPED_HIDE_MINUTES = Number(import.meta.env.VITE_STOPPED_APP_HIDE_MINUTES ?? 0) || 0;
export const POOL_WARN_PCT = Number(import.meta.env.VITE_POOL_WARN_PCT ?? 80) || 80;
export const POOL_CRIT_PCT = Number(import.meta.env.VITE_POOL_CRIT_PCT ?? 90) || 90;
export const CPU_WARN_C  = Number(import.meta.env.VITE_CPU_WARN_C  ?? 70) || 70;
export const CPU_CRIT_C  = Number(import.meta.env.VITE_CPU_CRIT_C  ?? 85) || 85;
const DISK_WARN_C        = Number(import.meta.env.VITE_DISK_WARN_C  ?? 45) || 45;
const DISK_CRIT_C        = Number(import.meta.env.VITE_DISK_CRIT_C  ?? 55) || 55;
const MEM_WARN_PCT       = Number(import.meta.env.VITE_MEM_WARN_PCT       ?? 80) || 80;
const MEM_CRIT_PCT       = Number(import.meta.env.VITE_MEM_CRIT_PCT       ?? 90) || 90;
const LOAD_WARN          = Number(import.meta.env.VITE_LOAD_WARN           ?? 4)  || 4;
const LOAD_CRIT          = Number(import.meta.env.VITE_LOAD_CRIT           ?? 8)  || 8;
const SCRUB_STALE_DAYS   = Number(import.meta.env.VITE_SCRUB_STALE_DAYS    ?? 30) || 30;

const RELEASE_TTL        = 4 * 60 * 60 * 1000;
const LS_RELEASE_KEY     = 'truenas:releaseCache';
const AGE_WARN_TO_CRIT_MS = 4 * 60 * 60 * 1000;
const AGE_INFO_TO_WARN_MS = 7 * 24 * 60 * 60 * 1000;

// ── Alert helpers ─────────────────────────────────────────

function parseNasDate(d) {
  if (d == null) return null;
  if (typeof d === 'object' && d.$date != null) return d.$date;
  if (typeof d === 'number') return d < 1e12 ? d * 1000 : d;
  return null;
}

function alertLabel(klass) {
  return klass
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
}

// Klasses we already surface via native pool/app checks
const SKIP_ALERT_KLASSES = new Set([
  'ZpoolStatusWarning', 'ZpoolStatusCritical',
  'ZpoolCapacityWarning', 'ZpoolCapacityError',
  'ScrubFinished', 'ScrubStarted',
  'AppUpdate', 'ApplicationUpdate', 'ApplicationsUpdatesAvailable',
]);

// ── Formatters ────────────────────────────────────────────

export function fmtAge(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

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

export function fmtRate(bps) {
  if (bps == null) return "—";
  if (bps >= 1024 ** 3) return `${(bps / 1024 ** 3).toFixed(1)} GB/s`;
  if (bps >= 1024 ** 2) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`;
  if (bps >= 1024)      return `${Math.round(bps / 1024)} KB/s`;
  return `${Math.round(bps)} B/s`;
}

// ── Release cache (localStorage) ─────────────────────────

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

// ── First-seen tracking (localStorage) ───────────────────

const LS_FIRST_SEEN_KEY = 'truenas:firstSeen';

function lsLoadFirstSeen() {
  try {
    const raw = localStorage.getItem(LS_FIRST_SEEN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function lsMarkFirstSeen(id) {
  const map = lsLoadFirstSeen();
  if (!map[id]) {
    map[id] = Date.now();
    try { localStorage.setItem(LS_FIRST_SEEN_KEY, JSON.stringify(map)); } catch {}
  }
  return map[id];
}

function lsClearFirstSeen(id) {
  const map = lsLoadFirstSeen();
  if (map[id]) {
    delete map[id];
    try { localStorage.setItem(LS_FIRST_SEEN_KEY, JSON.stringify(map)); } catch {}
  }
}

// ── GitHub release fetching ───────────────────────────────

const LINUXSERVER_UPSTREAM = {
  lidarr:      { owner: 'Lidarr',        repo: 'Lidarr' },
  sonarr:      { owner: 'Sonarr',        repo: 'Sonarr' },
  radarr:      { owner: 'Radarr',        repo: 'Radarr' },
  prowlarr:    { owner: 'Prowlarr',      repo: 'Prowlarr' },
  qbittorrent: { owner: 'qbittorrent',   repo: 'qBittorrent' },
  readarr:     { owner: 'Readarr',       repo: 'Readarr' },
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

// ── API fetch helpers ─────────────────────────────────────

async function fetchCpuTemp(hdrs) {
  try {
    const res = await fetch(`${API}/reporting/get_data`, {
      method: 'POST',
      headers: { ...hdrs, 'Content-Type': 'application/json' },
      body: JSON.stringify({ graphs: [{ name: 'cputemp' }] }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!Array.isArray(json) || !json[0]) return null;
    const agg = json[0].aggregations?.mean;
    if (Array.isArray(agg) && agg.length > 0) {
      const valid = agg.filter(v => v != null && !isNaN(v));
      if (valid.length > 0) return Math.round(Math.max(...valid));
    }
    const rows = json[0].data;
    if (Array.isArray(rows) && rows.length > 0) {
      const last = rows[rows.length - 1];
      if (Array.isArray(last)) {
        const vals = last.slice(1).filter(v => v != null && !isNaN(v));
        if (vals.length > 0) return Math.round(Math.max(...vals));
      }
    }
    return null;
  } catch { return null; }
}

function parseDiskId(identifier) {
  const parts = identifier.split(' | ');
  return {
    dev:    parts[0]?.trim() ?? identifier,
    type:   parts[1]?.replace('Type: ', '').trim() ?? null,
    model:  parts[2]?.replace('Model: ', '').trim() ?? null,
    serial: parts[3]?.replace('Serial: ', '').trim() ?? null,
  };
}

async function fetchDiskTemps(hdrs) {
  try {
    const graphsRes = await fetch(`${API}/reporting/graphs`, { headers: hdrs });
    if (!graphsRes.ok) return [];
    const graphs = await graphsRes.json();
    const diskGraph = Array.isArray(graphs) ? graphs.find(g => g.name === 'disktemp') : null;
    if (!diskGraph?.identifiers?.length) return [];

    const res = await fetch(`${API}/reporting/get_data`, {
      method: 'POST',
      headers: { ...hdrs, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graphs: diskGraph.identifiers.map(id => ({ name: 'disktemp', identifier: id })),
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json)) return [];

    return diskGraph.identifiers.map((identifier, i) => {
      const temp = lastVal([json[i]]);
      if (temp == null) return null;
      return { identifier, ...parseDiskId(identifier), temp: Math.round(temp) };
    }).filter(Boolean);
  } catch { return []; }
}

function lastVal(json) {
  if (!Array.isArray(json) || !json[0]) return null;
  const { data, aggregations } = json[0];
  const agg = aggregations?.mean;
  if (Array.isArray(agg) && agg[0] != null) return agg[0];
  if (Array.isArray(data) && data.length > 0) {
    const last = data[data.length - 1];
    if (Array.isArray(last) && last[1] != null) return last[1];
  }
  return null;
}

async function fetchMemStats(hdrs) {
  try {
    const post = (name) => fetch(`${API}/reporting/get_data`, {
      method: 'POST',
      headers: { ...hdrs, 'Content-Type': 'application/json' },
      body: JSON.stringify({ graphs: [{ name }] }),
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    const [memJson, arcJson] = await Promise.all([post('memory'), post('arc_size')]);
    return { memFree: lastVal(memJson), arcSize: lastVal(arcJson) };
  } catch { return { memFree: null, arcSize: null }; }
}

function lastNetVals(entry) {
  if (!entry) return null;
  const { data, aggregations } = entry;
  const agg = aggregations?.mean;
  if (Array.isArray(agg) && agg.length >= 2 && agg[0] != null) return [agg[0], agg[1] ?? 0];
  if (Array.isArray(data) && data.length > 0) {
    const last = data[data.length - 1];
    if (Array.isArray(last) && last.length >= 3) return [last[1] ?? 0, last[2] ?? 0];
  }
  return null;
}

async function fetchNetStats(hdrs) {
  try {
    const graphsRes = await fetch(`${API}/reporting/graphs`, { headers: hdrs });
    if (!graphsRes.ok) return null;
    const graphs = await graphsRes.json();
    const netGraph = Array.isArray(graphs) ? graphs.find(g => g.name === 'interface') : null;
    if (!netGraph?.identifiers?.length) return null;

    const ifaces = netGraph.identifiers.filter(id => id !== 'lo');
    if (!ifaces.length) return null;

    const res = await fetch(`${API}/reporting/get_data`, {
      method: 'POST',
      headers: { ...hdrs, 'Content-Type': 'application/json' },
      body: JSON.stringify({ graphs: ifaces.map(id => ({ name: 'interface', identifier: id })) }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!Array.isArray(json)) return null;

    let rx = 0, tx = 0;
    for (const entry of json) {
      const vals = lastNetVals(entry);
      if (vals) { rx += vals[0]; tx += vals[1]; }
    }
    return { rx, tx };
  } catch { return null; }
}

async function fetchAlerts(hdrs) {
  try {
    const r = await fetch(`${API}/alert/list`, { headers: hdrs });
    if (!r.ok) return [];
    const json = await r.json();
    return Array.isArray(json) ? json : [];
  } catch { return []; }
}

async function fetchUpdateStatus(hdrs) {
  try {
    const r = await fetch(`${API}/update/status`, { headers: hdrs });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

async function fetchData() {
  const hdrs = {};
  const ok = (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };
  const [info, pools, apps, cpuTemp, { memFree, arcSize }, diskTemps, updateStatus, alerts, netStats] = await Promise.all([
    fetch(`${API}/system/info`, { headers: hdrs }).then(ok),
    fetch(`${API}/pool`,        { headers: hdrs }).then(ok),
    fetch(`${API}/app`,         { headers: hdrs }).then(ok).catch(() => []),
    fetchCpuTemp(hdrs),
    fetchMemStats(hdrs),
    fetchDiskTemps(hdrs),
    fetchUpdateStatus(hdrs),
    fetchAlerts(hdrs),
    fetchNetStats(hdrs),
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

  return { info, pools, apps: appList, releaseMap, cpuTemp, memFree, arcSize, diskTemps, updateStatus, alerts, netStats };
}

// ── Stopped-app tracking (localStorage) ──────────────────

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

// ── Hook ──────────────────────────────────────────────────

const DEMO = import.meta.env.DEMO === 'true';

export function useTrueNas(enabled = true) {
  const [data, setData] = useState(DEMO ? MOCK_NAS_DATA : null);
  const [err, setErr]   = useState(null);
  const stoppedSince    = useRef(lsLoad());

  useEffect(() => {
    if (DEMO) {
      if (!enabled) { setData(null); return; }
      const apps = MOCK_NAS_DATA.apps ?? [];
      for (const app of apps) {
        if (app.state !== "RUNNING") {
          if (!stoppedSince.current.has(app.name)) {
            stoppedSince.current.set(app.name, MOCK_NAS_DATA.stoppedSince?.get(app.name) ?? new Date());
          }
        } else {
          stoppedSince.current.delete(app.name);
        }
      }
      lsSave(stoppedSince.current);
      setData({ ...MOCK_NAS_DATA, stoppedSince: new Map(stoppedSince.current) });
      return;
    }
    if (!enabled) { setData(null); setErr(null); return; }
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
  }, [enabled]);

  return { data, err };
}

// ── Issue translation ─────────────────────────────────────

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
  const changesIdx = body.search(/^##?\s+changes/im);
  let text = changesIdx >= 0 ? body.slice(changesIdx) : body;
  text = text
    .replace(/^##?\s*.+$/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\b[0-9a-f]{40}\b\s*/g, '')
    .replace(/\*\s+/g, '\n• ')
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (text.length <= maxLen) return text;
  text = text.slice(0, maxLen);
  const lastNl = text.lastIndexOf('\n');
  return (lastNl > 80 ? text.slice(0, lastNl) : text) + '…';
}

function formatSysReleaseNotes(body, maxLen = 1400) {
  if (!body) return null;
  let text = body
    .replace(/={2,}(.+?)={2,}/g, '[$1]')
    .replace(/^##?\s+(.+)$/gm, '\n$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^\s*-\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length <= maxLen) return text;
  text = text.slice(0, maxLen);
  const lastNl = text.lastIndexOf('\n');
  return (lastNl > 100 ? text.slice(0, lastNl) : text) + '…';
}

export function nasIssues(data) {
  if (!Array.isArray(data?.pools)) return [];
  const issues = [];

  // CPU temperature
  if (data.cpuTemp != null && data.cpuTemp >= CPU_WARN_C) {
    const tempId  = 'nas-cpu-temp';
    const firstTs = lsMarkFirstSeen(tempId);
    const tempAge = Date.now() - firstTs;
    const firstStr = new Date(firstTs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
    issues.push({
      id: tempId,
      severity: data.cpuTemp >= CPU_CRIT_C ? 'crit' : 'warn',
      label: 'cpu hot',
      headline: `CPU temperature is ${data.cpuTemp}°C.`,
      source: 'truenas · system',
      firstSeenTs: firstTs,
      when: tempAge >= 60000 ? `${fmtAge(tempAge)} unresolved` : 'now',
      description: `TrueNAS CPU is at ${data.cpuTemp}°C (warn ≥${CPU_WARN_C}°C, crit ≥${CPU_CRIT_C}°C). Check airflow or fan health.`,
      logs: [
        { t: firstStr, level: data.cpuTemp >= CPU_CRIT_C ? 'err' : 'warn', text: `[thermal] cpu temp: ${data.cpuTemp}°C` },
      ],
      ignoreKey: `nas-cpu-temp:${firstTs}`,
      actions: [{ label: 'open truenas ›', href: UI }],
    });
  } else {
    lsClearFirstSeen('nas-cpu-temp');
  }

  // Disk temperatures
  for (const disk of (data.diskTemps ?? [])) {
    const diskId   = `nas-disk-temp-${disk.dev}`;
    const tempBump = disk.type === 'SSD' ? 10 : 0;
    const warnC    = DISK_WARN_C + tempBump;
    const critC    = DISK_CRIT_C + tempBump;
    if (disk.temp >= warnC) {
      const firstTs  = lsMarkFirstSeen(diskId);
      const diskAge  = Date.now() - firstTs;
      const firstStr = new Date(firstTs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
      const label    = disk.model ? `${disk.dev} · ${disk.model}` : disk.dev;
      issues.push({
        id: diskId,
        severity: disk.temp >= critC ? 'crit' : 'warn',
        label: 'disk hot',
        headline: `${disk.dev} is running at ${disk.temp}°C.`,
        source: `truenas · disk`,
        firstSeenTs: firstTs,
        when: diskAge >= 60000 ? `${fmtAge(diskAge)} unresolved` : 'now',
        description: `${label}${disk.serial ? ` (${disk.serial})` : ''} is at ${disk.temp}°C.\nWarn ≥${warnC}°C, crit ≥${critC}°C. Check airflow or drive health.`,
        logs: [
          { t: firstStr, level: disk.temp >= critC ? 'err' : 'warn', text: `[thermal] ${disk.dev}: ${disk.temp}°C${disk.model ? ` (${disk.model})` : ''}` },
        ],
        ignoreKey: `nas-disk-temp-${disk.dev}:${firstTs}`,
        actions: [{ label: 'open truenas ›', href: UI }],
      });
    } else {
      lsClearFirstSeen(diskId);
    }
  }

  // Memory
  const physmem     = data.info?.physmem ?? null;
  const memFree     = data.memFree ?? null;
  const arcSize     = data.arcSize ?? null;
  const memServices = physmem != null && memFree != null && arcSize != null
    ? Math.max(0, physmem - memFree - arcSize) : null;
  const memPct = memServices != null && physmem
    ? Math.round((memServices / physmem) * 100) : null;
  if (memPct != null && memPct >= MEM_WARN_PCT) {
    const memId   = 'nas-mem';
    const firstTs = lsMarkFirstSeen(memId);
    const memAge  = Date.now() - firstTs;
    const firstStr = new Date(firstTs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
    issues.push({
      id: memId,
      severity: memPct >= MEM_CRIT_PCT ? 'crit' : 'warn',
      label: 'memory high',
      headline: `Memory usage is at ${memPct}%.`,
      source: 'truenas · system',
      firstSeenTs: firstTs,
      when: memAge >= 60000 ? `${fmtAge(memAge)} unresolved` : 'now',
      description: `TrueNAS services are using ${fmtBytes(memServices)} of ${fmtBytes(physmem)} RAM (${memPct}%). ZFS ARC: ${fmtBytes(arcSize)}. Warn ≥${MEM_WARN_PCT}%, crit ≥${MEM_CRIT_PCT}%.`,
      logs: [
        { t: firstStr, level: memPct >= MEM_CRIT_PCT ? 'err' : 'warn', text: `[mem] services: ${fmtBytes(memServices)} · arc: ${fmtBytes(arcSize)} · free: ${fmtBytes(memFree)}` },
      ],
      ignoreKey: `nas-mem:${firstTs}`,
      actions: [{ label: 'open truenas ›', href: UI }],
    });
  } else {
    lsClearFirstSeen('nas-mem');
  }

  // Load average
  const load1 = data.info?.loadavg?.[0] ?? null;
  if (load1 != null && load1 >= LOAD_WARN) {
    const loadId   = 'nas-load';
    const firstTs  = lsMarkFirstSeen(loadId);
    const loadAge  = Date.now() - firstTs;
    const firstStr = new Date(firstTs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
    const load5    = data.info.loadavg[1]?.toFixed(2) ?? '—';
    const load15   = data.info.loadavg[2]?.toFixed(2) ?? '—';
    issues.push({
      id: loadId,
      severity: load1 >= LOAD_CRIT ? 'crit' : 'warn',
      label: 'load high',
      headline: `System load is ${load1.toFixed(2)}.`,
      source: 'truenas · system',
      firstSeenTs: firstTs,
      when: loadAge >= 60000 ? `${fmtAge(loadAge)} unresolved` : 'now',
      description: `1-min load average is ${load1.toFixed(2)} (warn ≥${LOAD_WARN}, crit ≥${LOAD_CRIT}).\n5m: ${load5}  15m: ${load15}`,
      logs: [
        { t: firstStr, level: load1 >= LOAD_CRIT ? 'err' : 'warn', text: `[load] 1m=${load1.toFixed(2)} 5m=${load5} 15m=${load15}` },
      ],
      ignoreKey: `nas-load:${firstTs}`,
      actions: [{ label: 'open truenas ›', href: UI }],
    });
  } else {
    lsClearFirstSeen('nas-load');
  }

  // System update
  const newVer = data.updateStatus?.status?.new_version;
  if (newVer?.version) {
    const updateId  = 'nas-sys-update';
    const firstTs   = lsMarkFirstSeen(updateId);
    const updateAge = Date.now() - firstTs;
    const firstStr  = new Date(firstTs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
    const profile   = newVer.manifest?.profile ?? newVer.manifest?.train ?? "";
    const isBeta    = /EARLY|BETA/i.test(profile) || /BETA/i.test(newVer.version);
    const relDate   = fmtReleaseDate(newVer.manifest?.date);
    const changelog = formatSysReleaseNotes(newVer.release_notes);
    const downloaded = data.updateStatus?.update_download_progress?.percent === 100;
    const description = (changelog ? `${changelog}\n\n` : "")
      + (downloaded ? "Update already downloaded — ready to install." : "");
    issues.push({
      id: updateId,
      severity: isBeta ? "warn" : "info",
      label: "system update",
      headline: `TrueNAS update available: ${newVer.version}.`,
      source: "truenas · system",
      firstSeenTs: firstTs,
      when: updateAge >= 60000 ? `${fmtAge(updateAge)} unresolved` : relDate ? `released ${relDate}` : firstStr,
      description: description || `TrueNAS ${newVer.version} is available.`,
      logs: [
        { t: firstStr, level: isBeta ? "warn" : "info", text: `[update] ${newVer.version} available (${profile || "general"})` },
        ...(downloaded ? [{ t: firstStr, level: "info", text: "[update] download complete — ready to install" }] : []),
      ],
      ignoreKey: `nas-sys-update:${newVer.version}`,
      actions: [
        { label: "open truenas ›", href: `${UI}/ui/system/update` },
      ],
    });
  } else {
    lsClearFirstSeen('nas-sys-update');
  }

  // Pool health + capacity
  for (const pool of data.pools) {
    if (pool.status !== "ONLINE") {
      const poolId  = `nas-pool-${pool.name}`;
      const poolTs  = lsMarkFirstSeen(poolId);
      const poolAge = Date.now() - poolTs;
      const poolStr = new Date(poolTs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
      issues.push({
        id: poolId,
        severity: "crit",
        label: "pool degraded",
        headline: `${pool.name}: pool status is ${pool.status.toLowerCase()}.`,
        source: `truenas · pool ${pool.name}`,
        firstSeenTs: poolTs,
        when: poolAge >= 60000 ? `${fmtAge(poolAge)} unresolved` : "now",
        description: `ZFS pool "${pool.name}" is reporting status ${pool.status}. Data may be at risk. Check TrueNAS for failed drives or scrub errors.`,
        logs: [
          { t: poolStr, level: "err", text: `[zfs] pool ${pool.name} status: ${pool.status}` },
        ],
        ignoreKey: `nas-pool-${pool.name}:${poolTs}`,
        actions: [{ label: "open truenas ›", href: UI }],
      });
    } else {
      lsClearFirstSeen(`nas-pool-${pool.name}`);
    }

    if (pool.size && pool.allocated / pool.size * 100 >= POOL_WARN_PCT) {
      const pct      = Math.round((pool.allocated / pool.size) * 100);
      const free     = fmtBytes(pool.size - pool.allocated);
      const total    = fmtBytes(pool.size);
      const capId    = `nas-cap-${pool.name}`;
      const firstTs  = lsMarkFirstSeen(capId);
      const firstDt  = new Date(firstTs);
      const capAge   = Date.now() - firstTs;
      const capStale = capAge >= AGE_WARN_TO_CRIT_MS;
      const whenStr  = capStale
        ? `${fmtAge(capAge)} unresolved`
        : firstDt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
      issues.push({
        id: capId,
        severity: pct >= POOL_CRIT_PCT || capStale ? "crit" : "warn",
        label: "disk space low",
        headline: `${pool.name} is at ${pct}%.`,
        source: `truenas · pool ${pool.name}`,
        firstSeenTs: firstTs,
        when: whenStr,
        description: `${pool.name} is ${pct}% full with ${free} free of ${total}.\nZFS performance degrades above 80%; dataset writes may stall above 95%.`,
        logs: [
          { t: whenStr, level: "warn", text: `[zfs] ${pool.name} capacity: ${pct}% (${free} free / ${total})` },
        ],
        ignoreKey: `nas-cap-${pool.name}:${firstTs}`,
        actions: [{ label: "open truenas ›", href: UI }],
      });
    } else {
      lsClearFirstSeen(`nas-cap-${pool.name}`);
    }

    // Scrub errors / overdue
    const scan = pool.scan;
    const scrubId = `nas-scrub-${pool.name}`;
    const scrubStaleId = `nas-scrub-stale-${pool.name}`;
    if (scan && (scan.errors ?? 0) > 0) {
      lsClearFirstSeen(scrubStaleId);
      const firstTs  = lsMarkFirstSeen(scrubId);
      const scrubAge = Date.now() - firstTs;
      const firstStr = new Date(firstTs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
      const endMs    = parseNasDate(scan.end_time);
      const endStr   = endMs ? new Date(endMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
      issues.push({
        id: scrubId,
        severity: 'warn',
        label: 'scrub errors',
        headline: `${pool.name}: scrub found ${scan.errors} error${scan.errors !== 1 ? 's' : ''}.`,
        source: `truenas · pool ${pool.name}`,
        firstSeenTs: firstTs,
        when: scrubAge >= 60000 ? `${fmtAge(scrubAge)} unresolved` : endStr ? `scrub ${endStr}` : firstStr,
        description: `ZFS scrub on "${pool.name}" completed with ${scan.errors} error${scan.errors !== 1 ? 's' : ''}${endStr ? ` on ${endStr}` : ''}. ZFS corrected what it could; drive hardware should be inspected.`,
        logs: [
          { t: firstStr, level: 'warn', text: `[zfs] scrub ${pool.name}: ${scan.errors} error${scan.errors !== 1 ? 's' : ''} found` },
        ],
        ignoreKey: `nas-scrub-${pool.name}:${endMs ?? firstTs}`,
        actions: [{ label: 'open truenas ›', href: UI }],
      });
    } else {
      lsClearFirstSeen(scrubId);
      const endMs      = parseNasDate(scan?.end_time);
      const staleMs    = SCRUB_STALE_DAYS * 86400_000;
      const isOverdue  = !endMs || (Date.now() - endMs) > staleMs;
      if (isOverdue) {
        const firstTs  = lsMarkFirstSeen(scrubStaleId);
        const scrubAge = Date.now() - firstTs;
        const lastStr  = endMs
          ? `${Math.floor((Date.now() - endMs) / 86400_000)}d ago`
          : 'never';
        issues.push({
          id: scrubStaleId,
          severity: 'info',
          label: 'scrub overdue',
          headline: `${pool.name}: last scrub ${lastStr}.`,
          source: `truenas · pool ${pool.name}`,
          firstSeenTs: firstTs,
          when: scrubAge >= 60000 ? `${fmtAge(scrubAge)} unresolved` : lastStr,
          description: `Pool "${pool.name}" has not been scrubbed in over ${SCRUB_STALE_DAYS} days (last: ${lastStr}). Regular scrubs detect silent data corruption.`,
          logs: [
            { t: new Date(firstTs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }), level: 'info', text: `[zfs] scrub ${pool.name}: last=${lastStr}` },
          ],
          ignoreKey: `nas-scrub-stale-${pool.name}:${endMs ?? 0}`,
          actions: [{ label: 'open truenas ›', href: UI }],
        });
      } else {
        lsClearFirstSeen(scrubStaleId);
      }
    }
  }

  // App state
  for (const app of (data.apps ?? [])) {
    if (app.state === "RUNNING") {
      lsClearFirstSeen(`nas-app-${app.name}`);
      continue;
    }
    const since     = data.stoppedSince?.get(app.name);
    if (STOPPED_HIDE_MINUTES > 0 && since && (Date.now() - since) > STOPPED_HIDE_MINUTES * 60_000) continue;
    const appAge    = since ? Date.now() - since : 0;
    const appStale  = appAge >= AGE_WARN_TO_CRIT_MS;
    const severity  = app.state === "CRASHED" || appStale ? "crit" : "warn";
    const stoppedAt = since
      ? since.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
      : null;
    const duration  = since ? fmtStoppedAgo(since) : null;
    const whenStr   = appStale ? `${fmtAge(appAge)} unresolved` : duration ? `stopped ${duration}` : "now";
    const descExtra = stoppedAt && duration
      ? ` Detected stopped at ${stoppedAt} (${duration}).`
      : "";
    issues.push({
      id: `nas-app-${app.name}`,
      severity,
      label: `app ${app.state?.toLowerCase() ?? "not running"}`,
      headline: `${app.name} is ${app.state?.toLowerCase() ?? "not running"}.`,
      source: `truenas · apps`,
      firstSeenTs: since ? since.getTime() : null,
      when: whenStr,
      description: `TrueNAS app "${app.name}" is in state ${app.state}${app.human_version ? ` (version ${app.human_version})` : ""}.${descExtra}`,
      logs: [
        { t: stoppedAt ?? "—", level: severity === "crit" ? "err" : "warn", text: `[app] ${app.name}: state=${app.state}` },
      ],
      ignoreKey: `nas-app-${app.name}:${since?.getTime() ?? 0}`,
      actions: [{ label: "open truenas apps ›", href: `${UI}/ui/apps/installed` }],
    });
  }

  // App updates
  for (const app of (data.apps ?? []).filter(a => !a.upgrade_available)) {
    lsClearFirstSeen(`nas-app-update-${app.name}`);
  }

  for (const app of (data.apps ?? []).filter(a => a.upgrade_available)) {
    const image   = app.active_workloads?.container_details?.[0]?.image ?? null;
    const next    = app.latest_version ?? null;
    const isImage = app.image_updates_available && !next;
    const release = data.releaseMap?.[app.id] ?? null;
    const tag     = release?.tag_name ?? null;
    const relDate = fmtReleaseDate(release?.published_at);
    const changelog = trimChangelog(release?.body);
    const updateId  = `nas-app-update-${app.name}`;
    const firstTs   = lsMarkFirstSeen(updateId);
    const firstDt   = new Date(firstTs);
    const firstStr  = firstDt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
    const updateAge = Date.now() - firstTs;
    const updateStale = updateAge >= AGE_INFO_TO_WARN_MS;

    const headline = next
      ? `${app.name}: update available → ${next}.`
      : tag
        ? `${app.name}: ${tag} is available.`
        : `${app.name}: ${isImage ? "image update available." : "update available."}`;

    const logs = [
      { t: firstStr, level: "info", text: `[app] ${app.name}: upstream image updated` },
      ...(image ? [{ t: firstStr, level: "info", text: `[app] image: ${image}` }] : []),
      ...(tag    ? [{ t: firstStr, level: "info", text: `[app] latest: ${tag}${relDate ? ` · released ${relDate}` : ""}` }] : []),
    ];

    const description = changelog
      ? `New release available for ${app.name}.\n\n${changelog}`
      : next
        ? `${app.name} can be upgraded to ${next}.`
        : `${app.name} has a newer Docker image available.`;

    issues.push({
      id: updateId,
      severity: updateStale ? "warn" : "info",
      label: "app update",
      headline,
      source: "truenas · apps",
      firstSeenTs: firstTs,
      when: updateStale ? `${fmtAge(updateAge)} unresolved` : relDate ? `released ${relDate}` : firstStr,
      description,
      logs,
      ignoreKey: `nas-app-update:${app.name}:${tag ?? next ?? 'unknown'}`,
      actions: [
        { label: "open truenas apps ›", href: `${UI}/ui/apps/installed` },
        ...(release?.html_url ? [{ label: "view release ›", href: release.html_url }] : []),
      ],
    });
  }

  // Native TrueNAS alerts (SMART, replication, certs, fan, etc.)
  for (const alert of (data.alerts ?? [])) {
    if (alert.dismissed) continue;
    if (SKIP_ALERT_KLASSES.has(alert.klass)) continue;
    const firstMs  = parseNasDate(alert.datetime) ?? Date.now();
    const alertAge = Date.now() - firstMs;
    const firstStr = new Date(firstMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
    const severity = alert.level === 'CRITICAL' ? 'crit' : alert.level === 'WARNING' ? 'warn' : 'info';
    const body     = (alert.formatted ?? alert.text ?? '').trim();
    const headline = body.split('\n')[0].slice(0, 120);
    issues.push({
      id: `nas-alert-${alert.uuid}`,
      severity,
      label: alertLabel(alert.klass),
      headline,
      source: 'truenas · alerts',
      firstSeenTs: firstMs,
      when: alertAge >= 60000 ? `${fmtAge(alertAge)} unresolved` : 'now',
      description: body,
      logs: [
        { t: firstStr, level: severity === 'crit' ? 'err' : severity, text: `[alert:${alert.klass}] ${alert.text ?? ''}` },
      ],
      ignoreKey: `nas-alert:${alert.uuid}`,
      actions: [{ label: 'open truenas ›', href: UI }],
    });
  }

  return issues;
}
