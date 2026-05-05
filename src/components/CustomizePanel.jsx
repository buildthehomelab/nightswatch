import { useState, useRef, useEffect, useCallback, useId } from 'react';

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
  .twk-col-push { margin-left: auto; }

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

  .twk-subgroup {
    margin-left: 8px;
    padding-left: 10px;
    border-left: 2px solid var(--rule);
    display: flex;
    flex-direction: column;
    margin-top: 2px;
    margin-bottom: 2px;
  }

  .twk-bg-upload {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    width: 100%; padding: 11px 12px; box-sizing: border-box;
    border: 1px dashed var(--rule); border-radius: 3px; background: var(--paper-2);
    font-family: var(--sans); font-size: 11px; letter-spacing: 0.04em;
    color: var(--ink-3); cursor: default; transition: color 0.12s, border-color 0.12s;
  }
  .twk-bg-upload:hover { color: var(--ink); border-color: var(--ink-3); }

  .twk-bg-thumb-wrap {
    position: relative; border-radius: 3px; overflow: hidden;
    border: 1px solid var(--rule); margin-bottom: 10px;
  }
  .twk-bg-thumb { display: block; width: 100%; height: 76px; object-fit: cover; }
  .twk-bg-swap {
    position: absolute; bottom: 5px; right: 5px;
    background: rgba(0,0,0,0.55); color: rgba(255,255,255,0.85);
    font-family: var(--sans); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 3px 7px; border-radius: 2px; cursor: default;
    opacity: 0; transition: opacity 0.15s;
  }
  .twk-bg-thumb-wrap:hover .twk-bg-swap { opacity: 1; }

  .twk-bg-ctrl { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .twk-bg-lbl {
    font-family: var(--sans); font-size: 9.5px; letter-spacing: 0.09em; text-transform: uppercase;
    color: var(--ink-3); flex-shrink: 0; width: 36px;
  }
  .twk-bg-ctrl .twk-seg { flex: 1; }

  .twk-bg-pos-grid {
    display: grid; grid-template-columns: repeat(3, 18px); gap: 2px;
    padding: 5px; background: var(--paper-2);
    border: 1px solid var(--rule); border-radius: 3px;
  }
  .twk-bg-pos-dot {
    width: 18px; height: 18px; border: 0; background: transparent;
    cursor: default; padding: 0; border-radius: 2px;
    display: flex; align-items: center; justify-content: center;
  }
  .twk-bg-pos-dot::after {
    content: ''; width: 5px; height: 5px; border-radius: 50%;
    background: var(--ink-3); transition: background 0.1s, transform 0.1s;
  }
  .twk-bg-pos-dot[aria-pressed="true"]::after { background: var(--ok); transform: scale(1.4); }
  .twk-bg-pos-dot:hover::after { background: var(--ink-2); }
  .twk-bg-pos-dot[aria-pressed="true"]:hover::after { background: var(--ok); }

  .twk-bg-remove {
    appearance: none; width: 100%; border: 1px solid var(--rule); background: transparent;
    color: var(--ink-3); font-family: var(--sans); font-size: 10px;
    letter-spacing: 0.07em; text-transform: uppercase;
    padding: 5px 8px; border-radius: 3px; cursor: default; margin-top: 4px;
    transition: color 0.12s, border-color 0.12s;
  }
  .twk-bg-remove:hover { color: var(--crit); border-color: var(--crit); }
  .twk-bg-err { font-family: var(--sans); font-size: 10px; color: var(--crit); margin-top: 4px; }

  .twk-footer {
    position: absolute; bottom: 7px; right: 12px;
    display: flex; align-items: baseline; gap: 10px;
    pointer-events: auto;
  }
  .twk-ver {
    font-family: var(--mono); font-size: 9px;
    color: var(--ink-3); opacity: 0.35;
    letter-spacing: 0.06em;
  }
  .twk-input {
    width: 100%; box-sizing: border-box;
    appearance: none; border: 1px solid var(--rule);
    background: var(--paper-2); color: var(--ink);
    font-family: var(--mono); font-size: 11px;
    padding: 5px 8px; border-radius: 3px; outline: none;
    transition: border-color 0.12s;
  }
  .twk-input::placeholder { color: var(--ink-3); }
  .twk-input:focus { border-color: var(--accent); }

  .twk-src {
    font-family: var(--mono); font-size: 9px;
    color: var(--ink-3); opacity: 0.35;
    text-decoration: none; letter-spacing: 0.06em;
    transition: opacity 0.15s;
  }
  .twk-src:hover { opacity: 0.75; }

`;

const CUSTOMIZE_LS_KEY = 'nightswatch:customize';

function lsLoad(defaults) {
  if (import.meta.env.DEMO === 'true') return defaults;
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

export function CustomizeColumn({ wide, push, children }) {
  const cls = ['twk-col', wide && 'twk-col-wide', push && 'twk-col-push'].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}

export function CustomizePanel({ side = 'top', children }) {
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
        <div className="twk-footer">
          <span className="twk-ver">v{import.meta.env.VITE_APP_VERSION}</span>
          <a className="twk-src" href="https://github.com/buildthehomelab/nightswatch" target="_blank" rel="noopener noreferrer">source</a>
        </div>
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

export function CustomizeInput({ label, value, onChange, placeholder }) {
  return (
    <div className="twk-row">
      <div className="twk-lbl"><span>{label}</span></div>
      <input
        type="text"
        className="twk-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? ''}
        spellCheck={false}
      />
    </div>
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

const FIT_OPTS = [
  { value: 'cover',   label: 'fill' },
  { value: 'contain', label: 'fit'  },
  { value: 'tile',    label: 'tile' },
];
const POS_GRID = [
  ['left top',    'center top',    'right top'   ],
  ['left center', 'center',        'right center'],
  ['left bottom', 'center bottom', 'right bottom'],
];
const DIM_OPTS = [
  { value: 0,    label: 'off'  },
  { value: 0.3,  label: 'mid'  },
  { value: 0.55, label: 'dark' },
];

export function BgImagePicker({ image, fit, position, dim, onImageChange, onChange }) {
  const id = useId();
  const [err, setErr] = useState('');

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1920;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        onImageChange(canvas.toDataURL('image/jpeg', 0.85));
        setErr('');
      };
      img.onerror = () => setErr('Failed to load image');
      img.src = ev.target.result;
    };
    reader.onerror = () => setErr('Failed to read file');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const fitIdx = Math.max(0, FIT_OPTS.findIndex(o => o.value === fit));
  const dimIdx = Math.max(0, DIM_OPTS.findIndex(o => o.value === dim));

  return (
    <div className="twk-row">
      <input id={id} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />

      {!image ? (
        <label htmlFor={id} className="twk-bg-upload">↑ upload image</label>
      ) : (<>
        <div className="twk-bg-thumb-wrap">
          <img className="twk-bg-thumb" src={image} alt="" />
          <label htmlFor={id} className="twk-bg-swap">swap</label>
        </div>

        <div className="twk-bg-ctrl">
          <span className="twk-bg-lbl">fit</span>
          <div className="twk-seg">
            <div className="twk-seg-thumb" style={{
              left: `calc(2px + ${fitIdx} * (100% - 4px) / 3)`,
              width: `calc((100% - 4px) / 3)`,
            }} />
            {FIT_OPTS.map(o => (
              <button key={o.value} type="button" role="radio" aria-checked={o.value === fit}
                      onClick={() => onChange({ bgFit: o.value })}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {fit !== 'tile' && (
          <div className="twk-bg-ctrl" style={{ alignItems: 'flex-start' }}>
            <span className="twk-bg-lbl" style={{ paddingTop: 5 }}>pos</span>
            <div className="twk-bg-pos-grid">
              {POS_GRID.map(row => row.map(pos => (
                <button key={pos} type="button" className="twk-bg-pos-dot"
                        aria-pressed={position === pos}
                        onClick={() => onChange({ bgPosition: pos })} />
              )))}
            </div>
          </div>
        )}

        <div className="twk-bg-ctrl">
          <span className="twk-bg-lbl">dim</span>
          <div className="twk-seg">
            <div className="twk-seg-thumb" style={{
              left: `calc(2px + ${dimIdx} * (100% - 4px) / 3)`,
              width: `calc((100% - 4px) / 3)`,
            }} />
            {DIM_OPTS.map(o => (
              <button key={o.value} type="button" role="radio" aria-checked={o.value === dim}
                      onClick={() => onChange({ bgDim: o.value })}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="twk-bg-remove" onClick={() => onImageChange('')}>
          remove image
        </button>
      </>)}

      {err && <div className="twk-bg-err">{err}</div>}
    </div>
  );
}
