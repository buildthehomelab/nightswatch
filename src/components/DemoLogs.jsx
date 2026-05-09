import { useState, useEffect, useRef } from 'react';

const LOG_POOL = [
  { c: 'plex',          lvl: 'INFO',  msg: 'Transcoding session started — video/h264 → video/h264 for user bob' },
  { c: 'plex',          lvl: 'INFO',  msg: 'Starting playback of "The Bear S03E01"' },
  { c: 'plex',          lvl: 'INFO',  msg: 'Playback session ended, duration 00:42:11' },
  { c: 'plex',          lvl: 'INFO',  msg: 'Library scan complete: 3 new items found' },
  { c: 'plex',          lvl: 'WARN',  msg: 'Buffering detected — client bandwidth: 3.2 Mbps' },
  { c: 'plex',          lvl: 'INFO',  msg: 'Direct stream: client supports h264 level 4.1' },
  { c: 'sonarr',        lvl: 'INFO',  msg: 'RSS sync complete — 4 new releases indexed' },
  { c: 'sonarr',        lvl: 'INFO',  msg: 'Grabbed "The.Bear.S03E01.1080p.BluRay.x264" from Jackett' },
  { c: 'sonarr',        lvl: 'INFO',  msg: 'Import triggered for episode S03E01' },
  { c: 'sonarr',        lvl: 'WARN',  msg: 'Indexer "NZBGeek" returned 0 results — may be rate limited' },
  { c: 'sonarr',        lvl: 'INFO',  msg: 'File moved to /media/tv/The Bear/Season 03/' },
  { c: 'radarr',        lvl: 'INFO',  msg: 'Refreshing movie list from TMDB' },
  { c: 'radarr',        lvl: 'INFO',  msg: 'Quality upgrade found: "Dune Part Two" — 2160p Remux available' },
  { c: 'radarr',        lvl: 'INFO',  msg: 'Download client qBittorrent responded in 42ms' },
  { c: 'radarr',        lvl: 'WARN',  msg: '"Inside Out 2" not found in any configured indexers' },
  { c: 'caddy',         lvl: 'INFO',  msg: '192.168.1.45 GET /api/v1/health 200 0ms' },
  { c: 'caddy',         lvl: 'INFO',  msg: 'TLS certificate renewed for *.homelab.local' },
  { c: 'caddy',         lvl: 'INFO',  msg: '192.168.1.45 POST /jellyfin/Sessions/Playing 200 3ms' },
  { c: 'caddy',         lvl: 'WARN',  msg: 'Upstream "nextcloud" health check failed — retrying (1/3)' },
  { c: 'caddy',         lvl: 'INFO',  msg: 'Upstream "nextcloud" recovered after 1 retry' },
  { c: 'homeassistant', lvl: 'INFO',  msg: 'State changed: light.living_room → on (brightness: 80%)' },
  { c: 'homeassistant', lvl: 'INFO',  msg: 'Automation "Sunrise dim" triggered' },
  { c: 'homeassistant', lvl: 'INFO',  msg: 'Recorder: database backup complete (247 MB)' },
  { c: 'homeassistant', lvl: 'WARN',  msg: 'Integration "zwave" — node 14 not responding' },
  { c: 'homeassistant', lvl: 'INFO',  msg: 'Webhook received — toggling scene "movie mode"' },
  { c: 'nextcloud',     lvl: 'INFO',  msg: 'User "bob" logged in from 192.168.1.201' },
  { c: 'nextcloud',     lvl: 'INFO',  msg: 'Cron: processed 12 background jobs in 0.34s' },
  { c: 'nextcloud',     lvl: 'INFO',  msg: 'File sync: 3 files uploaded by bob' },
  { c: 'nextcloud',     lvl: 'ERROR', msg: 'Background job CalDAV sync failed: timeout after 30s' },
  { c: 'nextcloud',     lvl: 'INFO',  msg: 'Thumbnail generation complete for /Photos/2026-05/' },
];

const LVL_COLOR = { INFO: 'var(--ok)', WARN: 'var(--warn)', ERROR: 'var(--crit)' };

function ts() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

export default function DemoLogs() {
  const [lines, setLines] = useState(() =>
    Array.from({ length: 22 }, (_, i) => ({
      id: i,
      ts: ts(),
      ...LOG_POOL[Math.floor(Math.random() * LOG_POOL.length)],
    }))
  );
  const bottomRef = useRef(null);
  const counterRef = useRef(22);

  useEffect(() => {
    let timeout;
    function tick() {
      setLines(prev => [
        ...prev.slice(-100),
        { id: counterRef.current++, ts: ts(), ...LOG_POOL[Math.floor(Math.random() * LOG_POOL.length)] },
      ]);
      timeout = setTimeout(tick, 400 + Math.random() * 800);
    }
    timeout = setTimeout(tick, 400 + Math.random() * 800);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '16px 48px',
      fontFamily: 'var(--mono)',
      fontSize: 12,
      lineHeight: 1.65,
      background: 'var(--paper-2)',
    }}>
      {lines.map(l => (
        <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', minWidth: 0 }}>
          <span style={{ color: 'var(--ink-3)', flexShrink: 0, fontSize: 12 }}>{l.ts}</span>
          <span style={{ color: 'var(--ink-3)', flexShrink: 0, minWidth: 78, textAlign: 'right' }}>{l.c}</span>
          <span style={{ color: LVL_COLOR[l.lvl], flexShrink: 0, minWidth: 36, fontSize: 12 }}>{l.lvl}</span>
          <span style={{ color: 'var(--ink-2)' }}>{l.msg}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
