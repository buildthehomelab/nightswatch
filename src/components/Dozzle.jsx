import { useState, useEffect, useRef, useMemo } from 'react';

const DEMO = import.meta.env.DEMO === 'true';
const DOZZLE_BASE = import.meta.env.VITE_DOZZLE_URL ?? "";

const DOZZLE_CONTAINERS = [
  { id: "sonarr",       name: "sonarr",       group: "media",     status: "ok"   },
  { id: "radarr",       name: "radarr",       group: "media",     status: "ok"   },
  { id: "prowlarr",     name: "prowlarr",     group: "media",     status: "ok"   },
  { id: "bazarr",       name: "bazarr",       group: "media",     status: "ok"   },
  { id: "jellyfin",     name: "jellyfin",     group: "media",     status: "warn" },
  { id: "jellyseerr",   name: "jellyseerr",   group: "media",     status: "ok"   },
  { id: "qbittorrent",  name: "qbittorrent",  group: "downloads", status: "ok"   },
  { id: "gluetun",      name: "gluetun",      group: "downloads", status: "ok"   },
  { id: "pihole",       name: "pihole",       group: "network",   status: "ok"   },
  { id: "unbound",      name: "unbound",      group: "network",   status: "ok"   },
  { id: "nginx",        name: "nginx-proxy",  group: "network",   status: "warn" },
  { id: "tailscale",    name: "tailscale",    group: "network",   status: "ok"   },
  { id: "homarr",       name: "homarr",       group: "tools",     status: "ok"   },
  { id: "watchtower",   name: "watchtower",   group: "tools",     status: "ok"   },
  { id: "uptime-kuma",  name: "uptime-kuma",  group: "tools",     status: "off"  },
];

const LOG_TEMPLATES = {
  sonarr: [
    { lvl: "info", msg: "[sonarr] Search: The Bear (2022) S03E08" },
    { lvl: "info", msg: "[sonarr] Indexer query: 1337x → 14 results" },
    { lvl: "info", msg: "[sonarr] Grabbed: The.Bear.S03E08.1080p.WEB.h264" },
    { lvl: "info", msg: "[sonarr] Sent to qbittorrent (category: tv-sonarr)" },
    { lvl: "info", msg: "[sonarr] Backlog scan complete (172 series)" },
    { lvl: "warn", msg: "[sonarr] Indexer 'Nyaa' returned 503, backing off 5m" },
    { lvl: "info", msg: "[sonarr] Import: /downloads/complete/tv → /mnt/media/tv" },
    { lvl: "info", msg: "[sonarr] Refreshed metadata: Severance" },
  ],
  jellyfin: [
    { lvl: "info", msg: "[jellyfin] User 'sam' started session (Roku)" },
    { lvl: "info", msg: "[jellyfin] Direct Play: Andor S02E04" },
    { lvl: "info", msg: "[jellyfin] Library scan: Movies (started)" },
    { lvl: "warn", msg: "[jellyfin] TLS cert valid 6 days — renewal needed" },
    { lvl: "info", msg: "[jellyfin] Library scan: Movies (done, 4.2k items)" },
    { lvl: "info", msg: "[jellyfin] Transcoding: hevc → h264 (hw)" },
    { lvl: "info", msg: "[jellyfin] User 'kit' resumed playback at 00:24:11" },
  ],
  nginx: [
    { lvl: "info", msg: "GET /jellyfin/Items 200 14ms" },
    { lvl: "info", msg: "GET /sonarr/api/v3/queue 200 8ms" },
    { lvl: "warn", msg: "[acme] cert jellyfin.lan expires in 6d" },
    { lvl: "info", msg: "POST /jellyfin/Sessions/Playing 204 3ms" },
    { lvl: "err",  msg: "GET /jellyseerr/api/v1 502 upstream timeout" },
    { lvl: "info", msg: "GET /pihole/admin 200 11ms" },
    { lvl: "info", msg: "GET /homarr 200 6ms" },
  ],
  pihole: [
    { lvl: "info", msg: "[pihole] query: api.openai.com → forwarded → 1.1.1.1" },
    { lvl: "info", msg: "[pihole] query: doubleclick.net → ✘ blocked (gravity)" },
    { lvl: "info", msg: "[pihole] query: github.com → cache hit" },
    { lvl: "info", msg: "[pihole] gravity update: 142,318 domains" },
    { lvl: "info", msg: "[pihole] query: telemetry.microsoft.com → ✘ blocked" },
    { lvl: "info", msg: "[pihole] DHCP lease: kit-iphone (192.168.1.42)" },
  ],
  qbittorrent: [
    { lvl: "info", msg: "[qbit] added: The.Bear.S03E08.1080p.WEB.h264" },
    { lvl: "info", msg: "[qbit] peers: 24, dl: 8.4 MB/s, eta: 2m" },
    { lvl: "info", msg: "[qbit] completed: Severance.S02.Complete.1080p" },
    { lvl: "info", msg: "[qbit] moved to /downloads/complete/tv" },
    { lvl: "info", msg: "[qbit] seeding: 14 torrents · ratio 2.1" },
  ],
  watchtower: [
    { lvl: "info", msg: "[watchtower] checking 14 containers" },
    { lvl: "info", msg: "[watchtower] sonarr: 4.0.10 → 4.0.12" },
    { lvl: "info", msg: "[watchtower] radarr: 5.7.0 → 5.8.3" },
    { lvl: "info", msg: "[watchtower] pihole: 2025.07 → 2026.04" },
    { lvl: "info", msg: "[watchtower] 11 updates available" },
    { lvl: "info", msg: "[watchtower] no auto-update (manual mode)" },
  ],
  default: [
    { lvl: "info", msg: "service started" },
    { lvl: "info", msg: "healthcheck ok" },
    { lvl: "info", msg: "tick" },
    { lvl: "info", msg: "idle" },
  ],
};

