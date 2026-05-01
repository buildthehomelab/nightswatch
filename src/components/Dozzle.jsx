import { useEffect } from 'react';

const DOZZLE_BASE = import.meta.env.VITE_DOZZLE_URL ?? "";

export default function Dozzle({ open, onClose }) {

  useEffect(() => {
    if (!open) return;
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
          </div>
          <button className="dozzle-close" onClick={onClose}>esc</button>
        </div>
        <iframe
          src={open ? DOZZLE_BASE : undefined}
          title="Dozzle log viewer"
          className="dozzle-frame"
          sandbox="allow-scripts allow-same-origin allow-forms"
          referrerPolicy="no-referrer"
        />
      </aside>
    </>
  );
}
