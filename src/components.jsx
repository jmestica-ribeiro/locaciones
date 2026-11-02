import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/* ============================================================
   Iconos (SVG inline, stroke) + primitivos compartidos
   ============================================================ */
export const Icon = ({ name, size = 22, style }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", style };
  const paths = {
    home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>,
    projects: <><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    report: <><path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M9.5 8h5M9.5 12h5M9.5 16h3" /></>,
    resources: <><path d="M14.7 6.3a4 4 0 0 0-5.6 5.6l-6 6 2 2 6-6a4 4 0 0 0 5.6-5.6l-2.3 2.3-1.7-1.7Z" /></>,
    chart: <><path d="M3 3v18h18" /><path d="M7 14v4M12 9v9M17 5v13" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 4v4h-4" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 20v-4h4" /></>,
    inbox: <><path d="M3 12h5l2 3h4l2-3h5" /><path d="M5 6h14l2 6v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6Z" /></>,
    pin: <><path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    chevL: <path d="M15 6l-6 6 6 6" />,
    chevR: <path d="M9 6l6 6-6 6" />,
    chevDown: <path d="M6 9l6 6 6-6" />,
    chevUp: <path d="M18 15l-6-6-6 6" />,
    wifiOff: <><line x1="1" y1="1" x2="23" y2="23" /><path d="M16.7 16.7A8 8 0 0 0 5.3 5.3M10.7 5.1A12 12 0 0 1 22.6 9M1.4 9a12 12 0 0 1 5.3-3.7M10.7 13A4 4 0 0 1 16 18M5 12.9A8 8 0 0 0 8 15" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></>,
    bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>,
    truck: <><path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
    box: <><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
    filter: <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />,
    sort: <><path d="M7 4v16M3 8l4-4 4 4" /><path d="M17 20V4M13 16l4 4 4-4" /></>,
    calendar: <><rect x="3" y="4.5" width="18" height="17" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></>,
    paperclip: <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10 17.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5M3 17l9 5 9-5" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
    gauge: <><path d="M12 14 18 8" /><circle cx="12" cy="14" r="1.6" /><path d="M5 18a8 8 0 1 1 14 0" /></>,
    cloud: <path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9.5a3.5 3.5 0 0 1-.5 8.5H7Z" />,
    upload: <><path d="M12 16V4M8 8l4-4 4 4" /><path d="M5 20h14" /></>,
    download: <><path d="M12 4v12M8 12l4 4 4-4" /><path d="M5 20h14" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a7.5 7.5 0 0 0-1.7 1l-2.3-1-2 3.4L4.6 11a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.5 7.5 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.5 7.5 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5Z" /></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></>,
    camera: <><path d="M4 8h3l1.5-2h7L17 8h3a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 8Z" /><circle cx="12" cy="14" r="3.5" /></>,
  };
  return <svg {...p}>{paths[name] || null}</svg>;
};

export const Logo = ({ size = 26 }) => (
  <img src="/assets/ribeiro-logo.png" alt="RIBEIRO" width={size} height={size}
    style={{ display: "block", objectFit: "contain" }} />
);

export function clsx(...a) { return a.filter(Boolean).join(" "); }
export function abbr(code) { return (code || "").split("-")[0].slice(0, 4); }
export function fmt(n) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}

export const NAV = [
  { id: "projects", path: "/proyectos", icon: "projects", label: "Proyectos" },
  { id: "novedades", path: "/novedades", icon: "clock", label: "Novedades" },
  { id: "recursos", path: "/recursos",  icon: "resources", label: "Recursos"  },
];

