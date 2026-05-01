import { useEffect, useRef } from 'react';

const DOZZLE_BASE = import.meta.env.VITE_DOZZLE_URL ?? "";

export default function Dozzle({ open, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="dozzle-scrim" onClick={onClose} />}
      <aside className={`dozzle ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="dozzle-hd">
          <div className="dozzle-title">
            <span className="dozzle-label">logs</span>
            {DOZZLE_BASE && <span className="dozzle-url">{DOZZLE_BASE}</span>}
          </div>
          <button ref={closeRef} className="dozzle-close" onClick={onClose}>esc</button>
        </div>
        <iframe
          src={open ? DOZZLE_BASE : undefined}
          title="Dozzle log viewer"
          className="dozzle-frame"
          allow="fullscreen"
        />
      </aside>
    </>
  );
}