function makeTimestamp(secAgo) {
  const d = new Date(Date.now() - secAgo * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function buildInitialLines(containerId) {
  const tpl = LOG_TEMPLATES[containerId] || LOG_TEMPLATES.default;
  const lines = [];
  for (let i = 0; i < 32; i++) {
    const t = tpl[i % tpl.length];
    lines.push({
      ts: makeTimestamp(60 * 60 - i * 80),
      lvl: t.lvl,
      msg: t.msg,
      id: `init-${containerId}-${i}`,
    });
  }
  return lines;
}

function DozzleIframe({ open, onClose, placement }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`dozzle-scrim${open ? " open" : ""}`} onClick={onClose} />
      <aside className={`dozzle dozzle--fullscreen${open ? " open" : ""}`} data-placement={placement || "bottom"} aria-hidden={!open}>
        <div className="dozzle-hd">
          <div className="dozzle-title">
            <span className="dozzle-label">logs</span>
          </div>
          <button className="dozzle-close" onClick={onClose}>esc</button>
        </div>
        <iframe
          src={open ? DOZZLE_BASE : undefined}
          title="Dozzle log viewer"
          className="dozzle-frame"
          sandbox="allow-scripts allow-same-origin allow-forms"
          referrerPolicy="no-referrer"
        />
      </aside>
    </>
  );
}

function DozzleDemo({ open, onClose, initialContainer, placement }) {
  const [active, setActive] = useState(initialContainer || "sonarr");
  const [filter, setFilter] = useState("");
  const [showInfo, setShowInfo] = useState(true);
  const [showWarn, setShowWarn] = useState(true);
  const [showErr, setShowErr] = useState(true);
  const [lines, setLines] = useState(() => buildInitialLines(initialContainer || "sonarr"));
  const streamRef = useRef(null);
  const liveCounter = useRef(0);

  useEffect(() => {
    if (initialContainer && open) setActive(initialContainer);
  }, [initialContainer, open]);

  useEffect(() => {
    setLines(buildInitialLines(active));
  }, [active]);

  useEffect(() => {
    if (!open) return;
    const tpl = LOG_TEMPLATES[active] || LOG_TEMPLATES.default;
    const id = setInterval(() => {
      const t = tpl[Math.floor(Math.random() * tpl.length)];
      setLines((prev) => {
        const next = [...prev, { ts: makeTimestamp(0), lvl: t.lvl, msg: t.msg, id: `live-${Date.now()}-${liveCounter.current++}` }];
        return next.slice(-200);
      });
    }, 1400);
    return () => clearInterval(id);
  }, [open, active]);

  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const groups = useMemo(() => {
    const g = {};
    DOZZLE_CONTAINERS.forEach((c) => {
      g[c.group] = g[c.group] || [];
      g[c.group].push(c);
    });
    return g;
  }, []);

  const visible = lines.filter((l) => {
    if (l.lvl === "info" && !showInfo) return false;
    if (l.lvl === "warn" && !showWarn) return false;
    if (l.lvl === "err"  && !showErr)  return false;
    if (filter && !l.msg.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const activeContainer = DOZZLE_CONTAINERS.find((c) => c.id === active);

  return (
    <>
      <div className={`dozzle-scrim${open ? " open" : ""}`} onClick={onClose} />
      <aside className={`dozzle${open ? " open" : ""}`} data-placement={placement || "bottom"} aria-hidden={!open}>
        <div className="dozzle-hd">
          <div className="dozzle-title">
            <span className="dozzle-label">dozzle</span>
            <span className="dozzle-active-name">· {activeContainer?.name || ""}</span>
            <span className="dozzle-url">http://dozzle.lan</span>
          </div>
          <button className="dozzle-close" onClick={onClose}>close · esc</button>
        </div>

        <div className="dozzle-body">
          <nav className="dozzle-side">
            {Object.entries(groups).map(([grp, items]) => (
              <div key={grp} className="dozzle-group">
                <div className="dozzle-grp-label">{grp}</div>
                {items.map((c) => (
                  <button
                    key={c.id}
                    className={`dozzle-container-btn${active === c.id ? " active" : ""}`}
                    onClick={() => setActive(c.id)}
                  >
                    <span className={`dozzle-dot ${c.status}`} />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="dozzle-main">
            <div className="dozzle-toolbar">
              <input
                type="text"
                className="dozzle-filter"
                placeholder="filter logs…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <button type="button" className={`dozzle-chip${showInfo ? " on" : ""}`} onClick={() => setShowInfo(!showInfo)}>info</button>
              <button type="button" className={`dozzle-chip${showWarn ? " on" : ""}`} onClick={() => setShowWarn(!showWarn)}>warn</button>
              <button type="button" className={`dozzle-chip${showErr  ? " on" : ""}`} onClick={() => setShowErr(!showErr)}>err</button>
            </div>

            <div className="dozzle-stream" ref={streamRef}>
              {visible.map((l) => (
                <div key={l.id} className={`dozzle-line ${l.lvl}`}>
                  <span className="dozzle-ts">{l.ts}</span>
                  <span className="dozzle-lvl">
                    {l.lvl === "err" ? "✘" : l.lvl === "warn" ? "!" : "·"}
                  </span>
                  <span className="dozzle-msg">{l.msg}</span>
                </div>
              ))}
            </div>

            <div className="dozzle-foot">
              <span className="dozzle-live">
                <span className="dozzle-pulse" />
                tailing · {visible.length} lines
              </span>
              <span>{activeContainer?.name} · live</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function Dozzle(props) {
  return DEMO ? <DozzleDemo {...props} /> : <DozzleIframe {...props} />;
}
