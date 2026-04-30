import { useState, useEffect, useRef, useMemo } from 'react';

const DOZZLE_BASE = "https://logs.vaultrona.com";

const MOCK_CONTAINERS = [
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

const MOCK_LOGS = {
  sonarr:      [
    { lvl: "info", msg: "[sonarr] Search: The Bear (2022) S03E08" },
    { lvl: "info", msg: "[sonarr] Indexer query: 1337x → 14 results" },
    { lvl: "info", msg: "[sonarr] Grabbed: The.Bear.S03E08.1080p.WEB.h264" },
    { lvl: "info", msg: "[sonarr] Sent to qbittorrent (category: tv-sonarr)" },
    { lvl: "warn", msg: "[sonarr] Indexer 'Nyaa' returned 503, backing off 5m" },
  ],
  jellyfin:    [
    { lvl: "info", msg: "[jellyfin] User 'sam' started session (Roku)" },
    { lvl: "info", msg: "[jellyfin] Direct Play: Andor S02E04" },
    { lvl: "warn", msg: "[jellyfin] TLS cert valid 6 days — renewal needed" },
  ],
  nginx:       [
    { lvl: "info", msg: "GET /jellyfin/Items 200 14ms" },
    { lvl: "warn", msg: "[acme] cert jellyfin.lan expires in 6d" },
    { lvl: "err",  msg: "GET /jellyseerr/api/v1 502 upstream timeout" },
  ],
  pihole:      [
    { lvl: "info", msg: "[pihole] query: github.com → cache hit" },
    { lvl: "info", msg: "[pihole] query: doubleclick.net → ✘ blocked (gravity)" },
  ],
  qbittorrent: [
    { lvl: "info", msg: "[qbit] peers: 24, dl: 8.4 MB/s, eta: 2m" },
    { lvl: "info", msg: "[qbit] completed: Severance.S02.Complete.1080p" },
  ],
  default:     [
    { lvl: "info", msg: "service started" },
    { lvl: "info", msg: "healthcheck ok" },
    { lvl: "info", msg: "idle" },
  ],
};

function normLevel(raw) {
  if (typeof raw === "number") {
    if (raw <= 3) return "err";
    if (raw === 4) return "warn";
    return "info";
  }
  if (raw === "error" || raw === "err") return "err";
  if (raw === "warn" || raw === "warning") return "warn";
  return "info";
}

function fmtTs(raw) {
  const d = raw ? new Date(typeof raw === "number" ? raw * 1000 : raw) : new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function buildMockLines(containerId) {
  const tpl = MOCK_LOGS[containerId] || MOCK_LOGS.default;
  return Array.from({ length: 24 }, (_, i) => {
    const t = tpl[i % tpl.length];
    const d = new Date(Date.now() - (3600 - i * 90) * 1000);
    return { ts: fmtTs(d), lvl: t.lvl, msg: t.msg, id: `mock-${i}` };
  });
}

export default function Dozzle({ open, onClose, initialContainer }) {
  const [containers, setContainers] = useState(MOCK_CONTAINERS);
  const [active, setActive]         = useState(initialContainer || "sonarr");
  const [filter, setFilter]         = useState("");
  const [showInfo, setShowInfo]     = useState(true);
  const [showWarn, setShowWarn]     = useState(true);
  const [showErr,  setShowErr]      = useState(true);
  const [lines, setLines]           = useState(() => buildMockLines(active));
  const [live, setLive]             = useState(false);
  const [hostId, setHostId]         = useState(null);
  const streamRef                   = useRef(null);
  const esRef                       = useRef(null);

  useEffect(() => {
    if (initialContainer && open) setActive(initialContainer);
  }, [initialContainer, open]);

  // Fetch real container list when overlay opens — try v8 API, fall back to legacy
  useEffect(() => {
    if (!open) return;

    const mapContainers = (data, hId) =>
      data.map((c) => ({
        id:     c.id,
        name:   (c.name || c.Names?.[0] || "").replace(/^\//, ""),
        group:  c.group || "containers",
        status: (c.state || c.State) === "running" ? "ok" : "off",
        hostId: hId,
      }));

    const load = async () => {
      // v8: GET /api/hosts → [{id, name, ...}], then GET /api/hosts/:id/containers
      try {
        const hostsRes = await fetch(`${DOZZLE_BASE}/api/hosts`);
        const hostsData = await hostsRes.json();
        const hosts = Array.isArray(hostsData) ? hostsData : [hostsData];
        const hId = hosts[0]?.id ?? "localhost";
        setHostId(hId);

        const cRes = await fetch(`${DOZZLE_BASE}/api/hosts/${hId}/containers`);
        const cData = await cRes.json();
        setContainers(mapContainers(Array.isArray(cData) ? cData : cData.containers ?? [], hId));
        return;
      } catch (e) {
        console.warn("[dozzle] v8 API failed, trying legacy:", e);
      }

      // legacy: GET /api/containers
      try {
        const res = await fetch(`${DOZZLE_BASE}/api/containers`);
        const data = await res.json();
        setContainers(mapContainers(data, null));
      } catch (e) {
        console.error("[dozzle] could not fetch containers:", e);
      }
    };

    load();
  }, [open]);

  // Stream logs via EventSource; fall back to mock on error
  useEffect(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    setLines([]);
    setLive(false);

    const container = containers.find((c) => c.id === active || c.name === active);
    const id = container?.id ?? active;
    const hId = container?.hostId ?? hostId;

    const streamUrl = hId
      ? `${DOZZLE_BASE}/api/hosts/${hId}/containers/${encodeURIComponent(id)}/logs/stream`
      : `${DOZZLE_BASE}/api/logs/stream?id=${encodeURIComponent(id)}`;

    const es = new EventSource(streamUrl);
    esRef.current = es;

    let seq = 0;

    es.addEventListener("container-logs", (e) => {
      try {
        const data = JSON.parse(e.data);
        setLive(true);
        setLines((prev) => {
          const next = [...prev, {
            ts:  fmtTs(data.ts),
            lvl: normLevel(data.level ?? data.lvl),
            msg: data.m ?? data.message ?? "",
            id:  `live-${seq++}`,
          }];
          return next.slice(-500);
        });
      } catch {}
    });

    es.onmessage = (e) => {
      setLive(true);
      setLines((prev) => {
        const next = [...prev, { ts: fmtTs(null), lvl: "info", msg: e.data, id: `live-${seq++}` }];
        return next.slice(-500);
      });
    };

    es.onerror = (e) => {
      console.error("[dozzle] stream error:", streamUrl, e);
      es.close();
      esRef.current = null;
      setLive(false);
      setLines(buildMockLines(active));
    };

    return () => { es.close(); esRef.current = null; };
  }, [active, containers, hostId]);

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
    containers.forEach((c) => {
      g[c.group] = g[c.group] || [];
      g[c.group].push(c);
    });
    return g;
  }, [containers]);

  const activeContainer = containers.find((c) => c.id === active || c.name === active);

  const visible = lines.filter((l) => {
    if (l.lvl === "info" && !showInfo) return false;
    if (l.lvl === "warn" && !showWarn) return false;
    if (l.lvl === "err"  && !showErr)  return false;
    if (filter && !l.msg.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div className={`dozzle-scrim ${open ? "open" : ""}`} onClick={onClose}></div>
      <aside className={`dozzle ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="dozzle-hd">
          <div className="title">
            <b>dozzle</b>
            <span>· {activeContainer?.name || active}</span>
            <span className="url">{DOZZLE_BASE}</span>
          </div>
          <button className="dozzle-close" onClick={onClose}>close · esc</button>
        </div>

        <div className="dozzle-body">
          <nav className="dozzle-side">
            {Object.entries(groups).map(([grp, items]) => (
              <div key={grp}>
                <div className="grp">{grp}</div>
                {items.map((c) => (
                  <button
                    key={c.id}
                    className={active === c.id || active === c.name ? "active" : ""}
                    onClick={() => setActive(c.id)}
                  >
                    <span className={`dot ${c.status}`}></span>
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
                placeholder="filter logs…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <span className={`chip ${showInfo ? "on" : ""}`} onClick={() => setShowInfo(!showInfo)}>info</span>
              <span className={`chip ${showWarn ? "on" : ""}`} onClick={() => setShowWarn(!showWarn)}>warn</span>
              <span className={`chip ${showErr  ? "on" : ""}`} onClick={() => setShowErr(!showErr)}>err</span>
            </div>

            <div className="dozzle-stream" ref={streamRef}>
              {visible.map((l) => (
                <div key={l.id} className={`dozzle-line ${l.lvl}`}>
                  <span className="ts">{l.ts}</span>
                  <span className="lvl">
                    {l.lvl === "err" ? "✘" : l.lvl === "warn" ? "!" : "·"}
                  </span>
                  <span className="msg">{l.msg}</span>
                </div>
              ))}
            </div>

            <div className="dozzle-foot">
              <span className="live">
                <span className="pulse"></span>
                {live ? "live" : "mock"} · {visible.length} lines
              </span>
              <span>{activeContainer?.name ?? active} · {live ? "tailing" : "offline"}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
