const now = Date.now();

const DEMO_APPS_RUNNING = [
  { name: 'plex',      state: 'RUNNING' },
  { name: 'sonarr',    state: 'RUNNING' },
  { name: 'radarr',    state: 'RUNNING' },
  { name: 'prowlarr',  state: 'RUNNING' },
  { name: 'jellyfin',  state: 'RUNNING' },
  { name: 'overseerr', state: 'RUNNING' },
  { name: 'tautulli',  state: 'RUNNING' },
  { name: 'sabnzbd',   state: 'RUNNING' },
  { name: 'bazarr',    state: 'RUNNING' },
];

const DEMO_INFO_BASE = {
  hostname: 'truenas', cores: 8,
  version: 'TrueNAS-SCALE-25.10.3', physmem: 32 * 1e9,
  uptime_seconds: 86400 * 12 + 3600 * 4 + 60 * 22,
};

export const MOCK_NAS_STAGES = [
  // Stage 0: healthy — quiet night shift
  {
    info:       { ...DEMO_INFO_BASE, loadavg: [0.45, 0.38, 0.32] },
    cpuTemp:    48,
    memFree:    22.4e9,
    arcSize:    6.4e9,
    netStats:   { rx: 4.2  * 1024 * 1024, tx: 1.1 * 1024 * 1024, ifaces: [{ name: 'igb0', rx: 3.9 * 1024 * 1024, tx: 1.0 * 1024 * 1024 }, { name: 'igb1', rx: 0.3 * 1024 * 1024, tx: 0.1 * 1024 * 1024 }] },
    pools: [
      { name: 'tank',   status: 'ONLINE', size: 12*1e12, allocated: 5.0*1e12,  scan: { function: 'SCRUB', state: 'FINISHED', errors: 0, end_time: now - 7 * 86400_000 } },
      { name: 'nvme',   status: 'ONLINE', size:  2*1e12, allocated: 0.6*1e12,  scan: { function: 'SCRUB', state: 'FINISHED', errors: 0, end_time: now - 7 * 86400_000 } },
      { name: 'backup', status: 'ONLINE', size: 16*1e12, allocated: 8.3*1e12,  scan: { function: 'SCRUB', state: 'FINISHED', errors: 0, end_time: now - 7 * 86400_000 } },
    ],
    apps: DEMO_APPS_RUNNING, alerts: [], updateStatus: null, diskTemps: [], stoppedSince: new Map(),
  },
  // Stage 1: advisory — app update, light activity
  {
    info:       { ...DEMO_INFO_BASE, loadavg: [0.62, 0.51, 0.44] },
    cpuTemp:    51,
    memFree:    21.2e9,
    arcSize:    6.6e9,
    netStats:   { rx: 18.7 * 1024 * 1024, tx: 5.3 * 1024 * 1024, ifaces: [{ name: 'igb0', rx: 17.4 * 1024 * 1024, tx: 4.9 * 1024 * 1024 }, { name: 'igb1', rx: 1.3 * 1024 * 1024, tx: 0.4 * 1024 * 1024 }] },
    pools: [
      { name: 'tank',   status: 'ONLINE', size: 12*1e12, allocated: 5.0*1e12,  scan: { function: 'SCRUB', state: 'FINISHED', errors: 0, end_time: now - 7 * 86400_000 } },
      { name: 'nvme',   status: 'ONLINE', size:  2*1e12, allocated: 0.6*1e12,  scan: { function: 'SCRUB', state: 'FINISHED', errors: 0, end_time: now - 7 * 86400_000 } },
      { name: 'backup', status: 'ONLINE', size: 16*1e12, allocated: 8.3*1e12,  scan: { function: 'SCRUB', state: 'FINISHED', errors: 0, end_time: now - 7 * 86400_000 } },
    ],
    apps: DEMO_APPS_RUNNING, alerts: [], updateStatus: null, diskTemps: [], stoppedSince: new Map(),
  },
  // Stage 2: warnings — busier, pools filling, temp climbing
  {
    info:       { ...DEMO_INFO_BASE, loadavg: [1.42, 1.31, 1.18] },
    cpuTemp:    62,
    memFree:    15.8e9,
    arcSize:    7.2e9,
    netStats:   { rx: 48.3 * 1024 * 1024, tx: 11.7 * 1024 * 1024, ifaces: [{ name: 'igb0', rx: 45.1 * 1024 * 1024, tx: 10.9 * 1024 * 1024 }, { name: 'igb1', rx: 3.2 * 1024 * 1024, tx: 0.8 * 1024 * 1024 }] },
    pools: [
      { name: 'tank',   status: 'ONLINE', size: 12*1e12, allocated: 7.8*1e12,  scan: { function: 'SCRUB', state: 'FINISHED', errors: 0, end_time: now - 7 * 86400_000 } }, // 65%
      { name: 'nvme',   status: 'ONLINE', size:  2*1e12, allocated: 0.7*1e12,  scan: { function: 'SCRUB', state: 'FINISHED', errors: 0, end_time: now - 7 * 86400_000 } },
      { name: 'backup', status: 'ONLINE', size: 16*1e12, allocated: 9.6*1e12,  scan: { function: 'SCRUB', state: 'FINISHED', errors: 0, end_time: now - 7 * 86400_000 } }, // 60%
    ],
    apps: DEMO_APPS_RUNNING, alerts: [], updateStatus: null, diskTemps: [], stoppedSince: new Map(),
  },
  // Stage 3: critical — high load, high temp, tanks filling (under threshold to avoid duplicates with ISSUE_FIXTURES)
  {
    info:       { ...DEMO_INFO_BASE, loadavg: [2.84, 2.61, 2.33] },
    cpuTemp:    68, // just under CPU_WARN_C (70) — visually hot, no duplicate issue
    memFree:    12.1e9,
    arcSize:    7.8e9,
    netStats:   { rx: 92.4 * 1024 * 1024, tx: 24.1 * 1024 * 1024, ifaces: [{ name: 'igb0', rx: 87.6 * 1024 * 1024, tx: 22.3 * 1024 * 1024 }, { name: 'igb1', rx: 4.8 * 1024 * 1024, tx: 1.8 * 1024 * 1024 }] },
    pools: [
      { name: 'tank',   status: 'ONLINE', size: 12*1e12, allocated: 9.2*1e12,  scan: { function: 'SCRUB', state: 'FINISHED', errors: 0, end_time: now - 7 * 86400_000 } }, // 77%
      { name: 'nvme',   status: 'ONLINE', size:  2*1e12, allocated: 0.7*1e12,  scan: { function: 'SCRUB', state: 'FINISHED', errors: 0, end_time: now - 7 * 86400_000 } },
      { name: 'backup', status: 'ONLINE', size: 16*1e12, allocated: 11.8*1e12, scan: { function: 'SCRUB', state: 'FINISHED', errors: 0, end_time: now - 7 * 86400_000 } }, // 74%
    ],
    apps: DEMO_APPS_RUNNING, alerts: [], updateStatus: null, diskTemps: [], stoppedSince: new Map(),
  },
];

