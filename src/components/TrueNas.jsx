import { useState, useEffect } from 'react';

const UI   = "https://patronus.vaultrona.com";
const BASE = "https://patronus.vaultrona.com:3443";
const API  = "/truenas/api/v2.0";
const KEY  = import.meta.env.VITE_TRUENAS_KEY ?? "";

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

async function fetchData() {
  const hdrs = { Authorization: `Bearer ${KEY}` };
  const [info, pools, apps] = await Promise.all([
    fetch(`${API}/system/info`, { headers: hdrs }).then(r => r.json()),
    fetch(`${API}/pool`,        { headers: hdrs }).then(r => r.json()),
    fetch(`${API}/app`,         { headers: hdrs }).then(r => r.json()).catch(() => []),
  ]);

  const appList = Array.isArray(apps) ? apps : [];
  const upgradeable = appList.filter(a => a.upgrade_available);
  const summaries = await Promise.all(
    upgradeable.map(a =>
      fetch(`${API}/app/${encodeURIComponent(a.name)}/upgrade_summary`, {
        method: "POST",
        headers: { ...hdrs, "Content-Type": "application/json" },
        body: "{}",
      })
        .then(r => r.json())
        .then(s => [a.name, s])
        .catch(() => [a.name, null])
    )
  );
  const summaryMap = Object.fromEntries(summaries);

  return { info, pools, apps: appList, summaryMap };
}

export function useTrueNas() {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);

  useEffect(() => {
    const refresh = () =>
      fetchData()
        .then(d => { setData(d); setErr(null); })
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
      const pct  = Math.round((pool.allocated / pool.size) * 100);
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
    const severity = app.state === "CRASHED" ? "crit" : "warn";
    issues.push({
      id: `nas-app-${app.name}`,
      severity,
      label: `app ${app.state?.toLowerCase() ?? "not running"}`,
      headline: `${app.name} is ${app.state?.toLowerCase() ?? "not running"}.`,
      source: `truenas · apps`,
      when: "now",
      description: `TrueNAS app "${app.name}" is in state ${app.state}${app.human_version ? ` (version ${app.human_version})` : ""}.`,
      logs: [
        { t: now, level: severity === "crit" ? "err" : "warn", text: `[app] ${app.name}: state=${app.state}` },
      ],
      actions: [{ label: "open truenas apps ›", href: `${UI}/ui/apps/installed` }],
    });
  }

  const updatable = (data.apps ?? []).filter(a => a.upgrade_available);
  if (updatable.length > 0) {
    const names = updatable.map(a => a.name).join(", ");
    issues.push({
      id: "nas-docker-updates",
      severity: "info",
      label: "app updates",
      headline: `${updatable.length} app${updatable.length > 1 ? "s" : ""} ready to update.`,
      source: "truenas · apps",
      when: "now",
      description: `${updatable.length} TrueNAS app${updatable.length > 1 ? "s have" : " has"} upgrades available: ${names}.`,
      logs: updatable.map(a => ({
        t: now,
        level: "info",
        text: `[app] ${a.name}: upgrade available${a.human_version ? ` (current: ${a.human_version})` : ""}`,
      })),
      actions: [{ label: "open truenas apps ›", href: `${UI}/ui/apps/installed` }],
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
  const appList     = Array.isArray(apps) ? apps : [];
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
          return (
            <span key={pool.name} className="nas-item">
              <span className={`nas-dot${ok ? "" : " crit"}`} />
              <span className="nas-k">{pool.name}</span>
              <span className={`nas-v${ok ? "" : " nas-crit"}`}>
                {fmtBytes(pool.allocated)} / {fmtBytes(pool.size)}
                {pct != null ? ` · ${pct}%` : ""}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
