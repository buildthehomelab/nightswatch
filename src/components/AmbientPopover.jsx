import { fmtBytes, fmtRate, CPU_WARN_C, CPU_CRIT_C, POOL_WARN_PCT, POOL_CRIT_PCT } from '../services/truenas';

function fmtClean(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60)  return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const RANK_LADDER = [
  { name: 'Initiate',       days: 0   },
  { name: 'Steward',        days: 1   },
  { name: 'Ranger',         days: 7   },
  { name: 'First Ranger',   days: 30  },
  { name: 'Lord Commander', days: 100 },
];

function Head({ label }) {
  return <div className="ap-head">{label}</div>;
}

function Row({ k, v, cls }) {
  return (
    <div className="ap-row">
      <span className="ap-k">{k}</span>
      <span className={`ap-v${cls ? ' ' + cls : ''}`}>{v ?? '—'}</span>
    </div>
  );
}

function MiniBar({ pct, cls }) {
  return (
    <div className="ap-mini-bar">
      <div className="ap-mini-bar-track">
        <div className={`ap-mini-bar-fill${cls ? ' ' + cls : ''}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
      </div>
    </div>
  );
}

function LoadDetail({ info }) {
  const [l1, l5, l15] = info?.loadavg ?? [];
  const cores = info?.cores ?? 1;
  const loadPct = l1 != null ? Math.round((l1 / cores) * 100) : null;
  const barCls = loadPct >= 90 ? 'crit' : loadPct >= 70 ? 'warn' : '';
  return (
    <>
      <Head label="system load" />
      <div className="ap-body">
        {loadPct != null && <MiniBar pct={loadPct} cls={barCls} />}
        <Row k="1m"    v={l1?.toFixed(2)} />
        <Row k="5m"    v={l5?.toFixed(2)} />
        <Row k="15m"   v={l15?.toFixed(2)} />
        {info?.cores != null && <Row k="cores" v={info.cores} />}
      </div>
    </>
  );
}

function CpuDetail({ cpuTemp, cores }) {
  const cls = cpuTemp == null ? '' : cpuTemp >= CPU_CRIT_C ? 'crit' : cpuTemp >= CPU_WARN_C ? 'warn' : '';
  const pct = cpuTemp != null ? Math.round((cpuTemp / CPU_CRIT_C) * 100) : null;
  return (
    <>
      <Head label="cpu temperature" />
      <div className="ap-body">
        {pct != null && <MiniBar pct={pct} cls={cls} />}
        <Row k="temp"  v={cpuTemp != null ? `${cpuTemp}°C` : null} cls={cls} />
        {cores != null && <Row k="cores" v={cores} />}
        <div className="ap-rule" />
        <Row k="warn↑" v={`${CPU_WARN_C}°C`} />
        <Row k="crit↑" v={`${CPU_CRIT_C}°C`} />
      </div>
    </>
  );
}

function MemDetail({ physmem, memFree, arcSize }) {
  const used = physmem != null && memFree != null ? physmem - memFree : null;
  const usedPct = physmem && used != null ? Math.round((used / physmem) * 100) : null;
  const barCls = usedPct >= 90 ? 'crit' : usedPct >= 75 ? 'warn' : '';
  return (
    <>
      <Head label="memory" />
      <div className="ap-body">
        {usedPct != null && <MiniBar pct={usedPct} cls={barCls} />}
        <Row k="total" v={fmtBytes(physmem)} />
        <Row k="free"  v={fmtBytes(memFree)} />
        {arcSize != null && <Row k="arc"  v={fmtBytes(arcSize)} />}
        {usedPct != null && <Row k="used" v={`${usedPct}%`} cls={barCls || undefined} />}
      </div>
    </>
  );
}

function NetDetail({ netStats }) {
  return (
    <>
      <Head label="network" />
      <div className="ap-body">
        <Row k="↓ rx" v={fmtRate(netStats?.rx)} />
        <Row k="↑ tx" v={fmtRate(netStats?.tx)} />
      </div>
    </>
  );
}

function AppsDetail({ apps }) {
  const running = apps.filter(a => a.state === 'RUNNING');
  const other   = apps.filter(a => a.state !== 'RUNNING');
  const renderGroup = (items, isRunning) => items.length === 0 ? null : (
    <div className="ap-group">
      <div className="ap-group-label">{isRunning ? 'running' : 'stopped'} ({items.length})</div>
      {items.map(a => (
        <div key={a.name} className="ap-app-row">
          <span className={`ap-app-dot${isRunning ? ' running' : ''}`} />
          <span className="ap-app-name">{a.name}</span>
          {a.human_version && <span className="ap-app-ver">{a.human_version}</span>}
        </div>
      ))}
    </div>
  );
  return (
    <>
      <Head label={`apps · ${running.length}/${apps.length} running`} />
      <div className="ap-body">
        <div className="ap-apps">
          {renderGroup(running, true)}
          {other.length > 0 && running.length > 0 && <div className="ap-rule" />}
          {renderGroup(other, false)}
        </div>
      </div>
    </>
  );
}

function RankDetail({ cleanSince }) {
  const elapsed     = cleanSince ? Date.now() - new Date(cleanSince).getTime() : null;
  const elapsedDays = elapsed != null ? elapsed / 86_400_000 : null;

  const currentIdx  = elapsed != null
    ? RANK_LADDER.reduce((acc, r, i) => r.days <= elapsedDays ? i : acc, 0) : 0;
  const currentRank = RANK_LADDER[currentIdx];
  const nextRank    = RANK_LADDER[currentIdx + 1] ?? null;

  let progress  = 100;
  let remaining = null;
  if (nextRank && elapsed != null) {
    const from = currentRank.days * 86_400_000;
    const to   = nextRank.days   * 86_400_000;
    progress  = Math.min(100, Math.round(((elapsed - from) / (to - from)) * 100));
    remaining = to - elapsed;
  }

  if (elapsed == null) return (
    <>
      <Head label="rank" />
      <div className="ap-body"><div className="rk-empty">no streak</div></div>
    </>
  );

  return (
    <>
      <Head label="rank" />
      <div className="ap-body">
        <div className="rk-wrap">
          <div className="rk-header">
            <span className="rk-name">{currentRank.name}</span>
            <span className="rk-pct">{progress}%</span>
          </div>
          <div className="rk-bar-track">
            <div className="rk-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="rk-footer">
            <span className="rk-streak">clean for {fmtClean(elapsed)}</span>
            {nextRank
              ? <span className="rk-next">→ {nextRank.name} in {fmtClean(remaining)}</span>
              : <span className="rk-max">max rank</span>
            }
          </div>
        </div>
      </div>
    </>
  );
}

const WX_EMOJI = {
  113: '☀️', 116: '⛅', 119: '☁️', 122: '☁️',
  143: '🌫️', 176: '🌦️', 179: '🌨️', 182: '🌧️', 185: '🌧️',
  200: '⛈️', 227: '🌨️', 230: '❄️', 248: '🌫️', 260: '🌫️',
  263: '🌦️', 266: '🌦️', 281: '🌧️', 284: '🌧️',
  293: '🌦️', 296: '🌧️', 299: '🌧️', 302: '🌧️', 305: '🌧️', 308: '🌧️',
  311: '🌧️', 314: '🌧️', 317: '🌨️', 320: '🌨️',
  323: '🌨️', 326: '🌨️', 329: '🌨️', 332: '🌨️', 335: '🌨️', 338: '❄️',
  350: '🌧️', 353: '🌦️', 356: '🌧️', 359: '🌧️',
  362: '🌨️', 365: '🌨️', 368: '🌨️', 371: '🌨️',
  374: '🌧️', 377: '🌧️', 386: '⛈️', 389: '⛈️', 392: '⛈️', 395: '⛈️',
};
function wxEmoji(code) { return WX_EMOJI[+code] ?? '🌡️'; }

const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function WeatherDetail({ forecast }) {
  if (!forecast) return (
    <>
      <Head label="weather" />
      <div className="ap-body"><div className="rk-empty">loading…</div></div>
    </>
  );
  const cur = forecast.current_condition?.[0];
  const days = forecast.weather ?? [];
  const desc = cur?.weatherDesc?.[0]?.value ?? '';
  const humidity = cur?.humidity;
  const wind = cur?.windspeedKmph;
  const windDir = cur?.winddir16Point ?? '';
  const feelsLike = cur?.FeelsLikeC;
  const temp = cur?.temp_C;
  const precip = cur?.precipMM;

  return (
    <>
      <Head label="weather" />
      <div className="ap-body">
        {cur && (
          <div className="wth-current">
            <div className="wth-cur-main">
              <span className="wth-cur-emoji">{wxEmoji(cur.weatherCode)}</span>
              <div className="wth-cur-temps">
                <span className="wth-cur-temp">{temp}°</span>
                <span className="wth-cur-feels">feels {feelsLike}°</span>
              </div>
            </div>
            <div className="wth-cur-desc">{desc.toLowerCase()}</div>
            <div className="ap-rule" />
            <Row k="humidity"  v={humidity ? `${humidity}%` : null} />
            <Row k={`wind ${windDir.toLowerCase()}`} v={wind ? `${wind} km/h` : null} />
            {precip !== undefined && <Row k="precip"    v={`${precip} mm`} />}
          </div>
        )}
        {days.length > 0 && (
          <>
            <div className="ap-rule" />
            <div className="wth-forecast">
              {days.map((d, i) => {
                const date    = new Date(d.date);
                const dayName = i === 0 ? 'today' : DAY_SHORT[date.getDay()];
                const code    = d.hourly?.[4]?.weatherCode ?? d.hourly?.[0]?.weatherCode;
                return (
                  <div key={d.date} className="wth-day">
                    <span className="wth-day-name">{dayName}</span>
                    <span className="wth-day-icon">{wxEmoji(code)}</span>
                    <span className="wth-day-hi">{d.maxtempC}°</span>
                    <span className="wth-day-sep">/</span>
                    <span className="wth-day-lo">{d.mintempC}°</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function PoolDetail({ pool }) {
  const pct = pool.size ? Math.round((pool.allocated / pool.size) * 100) : null;
  const cls = pool.status !== 'ONLINE' || pct >= POOL_CRIT_PCT ? 'crit' : pct >= POOL_WARN_PCT ? 'warn' : '';
  const scrubDate = pool.scan?.end_time ? new Date(pool.scan.end_time) : null;
  const scrubAge  = scrubDate ? Math.floor((Date.now() - scrubDate) / 86_400_000) : null;
  return (
    <>
      <Head label={pool.name} />
      <div className="ap-body">
        {pct != null && <MiniBar pct={pct} cls={cls} />}
        <Row k="status" v={pool.status} cls={pool.status !== 'ONLINE' ? 'crit' : 'ok'} />
        <Row k="used"   v={pct != null ? `${pct}%` : null} cls={cls || undefined} />
        <Row k="alloc"  v={fmtBytes(pool.allocated)} />
        <Row k="total"  v={fmtBytes(pool.size)} />
        {scrubAge != null && <Row k="scrub" v={scrubAge === 0 ? 'today' : `${scrubAge}d ago`} />}
        {pool.scan?.errors > 0 && <Row k="errors" v={pool.scan.errors} cls="crit" />}
      </div>
    </>
  );
}

export default function AmbientPopover({ chip, anchor, placement, nasData, cleanSince, now, weatherForecast, onMouseEnter, onMouseLeave }) {
  if (!chip || !anchor) return null;

  const pools = Array.isArray(nasData?.pools) ? nasData.pools : [];
  const pool  = pools.find(p => p.name === chip);

  let content = null;
  if      (chip === 'load')    content = <LoadDetail    info={nasData?.info} />;
  else if (chip === 'cpu')     content = <CpuDetail     cpuTemp={nasData?.cpuTemp} cores={nasData?.info?.cores} />;
  else if (chip === 'mem')     content = <MemDetail     physmem={nasData?.info?.physmem} memFree={nasData?.memFree} arcSize={nasData?.arcSize} />;
  else if (chip === 'net')     content = <NetDetail     netStats={nasData?.netStats} />;
  else if (chip === 'apps')    content = <AppsDetail    apps={nasData?.apps ?? []} />;
  else if (chip === 'rank')    content = <RankDetail    cleanSince={cleanSince} now={now} />;
  else if (chip === 'weather') content = <WeatherDetail forecast={weatherForecast} />;
  else if (pool)               content = <PoolDetail    pool={pool} />;

  if (!content) return null;

  const isApps    = chip === 'apps';
  const isRank    = chip === 'rank';
  const isWeather = chip === 'weather';
  const popWidth = isWeather ? 210 : isApps || isRank ? 220 : 180;
  const left = (isRank || isWeather)
    ? Math.max(8, anchor.right - popWidth)
    : Math.min(anchor.left, window.innerWidth - popWidth - 8);
  const style = { left, width: popWidth };
  if (placement === 'bottom') {
    style.bottom = window.innerHeight - anchor.top + 8;
  } else {
    style.top = anchor.bottom + 8;
  }

  return (
    <div
      className="ambient-popover"
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {content}
    </div>
  );
}
