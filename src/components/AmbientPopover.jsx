import { fmtBytes, fmtRate, CPU_WARN_C, CPU_CRIT_C, POOL_WARN_PCT, POOL_CRIT_PCT } from '../services/truenas';

const RANK_LADDER = [
  { name: 'Initiate',       days: 0   },
  { name: 'Steward',        days: 1   },
  { name: 'Ranger',         days: 7   },
  { name: 'First Ranger',   days: 30  },
  { name: 'Lord Commander', days: 100 },
];

function Row({ k, v, cls }) {
  return (
    <div className="ap-row">
      <span className="ap-k">{k}</span>
      <span className={`ap-v${cls ? ' ' + cls : ''}`}>{v ?? '—'}</span>
    </div>
  );
}

function LoadDetail({ info }) {
  const [l1, l5, l15] = info?.loadavg ?? [];
  return (
    <>
      <Row k="1m"    v={l1?.toFixed(2)} />
      <Row k="5m"    v={l5?.toFixed(2)} />
      <Row k="15m"   v={l15?.toFixed(2)} />
      {info?.cores != null && <Row k="cores" v={info.cores} />}
    </>
  );
}

function CpuDetail({ cpuTemp, cores }) {
  const cls = cpuTemp == null ? '' : cpuTemp >= CPU_CRIT_C ? 'crit' : cpuTemp >= CPU_WARN_C ? 'warn' : '';
  return (
    <>
      <Row k="temp"  v={cpuTemp != null ? `${cpuTemp}°C` : null} cls={cls} />
      {cores != null && <Row k="cores" v={cores} />}
      <div className="ap-rule" />
      <Row k="warn↑" v={`${CPU_WARN_C}°C`} />
      <Row k="crit↑" v={`${CPU_CRIT_C}°C`} />
    </>
  );
}

function MemDetail({ physmem, memFree, arcSize }) {
  const used = physmem != null && memFree != null ? physmem - memFree : null;
  const usedPct = physmem && used != null ? Math.round((used / physmem) * 100) : null;
  return (
    <>
      <Row k="total" v={fmtBytes(physmem)} />
      <Row k="free"  v={fmtBytes(memFree)} />
      {arcSize != null && <Row k="arc"  v={fmtBytes(arcSize)} />}
      {usedPct != null && <Row k="used" v={`${usedPct}%`} />}
    </>
  );
}

function NetDetail({ netStats }) {
  return (
    <>
      <Row k="↓ rx" v={fmtRate(netStats?.rx)} />
      <Row k="↑ tx" v={fmtRate(netStats?.tx)} />
    </>
  );
}

function AppsDetail({ apps }) {
  const running = apps.filter(a => a.state === 'RUNNING');
  const other   = apps.filter(a => a.state !== 'RUNNING');
  const renderGroup = (items, label) => items.length === 0 ? null : (
    <div className="ap-group">
      <div className="ap-group-label">{label} ({items.length})</div>
      {items.map(a => (
        <div key={a.name} className="ap-app-row">
          <span className="ap-app-name">{a.name}</span>
          {a.human_version && <span className="ap-app-ver">{a.human_version}</span>}
        </div>
      ))}
    </div>
  );
  return (
    <div className="ap-apps">
      {renderGroup(running, 'running')}
      {other.length > 0 && running.length > 0 && <div className="ap-rule" />}
      {renderGroup(other, 'stopped')}
    </div>
  );
}

function RankDetail({ cleanSince, now }) {
  const cleanDays = cleanSince ? Math.floor((now - new Date(cleanSince)) / 86_400_000) : null;
  const nextRank  = cleanDays != null ? RANK_LADDER.find(r => r.days > cleanDays) ?? null : null;
  const daysUntil = nextRank ? nextRank.days - cleanDays : null;

  if (cleanDays == null) return <Row k="streak" v="none" />;
  return (
    <>
      <Row k="clean" v={`${cleanDays}d`} />
      <div className="ap-rule" />
      {nextRank ? (
        <>
          <Row k="next" v={nextRank.name} />
          <Row k="in"   v={`${daysUntil}d`} />
        </>
      ) : (
        <Row k="status" v="max rank" cls="ok" />
      )}
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
      <Row k="status" v={pool.status} cls={pool.status !== 'ONLINE' ? 'crit' : 'ok'} />
      <Row k="used"   v={pct != null ? `${pct}%` : null} cls={cls} />
      <Row k="alloc"  v={fmtBytes(pool.allocated)} />
      <Row k="total"  v={fmtBytes(pool.size)} />
      {scrubAge != null && <Row k="scrub" v={scrubAge === 0 ? 'today' : `${scrubAge}d ago`} />}
      {pool.scan?.errors > 0 && <Row k="errors" v={pool.scan.errors} cls="crit" />}
    </>
  );
}

export default function AmbientPopover({ chip, anchor, placement, nasData, cleanSince, now, onMouseEnter, onMouseLeave }) {
  if (!chip || !anchor) return null;

  const pools = Array.isArray(nasData?.pools) ? nasData.pools : [];
  const pool  = pools.find(p => p.name === chip);

  let content = null;
  if      (chip === 'load') content = <LoadDetail info={nasData?.info} />;
  else if (chip === 'cpu')  content = <CpuDetail  cpuTemp={nasData?.cpuTemp} cores={nasData?.info?.cores} />;
  else if (chip === 'mem')  content = <MemDetail  physmem={nasData?.info?.physmem} memFree={nasData?.memFree} arcSize={nasData?.arcSize} />;
  else if (chip === 'net')  content = <NetDetail  netStats={nasData?.netStats} />;
  else if (chip === 'apps') content = <AppsDetail apps={nasData?.apps ?? []} />;
  else if (chip === 'rank') content = <RankDetail cleanSince={cleanSince} now={now} />;
  else if (pool)            content = <PoolDetail pool={pool} />;

  if (!content) return null;

  const isApps  = chip === 'apps';
  const popWidth = isApps ? 200 : 160;
  const left = Math.min(anchor.left, window.innerWidth - popWidth - 8);
  const style = { left };
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
