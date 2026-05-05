import { useState, useEffect, useRef } from 'react';
import { MOCK_DOCKER_DATA } from '../data/mockDocker';
import { DEMO as _DEMO, DOCKER_UI_URL, DOCKER_RESTART_WARN } from '../nwenv';
import { fmtAge } from './truenas';

const DEMO = _DEMO;
const DOCKER_API = '/docker';
const POLL_INTERVAL = 30_000;
const AGE_WARN_TO_CRIT_MS = 4 * 60 * 60 * 1000;

const LS_FIRST_SEEN_KEY = 'docker:firstSeen';
const LS_STOPPED_KEY    = 'docker:stoppedSince';

export const UI = DOCKER_UI_URL ?? '';

// ── localStorage ──────────────────────────────────────────

function lsLoadFirstSeen() {
  try { return JSON.parse(localStorage.getItem(LS_FIRST_SEEN_KEY) ?? '{}'); }
  catch { return {}; }
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

function lsLoadStopped() {
  try {
    const raw = localStorage.getItem(LS_STOPPED_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)).map(([k, v]) => [k, new Date(v)]));
  } catch { return new Map(); }
}

function lsSaveStopped(map) {
  try {
    localStorage.setItem(LS_STOPPED_KEY, JSON.stringify(
      Object.fromEntries([...map].map(([k, v]) => [k, v.toISOString()]))
    ));
  } catch {}
}

// ── Parsers ───────────────────────────────────────────────

