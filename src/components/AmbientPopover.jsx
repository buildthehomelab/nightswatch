import { fmtBytes, fmtRate, CPU_WARN_C, CPU_CRIT_C, POOL_WARN_PCT, POOL_CRIT_PCT } from '../services/truenas';
import { containerName } from '../services/docker';

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
  { name: 'Builder',        days: 3   },
  { name: 'Ranger',         days: 7   },
  { name: 'Senior Ranger',  days: 21  },
  { name: 'First Ranger',   days: 30  },
  { name: 'Commander',      days: 60  },
  { name: 'Lord Commander', days: 100 },
  { name: 'The Old Bear',   days: 365 },
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
        <div className={`ap-mini-bar-fill${cls ? ' ' + cls : ''}`} style={{ transform: `scaleX(${Math.min(100, pct ?? 0) / 100})` }} />
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

const GBE_MAX = 125 * 1024 * 1024;

function NetDetail({ netStats }) {
  const rx     = netStats?.rx ?? 0;
  const tx     = netStats?.tx ?? 0;
  const ifaces = netStats?.ifaces ?? [];

  const rxPct = Math.min(100, Math.round((rx / GBE_MAX) * 100));
  const txPct = Math.min(100, Math.round((tx / GBE_MAX) * 100));
  const rxCls = rxPct >= 90 ? 'crit' : rxPct >= 70 ? 'warn' : '';
  const txCls = txPct >= 90 ? 'crit' : txPct >= 70 ? 'warn' : '';

  return (
    <>
      <Head label={ifaces.length > 1 ? `network · ${ifaces.length} ifaces` : 'network'} />
      <div className="ap-body">
        <Row k="↓ rx" v={fmtRate(rx)} cls={rxCls || undefined} />
        <MiniBar pct={rxPct} cls={rxCls} />
        <Row k="↑ tx" v={fmtRate(tx)} cls={txCls || undefined} />
        <MiniBar pct={txPct} cls={txCls} />
        {ifaces.length > 0 && (
          <>
            <div className="ap-rule" />
            {ifaces.map((iface) => (
              <div key={iface.name} className="ap-net-iface">
                <div className="ap-net-iface-name">{iface.name}</div>
                <Row k="↓" v={fmtRate(iface.rx)} />
                <Row k="↑" v={fmtRate(iface.tx)} />
              </div>
            ))}
          </>
        )}
        <div className="ap-rule" />
        <Row k="ref" v="1 GbE" />
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

function RankDetail({ cleanSince, critHistory, peakRank }) {
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

  const lastCrit = critHistory?.length > 0 ? critHistory[critHistory.length - 1] : null;
  const showPeak = peakRank && peakRank.rank !== currentRank.name;

  if (elapsed == null) return (
    <>
      <Head label="rank" />
      <div className="ap-body">
        <div className="rk-empty">no streak</div>
        {lastCrit && (
          <div className="rk-history">
            <span className="rk-fell">fell {critHistory.length}× · last from {lastCrit.fromRank} ({lastCrit.fromDays}d)</span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <Head label="rank" />
      <div className="ap-body">
        <div className="rk-wrap">
          <div className="rk-ladder">
            {RANK_LADDER.map((r, i) => (
              <div
                key={r.name}
                className={`rk-pip rk-pip--${i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'future'}`}
                title={`${r.name} (${r.days}d)`}
              />
            ))}
          </div>
          <div className="rk-name-row">
            <span className="rk-name">{currentRank.name}</span>
            {nextRank && <span className="rk-pct">{progress}%</span>}
          </div>
          {nextRank && (
            <div className="rk-bar-track">
              <div className="rk-bar-fill" style={{ transform: `scaleX(${progress / 100})` }} />
            </div>
          )}
          <div className="rk-footer">
            <span className="rk-streak">clean {fmtClean(elapsed)}</span>
            {nextRank
              ? <span className="rk-next">→ {nextRank.name} {fmtClean(remaining)}</span>
              : <span className="rk-max">max rank</span>
            }
          </div>
          {(showPeak || lastCrit) && (
            <div className="rk-history">
              {showPeak && (
                <span className="rk-peak">best: {peakRank.rank} · {peakRank.days}d</span>
              )}
              {lastCrit && (
                <span className="rk-fell">fell {critHistory.length}× · last from {lastCrit.fromRank} ({lastCrit.fromDays}d)</span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function WanDetail({ wanUp, wanDownSince, now }) {
  const downMs = !wanUp && wanDownSince ? now - wanDownSince.getTime() : null;

  function fmtDur(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d)  return `${d}d ${h % 24}h`;
    if (h)  return `${h}h ${m % 60}m`;
    if (m)  return `${m}m`;
    return `${s}s`;
  }

  const sinceFmt = wanDownSince
    ? wanDownSince.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  return (
    <>
      <Head label="wan connectivity" />
      <div className="ap-body">
        <Row k="status" v={wanUp ? 'up' : 'down'} cls={wanUp ? 'ok' : 'crit'} />
        {!wanUp && sinceFmt && <Row k="since"    v={sinceFmt} />}
        {!wanUp && downMs != null && <Row k="duration" v={fmtDur(downMs)} cls="crit" />}
        <div className="ap-rule" />
        <Row k="probe 1"   v="1.1.1.1" />
        <Row k="probe 2"   v="8.8.8.8" />
        <Row k="interval"  v="30s" />
        {wanUp && <Row k="threshold" v="3 fails" />}
      </div>
    </>
  );
}

function UptimeDetail({ nasUptimeSeconds, nasVersion, startTimeMs, now }) {
  const isNas   = nasUptimeSeconds != null;
  const totalMs = isNas ? nasUptimeSeconds * 1000 : now - startTimeMs;

  const d = Math.floor(totalMs / 86_400_000);
  const h = Math.floor((totalMs % 86_400_000) / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const exact = [d && `${d}d`, h && `${h}h`, (m || (!d && !h)) && `${m}m`]
    .filter(Boolean).join(' ');

  const bootDate = isNas ? new Date(now - nasUptimeSeconds * 1000) : null;
  const bootFmt  = bootDate
    ? bootDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
      + ' · '
      + bootDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  const sessionFmt = new Date(startTimeMs)
    .toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

  const ageDays  = Math.floor(totalMs / 86_400_000);
  const ageHours = Math.floor(totalMs / 3_600_000);
  const ageStr   = ageDays >= 1
    ? `${ageDays} day${ageDays !== 1 ? 's' : ''} ago`
    : ageHours >= 1
    ? `${ageHours} hour${ageHours !== 1 ? 's' : ''} ago`
    : 'less than an hour ago';

  const versionShort = nasVersion ? nasVersion.replace(/^TrueNAS-/, '') : null;

  return (
    <>
      <Head label={isNas ? 'nas uptime' : 'session uptime'} />
      <div className="ap-body">
        <Row k="uptime"     v={exact} />
        {bootFmt      && <Row k="booted"     v={bootFmt} />}
        {versionShort && <Row k="version"    v={versionShort} />}
        <div className="ap-rule" />
        <Row k="tab opened" v={sessionFmt} />
        {isNas && <Row k="boot" v={ageStr} />}
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
      <div className="ap-body"><div className="ap-empty">loading…</div></div>
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

function DockerDetail({ dockerData }) {
  if (!dockerData) return (
    <>
      <Head label="docker" />
      <div className="ap-body"><div className="ap-empty">loading…</div></div>
    </>
  );

  const containers = dockerData.containers ?? [];
  const info       = dockerData.info ?? null;
  const running    = containers.filter(c => c.State === 'running');
  const nonRunning = containers.filter(c => c.State !== 'running');

  const sortedRunning = [...running].sort((a, b) => (b._cpuPct ?? -1) - (a._cpuPct ?? -1));

  const badgeCls = (state) => {
    if (state === 'restarting') return ' crit';
    if (state === 'exited')     return ' warn';
    return '';
  };

  const fmtCpu = (pct) => pct == null ? null : `${pct < 0.1 ? '<0.1' : pct.toFixed(1)}%`;

  return (
    <>
      <Head label={`docker · ${running.length}/${containers.length}`} />
      <div className="ap-body">
        <Row k="running"  v={String(info?.ContainersRunning  ?? running.length)} />
        <Row k="stopped"  v={String(info?.ContainersStopped  ?? nonRunning.filter(c => c.State === 'exited').length)} />
        {(info?.ContainersPaused ?? 0) > 0 && <Row k="paused" v={String(info.ContainersPaused)} />}
        {info?.ServerVersion && <Row k="engine" v={info.ServerVersion} />}
        {(nonRunning.length > 0 || sortedRunning.length > 0) && (
          <>
            <div className="ap-rule" />
            <div className="ap-apps">
              {nonRunning.map(c => {
                const name = containerName(c);
                const cls  = badgeCls(c.State);
                return (
                  <div key={c.Id} className="ap-app-row">
                    <span className={`ap-app-dot${cls}`} />
                    <span className="ap-app-name">{name}</span>
                    <span className={`ap-app-ver${cls}`}>{c.State}</span>
                  </div>
                );
              })}
              {nonRunning.length > 0 && sortedRunning.length > 0 && (
                <div className="ap-subhead">running</div>
              )}
              {sortedRunning.map(c => {
                const name = containerName(c);
                const cpu  = fmtCpu(c._cpuPct);
                const ver  = c._version ?? null;
                return (
                  <div key={c.Id} className="ap-app-row ap-docker-row">
                    <span className="ap-app-dot running" />
                    <div className="ap-docker-info">
                      <span className="ap-docker-name">{name}</span>
                      {(ver || cpu) && (
                        <div className="ap-docker-meta">
                          {ver && <span className="ap-docker-ver">{ver}</span>}
                          {cpu && <span className="ap-docker-cpu">{cpu}</span>}
                        </div>
                      )}
                    </div>
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

export default function AmbientPopover({ chip, anchor, placement, nasData, dockerData, cleanSince, critHistory, peakRank, now, weatherForecast, startTimeMs, nasUptimeSeconds, nasVersion, wanUp, wanDownSince, onMouseEnter, onMouseLeave }) {
  if (!chip || !anchor) return null;

  const pools = Array.isArray(nasData?.pools) ? nasData.pools : [];
  const pool  = pools.find(p => p.name === chip);

  let content = null;
  if      (chip === 'load')    content = <LoadDetail    info={nasData?.info} />;
  else if (chip === 'cpu')     content = <CpuDetail     cpuTemp={nasData?.cpuTemp} cores={nasData?.info?.cores} />;
  else if (chip === 'mem')     content = <MemDetail     physmem={nasData?.info?.physmem} memFree={nasData?.memFree} arcSize={nasData?.arcSize} />;
  else if (chip === 'net')     content = <NetDetail     netStats={nasData?.netStats} />;
  else if (chip === 'apps')    content = <AppsDetail    apps={nasData?.apps ?? []} />;
  else if (chip === 'rank')    content = <RankDetail    cleanSince={cleanSince} critHistory={critHistory} peakRank={peakRank} now={now} />;
  else if (chip === 'weather') content = <WeatherDetail forecast={weatherForecast} />;
  else if (chip === 'uptime')  content = <UptimeDetail  nasUptimeSeconds={nasUptimeSeconds} nasVersion={nasVersion} startTimeMs={startTimeMs} now={now} />;
  else if (chip === 'wan')     content = <WanDetail     wanUp={wanUp} wanDownSince={wanDownSince} now={now} />;
  else if (chip === 'docker')  content = <DockerDetail  dockerData={dockerData} />;
  else if (pool)               content = <PoolDetail    pool={pool} />;

  if (!content) return null;

  const isApps    = chip === 'apps';
  const isRank    = chip === 'rank';
  const isWeather = chip === 'weather';
  const isUptime  = chip === 'uptime';
  const isWan     = chip === 'wan';
  const isNet     = chip === 'net';
  const isDocker  = chip === 'docker';
  const popWidth = isWeather ? 210 : isApps || isRank || isUptime || isDocker ? 220 : isWan || isNet ? 200 : 180;
  const left = (isRank || isWeather || isUptime || isWan || isNet || isDocker)
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
