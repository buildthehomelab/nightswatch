import { useState, useRef, useEffect, useCallback } from 'react';

const __CUSTOMIZE_STYLE = `
  .twk-scrim {
    position: fixed; inset: 0; z-index: 2147483644;
  }

  .twk-drawer {
    position: fixed; left: 0; right: 0;
    z-index: 2147483645;
    background: var(--paper);
    display: flex; flex-direction: column;
    transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
    overflow: hidden;
  }
  .twk-drawer[data-side="top"] {
    top: 0; border-bottom: 1px solid var(--rule);
    transform: translateY(-100%);
  }
  .twk-drawer[data-side="bottom"] {
    bottom: 0; border-top: 1px solid var(--rule);
    transform: translateY(100%);
  }
  .twk-drawer.open { transform: translateY(0); }

  .twk-hd {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--rule);
    flex-shrink: 0;
  }
  .twk-title {
    font-family: var(--sans);
    font-size: 10px; font-weight: 500;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--ink-3);
  }
  .twk-x {
    appearance: none; border: 0; background: transparent;
    color: var(--ink-3); cursor: default;
    font-family: var(--sans); font-size: 9.5px;
    letter-spacing: 0.08em; text-transform: uppercase;
    padding: 0; line-height: 1; transition: color 0.12s;
  }
  .twk-x:hover { color: var(--ink); }

  .twk-body {
    padding: 16px 28px 20px;
    display: flex; flex-direction: row;
    gap: 32px; align-items: start;
    overflow-x: auto; overflow-y: hidden;
    scrollbar-width: thin; scrollbar-color: var(--rule) transparent;
  }
  .twk-col {
    display: flex; flex-direction: column;
    min-width: 160px; flex-shrink: 0;
  }
  .twk-col-wide { min-width: 220px; }

  .twk-sect {
    font-family: var(--sans);
    font-size: 9px; font-weight: 500;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--ink-3);
    padding: 12px 0 8px;
    border-bottom: 1px solid var(--rule);
    margin-bottom: 14px;
  }
  .twk-col > .twk-sect:first-child { padding-top: 0; }

  .twk-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .twk-row-h {
    flex-direction: row; align-items: center;
    justify-content: space-between; gap: 10px; margin-bottom: 10px;
  }
  .twk-lbl {
    display: flex; justify-content: space-between; align-items: baseline;
    font-family: var(--sans); font-size: 11px; letter-spacing: 0.02em;
    color: var(--ink);
  }
  .twk-val { color: var(--ink-3); font-variant-numeric: tabular-nums; }

  .twk-seg {
    position: relative; display: flex; padding: 2px;
    border-radius: 3px;
    background: var(--paper-2);
    border: 1px solid var(--rule);
    user-select: none;
  }
  .twk-seg-thumb {
    position: absolute; top: 2px; bottom: 2px; border-radius: 2px;
    background: var(--ink);
    transition: left 0.15s cubic-bezier(.3,.7,.4,1), width 0.15s;
  }
  .twk-seg.dragging .twk-seg-thumb { transition: none; }
  .twk-seg button {
    appearance: none; position: relative; z-index: 1;
    flex: 1; border: 0; background: transparent;
    color: var(--ink-3);
    font-family: var(--sans); font-size: 11px; letter-spacing: 0.02em;
    font-weight: 400; min-height: 26px;
    border-radius: 2px; cursor: default; padding: 4px 8px;
    line-height: 1.2; transition: color 0.12s;
  }
  .twk-seg button[aria-checked="true"] { color: var(--paper); }

  .twk-toggle {
    position: relative; width: 34px; height: 20px;
    border: 1px solid var(--rule); border-radius: 999px;
    background: var(--paper-2);
    transition: background 0.15s, border-color 0.15s;
    cursor: default; padding: 0; flex-shrink: 0;
  }
  .twk-toggle[data-on="1"] { background: var(--ok); border-color: transparent; }
  .twk-toggle i {
    position: absolute; top: 2px; left: 2px;
    width: 14px; height: 14px; border-radius: 50%;
    background: var(--ink-3); display: block;
    transition: transform 0.15s, background 0.15s;
  }
  .twk-toggle[data-on="1"] i { transform: translateX(14px); background: var(--paper); }

`;

const CUSTOMIZE_LS_KEY = 'dashboard:customize';

function lsLoad(defaults) {
  try {
    const raw = localStorage.getItem(CUSTOMIZE_LS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch { return defaults; }
}

function lsSave(values) {
  try { localStorage.setItem(CUSTOMIZE_LS_KEY, JSON.stringify(values)); } catch {}
}

export function useCustomize(defaults) {
  const [values, setValues] = useState(() => lsLoad(defaults));
  const setCustomize = useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => {
      const next = { ...prev, ...edits };
      lsSave(next);
      return next;
    });
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
  }, []);
  return [values, setCustomize];
}

export function CustomizeColumn({ wide, children }) {
  return <div className={wide ? 'twk-col twk-col-wide' : 'twk-col'}>{children}</div>;
}

export function CustomizePanel({ title = 'Options', side = 'top', children }) {
  const devMode = new URLSearchParams(window.location.search).has('dev');
  const [open, setOpen] = useState(devMode);

  useEffect(() => {
    const onMsg = (e) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key === '`') setOpen(v => !v);
      else if (e.key === 'h' || e.key === 'H' || e.key === '?') setOpen(v => !v);
      else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  return (
    <>
      <style>{__CUSTOMIZE_STYLE}</style>
      {open && <div className="twk-scrim" onClick={dismiss} />}
      <div className={`twk-drawer${open ? ' open' : ''}`} data-side={side} data-noncommentable="">
        <div className="twk-body">{children}</div>
      </div>
    </>
  );
}

export function CustomizeSection({ label, children }) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

export function CustomizeRow({ label, value, children, inline = false }) {
  return (
    <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

export function CustomizeToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button" className="twk-toggle" data-on={value ? '1' : '0'}
              role="switch" aria-checked={!!value}
              onClick={() => onChange(!value)}><i /></button>
    </div>
  );
}

export function CustomizeRadio({ label, value, options, onChange }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const valueRef = useRef(value);
  valueRef.current = value;

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <CustomizeRow label={label}>
      <div ref={trackRef} role="radiogroup" onPointerDown={onPointerDown}
           className={dragging ? 'twk-seg dragging' : 'twk-seg'}>
        <div className="twk-seg-thumb"
             style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
                      width: `calc((100% - 4px) / ${n})` }} />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </CustomizeRow>
  );
}