export const MOCK_NAS_DATA = {
  info: {
    hostname: 'truenas',
    uptime_seconds: 86400 * 12 + 3600 * 4 + 60 * 22,
    loadavg: [1.42, 1.31, 1.18],
    cores: 8,
    version: 'TrueNAS-SCALE-25.10.3',
    physmem: 32 * 1e9,
  },
  pools: [
    {
      name: 'tank', status: 'DEGRADED', size: 12 * 1e12, allocated: 10.1 * 1e12,
      scan: { function: 'SCRUB', state: 'FINISHED', errors: 3, end_time: now - 86400_000, start_time: now - 90000_000 },
    },
    {
      name: 'nvme', status: 'ONLINE', size: 2 * 1e12, allocated: 0.6 * 1e12,
      scan: { function: 'SCRUB', state: 'FINISHED', errors: 0, end_time: now - 7 * 86400_000, start_time: now - 7 * 86400_000 - 1800_000 },
    },
    {
      name: 'backup', status: 'ONLINE', size: 16 * 1e12, allocated: 9.4 * 1e12,
      scan: { function: 'SCRUB', state: 'FINISHED', errors: 0, end_time: now - 45 * 86400_000, start_time: now - 45 * 86400_000 - 7200_000 },
    },
  ],
  apps: [
    { name: 'plex',        state: 'RUNNING' },
    { name: 'sonarr',      state: 'RUNNING' },
    { name: 'radarr',      state: 'RUNNING' },
    { name: 'prowlarr',    state: 'RUNNING' },
    { name: 'jellyfin',    state: 'RUNNING' },
    { name: 'overseerr',   state: 'RUNNING' },
    { name: 'tautulli',    state: 'RUNNING' },
    { name: 'sabnzbd',     state: 'RUNNING' },
    { name: 'bazarr',      state: 'RUNNING' },
    { name: 'unpackerr',   state: 'STOPPED' },
    { name: 'filebrowser', state: 'STOPPED' },
  ],
  alerts: [
    {
      uuid: 'mock-alert-smart-1',
      klass: 'SMARTError',
      level: 'CRITICAL',
      dismissed: false,
      text: 'Drive /dev/sda (WDC_WD4003FZEX-00YCHYA) SMART error count: 5.',
      formatted: 'Drive /dev/sda (WDC_WD4003FZEX) SMART error count: 5.',
      datetime: now - 2 * 3600_000,
      last_occurrence: now - 300_000,
    },
    {
      uuid: 'mock-alert-cert-1',
      klass: 'CertificateExpiringSoon',
      level: 'WARNING',
      dismissed: false,
      text: 'Certificate "local" is expiring in 14 days.',
      formatted: 'Certificate "local" is expiring in 14 days.',
      datetime: now - 86400_000,
      last_occurrence: now - 3600_000,
    },
  ],
  cpuTemp: 54,
  netStats: { rx: 48.3 * 1024 * 1024, tx: 11.7 * 1024 * 1024, ifaces: [{ name: 'igb0', rx: 45.1 * 1024 * 1024, tx: 10.9 * 1024 * 1024 }, { name: 'igb1', rx: 3.2 * 1024 * 1024, tx: 0.8 * 1024 * 1024 }] },
  memFree: 18.2 * 1e9,
  arcSize:  6.4 * 1e9,
  updateStatus: {
    status: {
      new_version: {
        version: '25.10.4',
        manifest: { profile: 'STABLE', date: '2026-04-28' },
        release_notes: null,
      },
    },
    update_download_progress: null,
  },
  stoppedSince: new Map([
    ['unpackerr',   new Date(now - 1000 * 60 * 40)],
    ['filebrowser', new Date(now - 1000 * 60 * 12)],
  ]),
};
