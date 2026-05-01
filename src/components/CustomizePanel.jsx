import { useState, useRef, useEffect, useCallback } from 'react';

const __CUSTOMIZE_STYLE = `
  .twk-scrim {
    position: fixed; inset: 0; z-index: 2147483644;
  }

  .twk-drawer {
    position: fixed; left: 0; top: 0; height: 100vh; width: 370px;
    z-index: 2147483645;
    background: var(--paper);
    border-right: 0.5px solid var(--rule);
    display: flex; flex-direction: column;
    transform: translateX(-100%);
    transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
    overflow: hidden;
  }
  .twk-drawer.open { transform: translateX(0); }

  .twk-hd {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 20px 16px;
    border-bottom: 0.5px solid var(--rule);
    flex-shrink: 0;
  }
  .twk-title {
    font-family: var(--mono);
    font-size: 10px; font-weight: 500;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--ink-3);
  }
  .twk-x {
    appearance: none; border: 0; background: transparent;
    color: var(--ink-3); cursor: default;
    font-family: var(--mono); font-size: 9.5px;
    letter-spacing: 0.08em; text-transform: uppercase;
    padding: 0; line-height: 1; transition: color 0.12s;
  }
  .twk-x:hover { color: var(--ink); }

  .twk-body {
    padding: 20px 20px 28px; flex: 1;
    display: flex; flex-direction: column;
    overflow-y: auto; overflow-x: hidden;
    scrollbar-width: thin; scrollbar-color: var(--rule) transparent;
  }

  .twk-sect {
    font-family: var(--mono);
    font-size: 9px; font-weight: 500;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--ink-3);
    padding: 20px 0 8px;
    border-bottom: 0.5px solid var(--rule);
    margin-bottom: 14px;
  }

  .twk-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .twk-row-h {
    flex-direction: row; align-items: center;
    justify-content: space-between; gap: 10px; margin-bottom: 10px;
  }
  .twk-lbl {
    display: flex; justify-content: space-between; align-items: baseline;
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.02em;
    color: var(--ink);
  }
  .twk-val { color: var(--ink-3); font-variant-numeric: tabular-nums; }

  .twk-seg {
    position: relative; display: flex; padding: 2px;
    border-radius: 3px;
    background: var(--paper-2);
    border: 0.5px solid var(--rule);
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
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.02em;
    font-weight: 400; min-height: 26px;
    border-radius: 2px; cursor: default; padding: 4px 8px;
    line-height: 1.2; transition: color 0.12s;
  }
  .twk-seg button[aria-checked="true"] { color: var(--paper); }

  .twk-toggle {
    position: relative; width: 34px; height: 20px;
    border: 0.5px solid var(--rule); border-radius: 999px;
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

  .twk-field {
    appearance: none; width: 100%; height: 28px; padding: 0 8px;
    border: 0.5px solid var(--rule); border-radius: 3px;
    background: var(--paper-2); color: var(--ink);
    font-family: var(--mono); font-size: 11px; outline: none;
  }
  .twk-field:focus { border-color: var(--ink-3); }
  select.twk-field {
    padding-right: 22px;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(128,128,128,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat: no-repeat; background-position: right 8px center;
  }

  .twk-slider {
    appearance: none; -webkit-appearance: none;
    width: 100%; height: 2px; margin: 8px 0;
    border-radius: 999px; background: var(--rule); outline: none;
  }
  .twk-slider::-webkit-slider-thumb {
    -webkit-appearance: none; width: 14px; height: 14px;
    border-radius: 50%; background: var(--ink); cursor: default;
  }
  .twk-slider::-moz-range-thumb {
    width: 14px; height: 14px; border-radius: 50%;
    background: var(--ink); border: 0; cursor: default;
  }

  .twk-num {
    display: flex; align-items: center; height: 28px; padding: 0 0 0 8px;
    border: 0.5px solid var(--rule); border-radius: 3px;
    background: var(--paper-2);
  }
  .twk-num-lbl {
    font-family: var(--mono); font-size: 11px;
    color: var(--ink-2); cursor: ew-resize; user-select: none; padding-right: 8px;
  }
  .twk-num input {
    flex: 1; min-width: 0; height: 100%; border: 0;
    background: transparent; font-family: var(--mono); font-size: 11px;
    font-variant-numeric: tabular-nums; text-align: right; padding: 0 8px 0 0;
    outline: none; color: var(--ink); -moz-appearance: textfield;
  }
  .twk-num input::-webkit-inner-spin-button,
  .twk-num input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  .twk-num-unit { padding-right: 8px; color: var(--ink-3); font-family: var(--mono); font-size: 11px; }

  .twk-sub {
    padding-left: 12px;
    border-left: 0.5px solid var(--rule);
    margin-left: 4px;
    display: flex;
    flex-direction: column;
  }
  .twk-sub .twk-lbl { color: var(--ink-3); }

  .twk-btn {
    appearance: none; height: 28px; padding: 0 12px;
    border: 0.5px solid var(--rule); border-radius: 3px;
    background: var(--ink); color: var(--paper);
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.02em;
    cursor: default; transition: opacity 0.12s;
  }
  .twk-btn:hover { opacity: 0.75; }
  .twk-btn.secondary { background: var(--paper-2); color: var(--ink); }

  .twk-swatch {
    appearance: none; -webkit-appearance: none; width: 56px; height: 24px;
    border: 0.5px solid var(--rule); border-radius: 3px; padding: 0;
    cursor: default; background: transparent; flex-shrink: 0;
  }
  .twk-swatch::-webkit-color-swatch-wrapper { padding: 0; }
  .twk-swatch::-webkit-color-swatch { border: 0; border-radius: 2.5px; }
  .twk-swatch::-moz-color-swatch { border: 0; border-radius: 2.5px; }
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

export function CustomizePanel({ title = 'Customize', children }) {
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
      <div className={`twk-drawer${open ? ' open' : ''}`} data-noncommentable="">
        <div className="twk-hd">
          <span className="twk-title">{title}</span>
          <button className="twk-x" aria-label="Close customize" onClick={dismiss}>esc</button>
        </div>
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

export function CustomizeSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <CustomizeRow label={label} value={`${value}${unit}`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step}
             value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </CustomizeRow>
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

export function CustomizeSelect({ label, value, options, onChange }) {
  return (
    <CustomizeRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </CustomizeRow>
  );
}

export function CustomizeText({ label, value, placeholder, onChange }) {
  return (
    <CustomizeRow label={label}>
      <input className="twk-field" type="text" value={value} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
    </CustomizeRow>
  );
}

export function CustomizeNumber({ label, value, min, max, step = 1, unit = '', onChange }) {
  const clamp = (n) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = useRef({ x: 0, val: 0 });
  const onScrubStart = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
             onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
}

export function CustomizeColor({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <input type="color" className="twk-swatch" value={value}
             onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function CustomizeButton({ label, onClick, secondary = false }) {
  return (
    <button type="button" className={secondary ? 'twk-btn secondary' : 'twk-btn'}
            onClick={onClick}>{label}</button>
  );
}
