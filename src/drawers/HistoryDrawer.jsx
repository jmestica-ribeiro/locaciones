import React from 'react';
import { Icon } from '../components.jsx';

export function HistoryDrawer({ project, historial, onClose }) {
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer">
        <div className="drawer-head">
          <div className="ch-icon" style={{ background: "rgba(231,177,58,0.16)", color: "var(--gold-deep)" }}><Icon name="clock" size={20} /></div>
          <div style={{ flex: 1 }}>
            <h2>Historial de partes</h2>
            <p>{project.code} · {project.location}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="drawer-body" style={{ background: "var(--surface)", margin: 0 }}>
          <div className="timeline">
            {historial.map((day, i) => (
              <div className="tl-day" key={i}>
                <div className="tl-date"><Icon name="calendar" size={14} /> {day.date}</div>
                {day.entries.map((en, j) => (
                  <div className="tl-entry" key={j}>
                    <div>
                      <div className="te-name">{en.name}</div>
                      <div className="te-meta">{en.meta}</div>
                    </div>
                    <div className="te-delta">{en.delta}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
