import { describe, it, expect, beforeEach } from 'vitest';
import {
  fmtAge, fmtUptime, fmtBytes, nasIssues,
  POOL_WARN_PCT, POOL_CRIT_PCT, CPU_WARN_C, CPU_CRIT_C,
} from './truenas';

beforeEach(() => localStorage.clear());

// ── base data: healthy NAS, nothing should fire ───────────
const base = {
  pools: [],
  apps: [],
  info: {},
  cpuTemp: null,
  memFree: null,
  arcSize: null,
  stoppedSince: new Map(),
  updateStatus: null,
};

// ── fmtAge ────────────────────────────────────────────────

describe('fmtAge', () => {
  it('0ms → 0m',                   () => expect(fmtAge(0)).toBe('0m'));
  it('59 999ms → 0m',              () => expect(fmtAge(59_999)).toBe('0m'));
  it('60 000ms → 1m',              () => expect(fmtAge(60_000)).toBe('1m'));
  it('3 599 999ms → 59m',          () => expect(fmtAge(3_599_999)).toBe('59m'));
  it('3 600 000ms → 1h',           () => expect(fmtAge(3_600_000)).toBe('1h'));
  it('86 399 999ms → 23h',         () => expect(fmtAge(86_399_999)).toBe('23h'));
  it('86 400 000ms → 1d (no rem)', () => expect(fmtAge(86_400_000)).toBe('1d'));
  it('1d 1h',                      () => expect(fmtAge(86_400_000 + 3_600_000)).toBe('1d 1h'));
  it('2d 12h',                     () => expect(fmtAge(86_400_000 * 2 + 3_600_000 * 12)).toBe('2d 12h'));
});

// ── fmtUptime ─────────────────────────────────────────────

describe('fmtUptime', () => {
  it('null → —',          () => expect(fmtUptime(null)).toBe('—'));
  it('undefined → —',     () => expect(fmtUptime(undefined)).toBe('—'));
  it('0s → 0h 0m',        () => expect(fmtUptime(0)).toBe('0h 0m'));
  it('60s → 0h 1m',       () => expect(fmtUptime(60)).toBe('0h 1m'));
  it('3600s → 1h 0m',     () => expect(fmtUptime(3600)).toBe('1h 0m'));
  it('3661s → 1h 1m',     () => expect(fmtUptime(3661)).toBe('1h 1m'));
  it('86400s → 1d 0h',    () => expect(fmtUptime(86400)).toBe('1d 0h'));
  it('12d 4h',            () => expect(fmtUptime(86400 * 12 + 3600 * 4 + 60 * 22)).toBe('12d 4h'));
});

// ── fmtBytes ──────────────────────────────────────────────

describe('fmtBytes', () => {
  it('null → —',      () => expect(fmtBytes(null)).toBe('—'));
  it('undefined → —', () => expect(fmtBytes(undefined)).toBe('—'));
  it('0 → 0.0 GB',   () => expect(fmtBytes(0)).toBe('0.0 GB'));
  it('1 GiB → 1.0 GB', () => expect(fmtBytes(1024 ** 3)).toBe('1.0 GB'));
  it('1 TiB → 1.0 TB', () => expect(fmtBytes(1024 ** 4)).toBe('1.0 TB'));
  it('10 TiB → 10.0 TB', () => expect(fmtBytes(1024 ** 4 * 10)).toBe('10.0 TB'));
  it('below threshold stays GB', () => expect(fmtBytes(1024 ** 4 * 0.9)).toMatch('GB'));
  it('at threshold switches to TB', () => expect(fmtBytes(1024 ** 4 * 0.95)).toMatch('TB'));
});

// ── nasIssues ─────────────────────────────────────────────

describe('nasIssues', () => {
  it('null → []', () => {
    expect(nasIssues(null)).toEqual([]);
  });

  it('healthy base data → no issues', () => {
    expect(nasIssues(base)).toHaveLength(0);
  });

  it('cpu temp below threshold → no issue', () => {
    const issues = nasIssues({ ...base, cpuTemp: CPU_WARN_C - 1 });
    expect(issues.find(i => i.id === 'nas-cpu-temp')).toBeUndefined();
  });

  it('cpu temp at warn threshold → warn issue', () => {
    const issues = nasIssues({ ...base, cpuTemp: CPU_WARN_C });
    const issue = issues.find(i => i.id === 'nas-cpu-temp');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('warn');
  });

  it('cpu temp at crit threshold → crit issue', () => {
    const issues = nasIssues({ ...base, cpuTemp: CPU_CRIT_C });
    const issue = issues.find(i => i.id === 'nas-cpu-temp');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('crit');
  });

  it('pool DEGRADED → crit issue', () => {
    const data = { ...base, pools: [{ name: 'tank', status: 'DEGRADED', size: 1e12, allocated: 0 }] };
    const issues = nasIssues(data);
    const issue = issues.find(i => i.id === 'nas-pool-tank');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('crit');
  });

  it('pool ONLINE → no pool health issue', () => {
    const data = { ...base, pools: [{ name: 'tank', status: 'ONLINE', size: 1e12, allocated: 0 }] };
    expect(nasIssues(data).find(i => i.id === 'nas-pool-tank')).toBeUndefined();
  });

  it('pool at warn capacity → warn issue', () => {
    const size = 1e12;
    const data = { ...base, pools: [{ name: 'tank', status: 'ONLINE', size, allocated: size * (POOL_WARN_PCT / 100) }] };
    const issue = nasIssues(data).find(i => i.id === 'nas-cap-tank');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('warn');
  });

  it('pool at crit capacity → crit issue', () => {
    const size = 1e12;
    const data = { ...base, pools: [{ name: 'tank', status: 'ONLINE', size, allocated: size * (POOL_CRIT_PCT / 100) }] };
    const issue = nasIssues(data).find(i => i.id === 'nas-cap-tank');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('crit');
  });

  it('pool below warn capacity → no capacity issue', () => {
    const size = 1e12;
    const data = { ...base, pools: [{ name: 'tank', status: 'ONLINE', size, allocated: size * 0.5 }] };
    expect(nasIssues(data).find(i => i.id === 'nas-cap-tank')).toBeUndefined();
  });

  it('stopped app → warn issue', () => {
    const stopped = new Map([['sonarr', new Date(Date.now() - 60_000)]]);
    const data = { ...base, apps: [{ name: 'sonarr', state: 'STOPPED' }], stoppedSince: stopped };
    const issue = nasIssues(data).find(i => i.id === 'nas-app-sonarr');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('warn');
  });

  it('crashed app → crit issue', () => {
    const data = { ...base, apps: [{ name: 'plex', state: 'CRASHED' }], stoppedSince: new Map() };
    const issue = nasIssues(data).find(i => i.id === 'nas-app-plex');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('crit');
  });

  it('running app → no issue', () => {
    const data = { ...base, apps: [{ name: 'plex', state: 'RUNNING' }] };
    expect(nasIssues(data).find(i => i.id === 'nas-app-plex')).toBeUndefined();
  });

  it('missing info/cpuTemp fields → no crash', () => {
    expect(() => nasIssues({ pools: [], apps: [] })).not.toThrow();
  });
});
