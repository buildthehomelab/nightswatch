import { useState, useEffect } from 'react';

const BASE = "https://patronus.vaultrona.com:3443";
const KEY = import.meta.env.VITE_TRUENAS_KEY ?? "";

function fmtUptime(sec) {
  if (sec == null) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmtBytes(bytes) {
  if (bytes == null) return "—";
  const tb = bytes / (1024 ** 4);
  if (tb >= 0.95) return `${tb.toFixed(1)} TB`;
  const gb = bytes / (1024 ** 3);
  return `${gb.toFixed(1)} GB`;
}

async function fetchData() {
  const hdrs = { Authorization: `Bearer ${KEY}` };
  const [info, pools] = await Promise.all([
    fetch(`${BASE}/api/v1/system/info`, { headers: hdrs }).then(r => r.json()),
    fetch(`${BASE}/api/v1/pool`, { headers: hdrs }).then(r => r.json()),
  ]);
  return { info, pools };
}

export default function TrueNas() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const refresh = () => fetchData().then(d => { setData(d); setErr(null); }).catch(e => setErr(e?.message ?? "fetch failed"));
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  if (err) return (
    <div className="nas-strip rise">
      <span className="nas-item">
        <span className="nas-k">nas</span>
        <span className="nas-v nas-crit">{err}</span>
      </span>
    </div>
  );

  if (!data) return null;

  const { info, pools } = data;
  const load1 = info?.loadavg?.[0]?.toFixed(2) ?? "—";
  const uptime = fmtUptime(info?.uptime_seconds);
  const hostname = info?.hostname ?? "nas";

  return (
    <div className="nas-strip rise">
      <div className="nas-left">
        <span className="nas-item">
          <a href={BASE} target="_blank" rel="noopener noreferrer" className="nas-link">
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
      </div>
      <div className="nas-right">
        {(Array.isArray(pools) ? pools : []).map(pool => {
          const ok = pool.status === "ONLINE";
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
