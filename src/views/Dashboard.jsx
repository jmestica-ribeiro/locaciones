import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, Bar, ActividadHeatmap, clsx, abbr, fmt } from '../components.jsx';
import { useProjects } from '../context/ProjectsContext.jsx';
import { NuevoProyecto } from '../drawers/NuevoProyecto.jsx';
import { outboxGetAll } from '../db.js';

export function ProjectsHome() {
  const { projects, dbLoaded, syncOutbox, outbox, isOnline, createProject, diasConCarga } = useProjects();
  const navigate = useNavigate();
  const [reloading, setReloading] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [buzonOpen, setBuzonOpen] = useState(false);
  const [buzonItems, setBuzonItems] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const loadBuzonItems = useCallback(async () => {
    const items = await outboxGetAll();
    setBuzonItems(items);
  }, []);

  // Reload items whenever outbox count changes or panel opens
  useEffect(() => {
    if (buzonOpen || outbox > 0) loadBuzonItems();
  }, [outbox, buzonOpen, loadBuzonItems]);

  const handleSync = async () => {
    setSyncing(true);
    await syncOutbox();
    await loadBuzonItems();
    setSyncing(false);
  };

  const reload = () => { setReloading(true); setTimeout(() => setReloading(false), 700); };

  const handleCreate = async (form) => {
    await createProject(form);
    setDrawer(false);
  };

  // KPIs globales
  const totalEtapas = projects.reduce((s, p) => s + p.etapas.length, 0);
  const avgProgress = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
    : 0;
  const enCurso = projects.filter((p) => p.status === "En curso").length;

  return (
    <div className="fade-in">

      {/* KPIs globales + Buzón */}
      <div className="dash-kpis">
        <div className="dk-card">
          <div className="dk-icon" style={{ background: "rgba(231,177,58,0.15)", color: "var(--gold-deep)" }}>
            <Icon name="projects" size={18} />
          </div>
          <div>
            <div className="dk-val">{projects.length}</div>
            <div className="dk-lbl">Proyectos totales</div>
          </div>
        </div>
        <div className="dk-card">
          <div className="dk-icon" style={{ background: "rgba(91,159,212,0.15)", color: "#5b9fd4" }}>
            <Icon name="sun" size={18} />
          </div>
          <div>
            <div className="dk-val">{enCurso}</div>
            <div className="dk-lbl">En curso</div>
          </div>
        </div>
        <div className="dk-card">
          <div className="dk-icon" style={{ background: "rgba(116,192,116,0.15)", color: "var(--green)" }}>
            <Icon name="layers" size={18} />
          </div>
          <div>
            <div className="dk-val">{totalEtapas}</div>
            <div className="dk-lbl">Etapas totales</div>
          </div>
        </div>
        <div className="dk-card">
          <div className="dk-icon" style={{ background: "rgba(169,139,214,0.15)", color: "#a98bd6" }}>
            <Icon name="gauge" size={18} />
          </div>
          <div>
            <div className="dk-val">{avgProgress}%</div>
            <div className="dk-lbl">Avance promedio</div>
          </div>
        </div>

        {/* Buzón — 5.º KPI, clickeable para abrir panel */}
        <div
          className={clsx("dk-card", "dk-card-btn", outbox > 0 ? "dk-pending" : "dk-online")}
          onClick={() => setBuzonOpen((v) => !v)}
          title={outbox > 0 ? `${outbox} parte(s) pendiente(s) de sincronización` : "Todo sincronizado"}
        >
          <div className="dk-icon" style={outbox > 0
            ? { background: "rgba(226,73,59,0.15)", color: "var(--red)" }
            : { background: "rgba(116,192,116,0.15)", color: "var(--green)" }}>
            <Icon name={outbox > 0 ? "cloud" : "inbox"} size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="dk-val">{outbox}</div>
            <div className="dk-lbl" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {outbox > 0 ? "Pendientes sync" : "Sincronizado"}
            </div>
          </div>
        </div>
      </div>

      {/* Panel buzón — se despliega debajo de KPIs cuando está abierto */}
      {buzonOpen && (
        <div className="buzon-panel">
          <div className="buzon-panel-inner">
            {buzonItems.length === 0 ? (
              <div className="buzon-empty">
                <Icon name="check" size={20} />
                <span>No hay partes pendientes de sincronización</span>
              </div>
            ) : (
              <div className="buzon-list">
                {buzonItems.map((item) => (
                  <div key={item.id} className="buzon-item">
                    <div className="bi-head">
                      <span className="bi-project">{item.projectId}</span>
                      <span className="bi-fecha">{item.parte?.fecha || "—"}</span>
                    </div>
                    <div className="bi-avances">
                      {(item.parte?.avances || []).map((av, i) => (
                        <div key={i} className="bi-av">
                          <span className="bi-etapa">{av.etapaName ? `${av.etapaName}${av.fase ? ` — ${av.fase}` : ""}` : `NPT — ${av.npt?.motivo || ""}`}</span>
                          <span className="bi-val">{av.etapaName ? `+${av.valor} ${av.unit}` : `${av.npt?.horas || 0} hs`}</span>
                        </div>
                      ))}
                    </div>
                    {item.parte?.obs && <div className="bi-obs">{item.parte.obs}</div>}
                  </div>
                ))}
              </div>
            )}
            <div className="buzon-panel-footer">
              {!isOnline && (
                <div className="buzon-offline-notice">
                  <Icon name="wifiOff" size={14} />
                  <span>Sin conexión — los partes se sincronizarán automáticamente al reconectarse</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-cream btn-sm" onClick={() => setBuzonOpen(false)}>
                  Cerrar
                </button>
                <button
                  className={clsx("btn", isOnline ? "btn-gold" : "btn-cream", "btn-sm")}
                  onClick={handleSync}
                  disabled={!isOnline || syncing || outbox === 0}
                >
                  <Icon name="refresh" size={15} style={{ animation: syncing ? "spin 0.7s linear infinite" : "none" }} />
                  {syncing ? "Sincronizando…" : outbox === 0 ? "Todo al día" : `Sincronizar ${outbox} parte${outbox !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ActividadHeatmap diasConCarga={diasConCarga} style={{ marginBottom: 22 }} />

      {/* Proyectos */}
      <div>
        <div className="home-head">
          <div>
            <h2 className="home-h2">Tus obras</h2>
            <p className="home-sub">{projects.length} proyecto{projects.length !== 1 ? "s" : ""} · elegí uno para entrar</p>
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            <button className="btn btn-cream btn-sm" onClick={reload}>
              <Icon name="refresh" size={15} style={{ animation: (reloading || !dbLoaded) ? "spin 0.7s linear infinite" : "none" }} />
              {dbLoaded ? "Recargar" : "Cargando…"}
            </button>
            <button className="btn btn-gold btn-sm" onClick={() => setDrawer(true)}>
              <Icon name="plus" size={15} /> Nuevo proyecto
            </button>
          </div>
        </div>

        <div className="proj-grid">
          {dbLoaded && projects.length === 0 && (
            <div style={{ gridColumn: "1/-1", padding: "48px 0", textAlign: "center", opacity: 0.5 }}>
              <Icon name="layers" size={36} />
              <p style={{ marginTop: 12 }}>No hay proyectos todavía. Creá el primero.</p>
            </div>
          )}
          {projects.map((p) => (
            <button key={p.id} className="proj-tile" onClick={() => navigate(`/proyectos/${p.id}`)}>
              <div className="pt-top">
                <div className="proj-thumb" style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}aa)` }}>
                  {abbr(p.code)}
                </div>
                <div className="pt-id">
                  <div className="pn">{p.code}</div>
                  <div className="pl"><Icon name="pin" size={13} /> {p.location} · {p.client}</div>
                </div>
                <span className="pill pill-gold" style={{ fontSize: 11 }}>
                  <span className="status-dot" style={{ background: p.statusColor }} /> {p.status}
                </span>
              </div>

              <div className="pt-prog">
                <div className="pt-prog-head">
                  <span>Avance de obra</span>
                  <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 18, color: p.color }}>{p.progress}%</span>
                </div>
                <Bar pct={p.progress} color={p.color} />
              </div>

              <div className="pt-foot">
                <span className="pt-stat"><Icon name="layers" size={15} /> {p.etapas.length} etapas</span>
                <span className="pt-stat"><Icon name="truck" size={15} /> {p.recursos.maquinas} máq.</span>
                <span className="pt-stat"><Icon name="user" size={15} /> {p.recursos.personas} pers.</span>
                <span className="pt-enter">Entrar <Icon name="chevR" size={16} /></span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {drawer && <NuevoProyecto onClose={() => setDrawer(false)} onSave={handleCreate} />}
    </div>
  );
}
