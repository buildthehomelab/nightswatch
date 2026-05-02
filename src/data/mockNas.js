const now = Date.now();

export const MOCK_NAS_DATA = {
  info: {
    hostname: 'patronus',
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
  netStats: { rx: 48.3 * 1024 * 1024, tx: 11.7 * 1024 * 1024 },
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
