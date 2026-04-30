import { useEffect } from 'react';

const DOZZLE_BASE = "https://logs.vaultrona.com";

export default function Dozzle({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`dozzle-scrim ${open ? "open" : ""}`} onClick={onClose}></div>
      <aside className={`dozzle ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="dozzle-hd">
          <div className="title">
            <b>dozzle</b>
            <span className="url">{DOZZLE_BASE}</span>
          </div>
          <button className="dozzle-close" onClick={onClose}>close · esc</button>
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
