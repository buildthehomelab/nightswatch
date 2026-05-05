import { useEffect } from 'react';
import { DEMO } from '../nwenv';

export default function SandboxPanel({ open, onClose, url, label, side = 'right' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const hostname = (() => {
    if (!url) return '';
    try { return new URL(url).hostname; } catch { return url; }
  })();

  return (
    <>
      <div className={`sbx-scrim${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`sbx sbx--${side}${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="sbx-hd">
          <div className="sbx-title">
            <span className="sbx-label">{label || 'panel'}</span>
            {hostname && <span className="sbx-url">{hostname}</span>}
          </div>
          <button className="sbx-close" onClick={onClose}>close · esc</button>
        </div>
        <div className="sbx-body">
          {DEMO || !url ? (
            <div className="sbx-placeholder">no url configured — set one in customize</div>
          ) : (
            <iframe
              src={open ? url : undefined}
              title={label || 'panel'}
              className="sbx-frame"
              sandbox="allow-scripts allow-same-origin allow-forms"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
      </aside>
    </>
  );
}
