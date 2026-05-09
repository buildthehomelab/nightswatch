import { useState, useEffect } from 'react';

const SERVICES = [
  { name: 'plex',           cpu: 18, cpuJ: 25, mem: 1240, limit: 4096 },
  { name: 'sonarr',         cpu: 2,  cpuJ: 5,  mem: 340,  limit: 1024 },
  { name: 'radarr',         cpu: 1,  cpuJ: 4,  mem: 290,  limit: 1024 },
  { name: 'caddy',          cpu: 0,  cpuJ: 1,  mem: 42,   limit: 256  },
  { name: 'nextcloud',      cpu: 3,  cpuJ: 8,  mem: 680,  limit: 2048 },
  { name: 'homeassistant',  cpu: 2,  cpuJ: 4,  mem: 510,  limit: 1024 },
  { name: 'portainer',      cpu: 0,  cpuJ: 1,  mem: 56,   limit: 256  },
  { name: 'grafana',        cpu: 1,  cpuJ: 3,  mem: 180,  limit: 512  },
];

function jitter(base, j) {
  return Math.max(0, base + (Math.random() - 0.5) * j);
}

export default function DemoMetrics() {
  const [stats, setStats] = useState(() =>
    SERVICES.map(s => ({ ...s, liveCpu: s.cpu, liveMem: s.mem }))
  );

  useEffect(() => {
    const id = setInterval(() => {
      setStats(prev => prev.map(s => ({
        ...s,
        liveCpu: jitter(s.cpu, s.cpuJ),
        liveMem: s.mem + (Math.random() - 0.5) * 30,
      })));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const totalMem = stats.reduce((a, s) => a + s.liveMem, 0);
  const avgCpu = stats.reduce((a, s) => a + s.liveCpu, 0) / stats.length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 48px', fontFamily: 'var(--mono)', fontSize: 11 }}>
      <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
        {[
          { label: 'containers', value: SERVICES.length + ' running' },
          { label: 'avg cpu', value: avgCpu.toFixed(1) + '%' },
          { label: 'mem used', value: (totalMem / 1024).toFixed(1) + ' GB' },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-2)' }}>{value}</div>
          </div>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: 'var(--ink-3)', borderBottom: '1px solid var(--rule)' }}>
            <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 500, width: '28%' }}>name</th>
            <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 500, width: '36%' }}>cpu</th>
            <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 500, width: '36%' }}>memory</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(s => {
            const cpuPct = Math.min(100, s.liveCpu);
            const memPct = Math.min(100, (s.liveMem / s.limit) * 100);
            const cpuColor = cpuPct > 80 ? 'var(--crit)' : cpuPct > 55 ? 'var(--warn)' : 'var(--ok)';
            const memColor = memPct > 85 ? 'var(--crit)' : memPct > 70 ? 'var(--warn)' : 'var(--accent)';
            return (
              <tr key={s.name} style={{ borderBottom: '1px solid var(--rule-soft)' }}>
                <td style={{ padding: '8px 0', color: 'var(--ink-2)' }}>
                  <span style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--ok)', marginRight: 8, verticalAlign: 'middle',
                  }} />
                  {s.name}
                </td>
                <td style={{ padding: '8px 12px 8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 3, background: 'var(--rule)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: '100%', background: cpuColor, borderRadius: 2, transformOrigin: 'left center', transform: `scaleX(${cpuPct / 100})`, transition: 'transform 1.8s ease' }} />
                    </div>
                    <span style={{ color: 'var(--ink-3)', minWidth: 34, textAlign: 'right' }}>{cpuPct.toFixed(1)}%</span>
                  </div>
                </td>
                <td style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 3, background: 'var(--rule)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: '100%', background: memColor, borderRadius: 2, transformOrigin: 'left center', transform: `scaleX(${memPct / 100})`, transition: 'transform 1.8s ease' }} />
                    </div>
                    <span style={{ color: 'var(--ink-3)', minWidth: 72, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {(s.liveMem / 1024).toFixed(1)} / {(s.limit / 1024).toFixed(0)} GB
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