/* ---------------------------------------------------------- Sidebar */
export function Sidebar({ compact, outbox, isOnline, lastSync, onToggle, isAdmin }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = (path) => pathname === path || (path === "/proyectos" && pathname.startsWith("/proyectos"));
  return (
    <aside className={clsx("sidebar", compact && "compact")}>
      <button className="brand" onClick={() => navigate("/proyectos")} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "inherit", font: "inherit" }}>
        <div className="brand-logo"><Logo /></div>
        <div className="brand-name">RIBEIRO<small>LOCACIONES</small></div>
      </button>
      <button className="sb-toggle" onClick={onToggle} title="Contraer / expandir">
        <Icon name="chevL" size={15} />
      </button>

      <div className="nav-label">Operación</div>
      <nav className="nav">
        {NAV.filter((n) => !n.wip).map((n) => (
          <button key={n.id} className={clsx("nav-item", active(n.path) && "active")} onClick={() => navigate(n.path)}>
            <Icon name={n.icon} size={21} />
            <span className="label">{n.label}</span>
            {n.path === "/proyectos" && outbox > 0 && <span className="nav-badge alert">{outbox}</span>}
          </button>
        ))}
      </nav>

      {isAdmin && (
        <>
          <div className="nav-label">Administración</div>
          <nav className="nav">
            <button className={clsx("nav-item", active("/configuracion") && "active")} onClick={() => navigate("/configuracion")}>
              <Icon name="settings" size={21} /><span className="label">Configuración</span>
            </button>
          </nav>
        </>
      )}

      <div className="sidebar-foot">
        <div className={clsx("conn", !isOnline && "conn-offline")}>
          <span className="dot"></span>
          <div className="txt">
            <b>{isOnline ? "CONECTADO" : "SIN CONEXIÓN"}</b>
            <span>
              {isOnline
                ? lastSync ? `Sync · ${lastSync}` : "En línea"
                : outbox > 0 ? `${outbox} parte${outbox !== 1 ? "s" : ""} pendiente${outbox !== 1 ? "s" : ""}` : "Datos en caché"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ---------------------------------------------------------- Notificaciones */
export function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

export function NotificationBell({ notifications = [], unreadCount = 0, onMarkRead, onMarkAllRead }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button className="icon-btn" title="Notificaciones" onClick={() => setOpen((v) => !v)}>
        <Icon name="inbox" size={19} />
        {unreadCount > 0 && <span className="ping" />}
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 39 }} onClick={() => setOpen(false)} />
          <div className="notif-menu">
            <div className="notif-menu-head">
              <div className="user-menu-name">Notificaciones</div>
              {unreadCount > 0 && (
                <button className="notif-mark-all" onClick={onMarkAllRead}>Marcar todas como leídas</button>
              )}
            </div>
            <div className="notif-list">
              {notifications.length === 0 && (
                <div className="notif-empty">Sin notificaciones</div>
              )}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className={clsx("notif-item", !n.leida && "notif-item-unread")}
                  onClick={() => !n.leida && onMarkRead?.(n.id)}
                >
                  <span className={clsx("notif-dot", n.tipo === "npt" && "notif-dot-npt")} />
                  <div className="notif-body">
                    <span className="notif-title">{n.titulo}</span>
                    <span className="notif-msg">{n.mensaje}</span>
                    <span className="notif-time">{timeAgo(n.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- Topbar */
export function Topbar({ crumbs, title, outbox, meta, onOutbox, isOnline, profile, onSignOut, projects, notif }) {
  const navigate = useNavigate();
  const backCrumb = crumbs && [...crumbs].reverse().find((c) => c.to);
  const [showMenu, setShowMenu] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [showResults, setShowResults] = React.useState(false);
  const searchRef = React.useRef(null);

  const results = React.useMemo(() => {
    if (!query.trim() || !projects?.length) return [];
    const q = query.toLowerCase();
    const out = [];
    projects.forEach((p) => {
      if (p.code?.toLowerCase().includes(q) || p.location?.toLowerCase().includes(q) || p.client?.toLowerCase().includes(q)) {
        out.push({ type: "proyecto", label: p.code, sub: `${p.location} · ${p.client}`, to: `/proyectos/${p.id}`, color: p.color });
      }
      p.etapas?.forEach((e) => {
        if (e.name?.toLowerCase().includes(q) || e.tag?.toLowerCase().includes(q)) {
          out.push({ type: "etapa", label: e.name, sub: `${p.code} · ${e.tag || "Sin fase"}`, to: `/proyectos/${p.id}/etapas/${e.id}`, color: e.color });
        }
      });
    });
    return out.slice(0, 8);
  }, [query, projects]);

  const handleSelect = (to) => {
    navigate(to);
    setQuery("");
    setShowResults(false);
  };

  React.useEffect(() => {
    const handler = (e) => { if (!searchRef.current?.contains(e.target)) setShowResults(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = profile?.nombre
    ? profile.nombre.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  return (
    <header className="topbar">
      <div style={{ minWidth: 0 }}>
        {crumbs && crumbs.length > 0 && (
          <div className="crumbs">
            {backCrumb && (
              <button className="back-btn" onClick={() => navigate(backCrumb.to)}>
                <Icon name="chevL" size={15} />
                <span>Volver a {backCrumb.label}</span>
              </button>
            )}
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="crumb-sep">/</span>}
                <button className="crumb" onClick={() => c.to && navigate(c.to)}>{c.label}</button>
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="title-row">
          <h1 className="page-title">{title}</h1>
          {meta && meta.length > 0 && (
            <div className="title-meta">
              {meta.map((m, i) => (
                <span className="tm-item" key={i} style={m.accent ? { color: m.accent } : null}>
                  {m.dot ? <span className="status-dot" style={{ background: m.dot }} /> : <Icon name={m.icon} size={14} />}
                  <span className="tm-lbl">{m.label}</span>
                  <b>{m.value}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="topbar-spacer" />
      <div className="search" ref={searchRef} style={{ position: "relative" }}>
        <Icon name="search" size={17} />
        <input
          placeholder="Buscar proyecto, etapa…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => query && setShowResults(true)}
          onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); setShowResults(false); } }}
        />
        {query && (
          <button style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "var(--ink-3)", display: "grid", placeItems: "center" }}
            onClick={() => { setQuery(""); setShowResults(false); }}>
            <Icon name="x" size={14} />
          </button>
        )}
        {showResults && results.length > 0 && (
          <div className="search-dropdown">
            {results.map((r, i) => (
              <button key={i} className="search-result" onClick={() => handleSelect(r.to)}>
                <span className="sr-dot" style={{ background: r.color }} />
                <div className="sr-body">
                  <span className="sr-label">{r.label}</span>
                  <span className="sr-sub">{r.sub}</span>
                </div>
                <span className="sr-type">{r.type}</span>
              </button>
            ))}
          </div>
        )}
        {showResults && query.trim() && results.length === 0 && (
          <div className="search-dropdown">
            <div style={{ padding: "14px 16px", fontSize: 13, color: "var(--on-cream-2)", textAlign: "center" }}>Sin resultados</div>
          </div>
        )}
      </div>
      <button
        className="icon-btn"
        title={
          !isOnline
            ? `Sin conexión${outbox > 0 ? ` — ${outbox} parte(s) pendiente(s)` : " — trabajando offline"}`
            : outbox > 0
              ? `Sincronizar ${outbox} parte(s) pendiente(s)`
              : "Todo sincronizado"
        }
        onClick={outbox > 0 && isOnline ? onOutbox : undefined}
        style={!(outbox > 0 && isOnline) ? { opacity: 0.55, cursor: "default" } : undefined}
      >
        <Icon name={!isOnline ? "wifiOff" : outbox > 0 ? "cloud" : "checkCircle"} size={19} />
        {outbox > 0 && <span className={clsx("ping", !isOnline && "ping-offline")} />}
      </button>

      {notif && (
        <NotificationBell
          notifications={notif.items}
          unreadCount={notif.unreadCount}
          onMarkRead={notif.markRead}
          onMarkAllRead={notif.markAllRead}
        />
      )}

      {/* Avatar + menú de usuario */}
      <div style={{ position: "relative" }}>
        <button
          className="avatar"
          title={profile?.nombre || "Usuario"}
          onClick={() => setShowMenu((v) => !v)}
          style={{ cursor: "pointer" }}
        >
          {initials}
        </button>

        {showMenu && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 39 }} onClick={() => setShowMenu(false)} />
            <div className="user-menu">
              <div className="user-menu-head">
                <div className="user-menu-name">{profile?.nombre || "Usuario"}</div>
                <span className={clsx("pill", profile?.rol === "admin" ? "pill-gold" : "pill-dim")} style={{ fontSize: 10.5 }}>
                  {profile?.rol || "operador"}
                </span>
              </div>
              <button className="user-menu-item" onClick={() => { setShowMenu(false); onSignOut?.(); }}>
                <Icon name="x" size={15} /> Cerrar sesión
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

/* ---------------------------------------------------------- Heatmap de actividad */
export function ActividadHeatmap({ diasConCarga, title = "Actividad de carga", subtitle = "Últimos 14 días · partes diarios", className, style }) {
  const days = React.useMemo(() => {
    const arr = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      arr.push({
        iso,
        dayNum: d.getDate(),
        weekday: d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""),
        active: diasConCarga?.has(iso),
      });
    }
    return arr;
  }, [diasConCarga]);

  return (
    <section className={clsx("card", className)} style={style}>
      <div className="card-head">
        <div className="ch-icon"><Icon name="calendar" size={20} /></div>
        <div><h2>{title}</h2><div className="ch-sub">{subtitle}</div></div>
      </div>
      <div className="heatmap-14">
        {days.map((d) => (
          <div key={d.iso} className="hm-cell" title={`${d.iso} — ${d.active ? "Hubo carga de partes" : "Sin carga de partes"}`}>
            <div className={clsx("hm-box", d.active ? "hm-on" : "hm-off")} />
            <div className="hm-wd">{d.weekday}</div>
            <div className="hm-day">{d.dayNum}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Small bits */
export function Bar({ pct, color }) {
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: Math.min(100, pct) + "%", background: color ? `linear-gradient(90deg, ${color}, ${color})` : undefined }} />
    </div>
  );
}

export function Toast({ msg, onDone }) {
  React.useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="toast">
      <span className="ti"><Icon name="checkCircle" size={20} /></span>
      {msg}
    </div>
  );
}

export function SyncPrompt({ outbox, onSync, onDismiss }) {
  const [syncing, setSyncing] = React.useState(false);
  const handleSync = async () => {
    setSyncing(true);
    await onSync();
  };
  return (
    <>
      <div className="sync-prompt-scrim" onClick={onDismiss} />
      <div className="sync-prompt">
        <div className="sp-icon">
          <Icon name="cloud" size={24} />
        </div>
        <div className="sp-body">
          <h3>Conexión restaurada</h3>
          <p>Tenés <b>{outbox} parte{outbox !== 1 ? "s" : ""}</b> guardado{outbox !== 1 ? "s" : ""} sin sincronizar. ¿Querés enviarlo{outbox !== 1 ? "s" : ""} ahora?</p>
        </div>
        <div className="sp-actions">
          <button className="btn btn-cream btn-sm" onClick={onDismiss} disabled={syncing}>
            Más tarde
          </button>
          <button className="btn btn-gold btn-sm" onClick={handleSync} disabled={syncing}>
            <Icon name="refresh" size={15} style={{ animation: syncing ? "spin 0.7s linear infinite" : "none" }} />
            {syncing ? "Sincronizando…" : `Sincronizar ${outbox} parte${outbox !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </>
  );
}

export function Kpi({ icon, tint, val, suffix, label, trend }) {
  return (
    <div className="kpi">
      <div className="kpi-ic" style={{ background: tint + "26", color: tint }}><Icon name={icon} size={19} /></div>
      <div className="kpi-val">{val}{suffix && <small>{suffix}</small>}</div>
      <div className="kpi-lbl">{label}</div>
      {trend && <div className="kpi-trend" style={{ color: "#74c074" }}>{trend}</div>}
    </div>
  );
}