export function containerName(c) {
  return (c.Names?.[0] ?? '').replace(/^\//, '') || c.Id?.slice(0, 12) || 'unknown';
}

function parseHealth(status) {
  if (/unhealthy/i.test(status)) return 'unhealthy';
  if (/\(healthy\)/i.test(status)) return 'healthy';
  if (/health: starting/i.test(status)) return 'starting';
  return null;
}

function parseExitCode(status) {
  const m = (status ?? '').match(/Exited \((\d+)\)/i);
  return m ? Number(m[1]) : null;
}

// ── Fetch ─────────────────────────────────────────────────

async function fetchDockerData() {
  const [containersRes, infoRes] = await Promise.all([
    fetch(`${DOCKER_API}/containers/json?all=true`),
    fetch(`${DOCKER_API}/info`),
  ]);
  if (!containersRes.ok) throw new Error(`HTTP ${containersRes.status}`);
  const containers = await containersRes.json();
  const info = infoRes.ok ? await infoRes.json() : null;
  return { containers: Array.isArray(containers) ? containers : [], info };
}

// ── Hook ──────────────────────────────────────────────────

export function useDocker(enabled = false) {
  const [data, setData] = useState(DEMO ? MOCK_DOCKER_DATA : null);
  const [err, setErr]   = useState(null);
  const stoppedSince    = useRef(lsLoadStopped());

  useEffect(() => {
    if (DEMO) {
      if (!enabled) { setData(null); return; }
      setData(MOCK_DOCKER_DATA);
      return;
    }
    if (!enabled) { setData(null); setErr(null); return; }

    const refresh = () =>
      fetchDockerData()
        .then(d => {
          const now = new Date();
          for (const c of d.containers) {
            const name = containerName(c);
            if (c.State !== 'running' && c.State !== 'restarting') {
              if (!stoppedSince.current.has(name)) {
                stoppedSince.current.set(name, now);
              }
            } else {
              stoppedSince.current.delete(name);
            }
          }
          lsSaveStopped(stoppedSince.current);
          setData({ ...d, stoppedSince: new Map(stoppedSince.current) });
          setErr(null);
        })
        .catch(e => setErr(e?.message ?? 'fetch failed'));

    refresh();
    const id = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [enabled]);

  return { data, err };
}

// ── Issue translation ─────────────────────────────────────

export function dockerIssues(data) {
  if (!Array.isArray(data?.containers)) return [];
  const issues = [];

  for (const c of data.containers) {
    const name    = containerName(c);
    const state   = c.State;
    const status  = c.Status ?? '';
    const restart = c.HostConfig?.RestartPolicy?.Name ?? 'no';
    const rcount  = c.RestartCount ?? 0;
    const health  = parseHealth(status);
    const exit    = state === 'exited' ? parseExitCode(status) : null;

    const isUnhealthy    = state === 'running' && health === 'unhealthy';
    const isExitedBad    = state === 'exited' && exit != null && exit !== 0;
    const isCrashLooping = state === 'restarting';
    const isCleanStop    = state === 'exited' && exit === 0 && restart !== 'no';
    const isHighRestarts = state === 'running' && rcount >= DOCKER_RESTART_WARN;

    // 1. running + unhealthy health check → crit immediately
    if (isUnhealthy) {
      const id      = `docker-unhealthy-${name}`;
      const firstTs = lsMarkFirstSeen(id);
      const age     = Date.now() - firstTs;
      const firstStr = new Date(firstTs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
      issues.push({
        id,
        severity: 'crit',
        label: 'container unhealthy',
        headline: `${name}: health check is failing.`,
        source: 'docker · containers',
        firstSeenTs: firstTs,
        when: age >= 60000 ? `${fmtAge(age)} unresolved` : 'now',
        description: `Container "${name}" is running but its health check is reporting unhealthy.\nImage: ${c.Image ?? 'unknown'}\nStatus: ${status}`,
        logs: [
          { t: firstStr, level: 'err', text: `[docker] ${name}: health=unhealthy (${status})` },
        ],
        ignoreKey: `docker-unhealthy:${name}:${firstTs}`,
        actions: [...(UI ? [{ label: 'open portainer ›', href: UI }] : [])],
      });
    } else {
      lsClearFirstSeen(`docker-unhealthy-${name}`);
    }

    // 2. exited with non-zero exit code → crit immediately
    if (isExitedBad) {
      const exitLabel = exit === 137 ? 'OOM kill' : exit === 139 ? 'segfault' : `exit ${exit}`;
      const headline  = exit === 137
        ? `${name}: killed by OOM killer.`
        : exit === 139
          ? `${name}: crashed with segfault.`
          : `${name}: exited with code ${exit}.`;
      const id      = `docker-exited-${name}`;
      const firstTs = lsMarkFirstSeen(id);
      const age     = Date.now() - firstTs;
      const firstStr = new Date(firstTs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
      issues.push({
        id,
        severity: 'crit',
        label: exitLabel,
        headline,
        source: 'docker · containers',
        firstSeenTs: firstTs,
        when: age >= 60000 ? `${fmtAge(age)} unresolved` : 'now',
        description: `Container "${name}" exited with code ${exit} (${exitLabel}).\nImage: ${c.Image ?? 'unknown'}\nStatus: ${status}${restart !== 'no' ? `\nRestart policy: ${restart}` : ''}`,
        logs: [
          { t: firstStr, level: 'err', text: `[docker] ${name}: exited code=${exit} (${exitLabel})` },
        ],
        ignoreKey: `docker-exited:${name}:${firstTs}`,
        actions: [...(UI ? [{ label: 'open portainer ›', href: UI }] : [])],
      });
    } else {
      lsClearFirstSeen(`docker-exited-${name}`);
    }

    // 3. restarting (active crashloop) → crit immediately
    if (isCrashLooping) {
      const id      = `docker-restarting-${name}`;
      const firstTs = lsMarkFirstSeen(id);
      const age     = Date.now() - firstTs;
      const firstStr = new Date(firstTs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
      issues.push({
        id,
        severity: 'crit',
        label: 'crashlooping',
        headline: `${name}: container is crashlooping.`,
        source: 'docker · containers',
        firstSeenTs: firstTs,
        when: age >= 60000 ? `${fmtAge(age)} unresolved` : 'now',
        description: `Container "${name}" is in a restart loop (${rcount} restart${rcount !== 1 ? 's' : ''}).\nImage: ${c.Image ?? 'unknown'}\nStatus: ${status}`,
        logs: [
          { t: firstStr, level: 'err', text: `[docker] ${name}: state=restarting restarts=${rcount}` },
        ],
        ignoreKey: `docker-restarting:${name}:${firstTs}`,
        actions: [...(UI ? [{ label: 'open portainer ›', href: UI }] : [])],
      });
    } else {
      lsClearFirstSeen(`docker-restarting-${name}`);
    }

    // 4. exited, exit code 0, policy ≠ "no" → warn → crit at 4h
    if (isCleanStop) {
      const since   = data.stoppedSince?.get(name);
      const id      = `docker-stopped-${name}`;
      const firstTs = since ? since.getTime() : lsMarkFirstSeen(id);
      const age     = since ? Date.now() - since.getTime() : Date.now() - firstTs;
      const stale   = age >= AGE_WARN_TO_CRIT_MS;
      const firstStr = new Date(firstTs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
      issues.push({
        id,
        severity: stale ? 'crit' : 'warn',
        label: 'container stopped',
        headline: `${name}: stopped unexpectedly.`,
        source: 'docker · containers',
        firstSeenTs: firstTs,
        when: stale ? `${fmtAge(age)} unresolved` : age >= 60000 ? `stopped ${fmtAge(age)} ago` : 'just now',
        description: `Container "${name}" exited cleanly (code 0) but has restart policy "${restart}" — it should be running.\nImage: ${c.Image ?? 'unknown'}\nStatus: ${status}`,
        logs: [
          { t: firstStr, level: stale ? 'err' : 'warn', text: `[docker] ${name}: exited code=0 policy=${restart}` },
        ],
        ignoreKey: `docker-stopped:${name}:${firstTs}`,
        actions: [...(UI ? [{ label: 'open portainer ›', href: UI }] : [])],
      });
    } else {
      lsClearFirstSeen(`docker-stopped-${name}`);
    }

    // 5. running + restartCount >= threshold → warn → crit at 4h
    if (isHighRestarts) {
      const id      = `docker-restarts-${name}`;
      const firstTs = lsMarkFirstSeen(id);
      const age     = Date.now() - firstTs;
      const stale   = age >= AGE_WARN_TO_CRIT_MS;
      const firstStr = new Date(firstTs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
      issues.push({
        id,
        severity: stale ? 'crit' : 'warn',
        label: 'high restarts',
        headline: `${name}: ${rcount} restart${rcount !== 1 ? 's' : ''} since start.`,
        source: 'docker · containers',
        firstSeenTs: firstTs,
        when: stale ? `${fmtAge(age)} unresolved` : age >= 60000 ? `${fmtAge(age)} unresolved` : 'now',
        description: `Container "${name}" has restarted ${rcount} times (threshold: ${DOCKER_RESTART_WARN}).\nImage: ${c.Image ?? 'unknown'}\nStatus: ${status}`,
        logs: [
          { t: firstStr, level: stale ? 'err' : 'warn', text: `[docker] ${name}: restartCount=${rcount} (threshold=${DOCKER_RESTART_WARN})` },
        ],
        ignoreKey: `docker-restarts:${name}:${firstTs}`,
        actions: [...(UI ? [{ label: 'open portainer ›', href: UI }] : [])],
      });
    } else {
      lsClearFirstSeen(`docker-restarts-${name}`);
    }
  }

  return issues;
}
