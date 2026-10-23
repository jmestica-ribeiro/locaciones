import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon, Bar, clsx, fmt } from '../components.jsx';
import { useProjects } from '../context/ProjectsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ParteBuilder } from '../drawers/ParteBuilder.jsx';

export function ResCell({ icon, val, suffix, label, small, accent }) {
  return (
    <div className="res-cell">
      <div className="rc-val" style={{ fontSize: small ? 30 : undefined, color: accent }}>
        {val}{suffix && <span style={{ fontSize: 18, color: "var(--ink-3)" }}>{suffix}</span>}
      </div>
      <div className="rc-lbl">{icon && <Icon name={icon} size={14} />}{label}</div>
    </div>
  );
}

export function ProjectDetail() {
  const { pid } = useParams();
  const navigate = useNavigate();
  const { projects, partes, saveParte } = useProjects();
  const { isAdmin } = useAuth();
  const project = projects.find((p) => p.id === pid);

  const [sortBy, setSortBy] = useState("orden");
  const [tagFilter, setTagFilter] = useState("Todas");
  const [drawer, setDrawer] = useState(null);

  if (!project) return (
    <div style={{ padding: 40, textAlign: "center", opacity: 0.5 }}>
      <Icon name="refresh" size={28} style={{ animation: "spin 0.7s linear infinite" }} />
    </div>
  );

  const tags = ["Todas", ...Array.from(new Set(project.etapas.map((e) => e.tag).filter(Boolean)))];
  let etapas = project.etapas.filter((e) => tagFilter === "Todas" || e.tag === tagFilter);
  etapas = [...etapas].sort((a, b) => {
    if (sortBy === "avance") return (b.done / b.total) - (a.done / a.total);
    if (sortBy === "pendiente") return (a.done / a.total) - (b.done / b.total);
    return 0;
  });

  const r = project.recursos;

  const handleSaveParte = (parte) => {
    saveParte(parte, project.id);
    setDrawer(null);
  };

  return (
    <div className="fade-in">
      <div className="stats-strip">
        <section className="card">
          <div className="card-head">
            <div className="ch-icon"><Icon name="resources" size={20} /></div>
            <div><h2>Recursos</h2><div className="ch-sub">Asignados hoy en obra</div></div>
          </div>
          <div className="card-pad" style={{ paddingTop: 4 }}>
            <div className="res-row">
              <ResCell icon="truck" val={r.maquinas} label="Máquinas" small />
              <ResCell icon="user" val={r.personas} label="Personas" small />
              <ResCell icon="box" val={r.materiales} label="Materiales" small />
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div className="ch-icon"><Icon name="chart" size={20} /></div>
            <div><h2>Avances</h2><div className="ch-sub">Estado general de la obra</div></div>
            <div className="ch-right">
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/proyectos/${pid}/tablero`)}>
                <Icon name="chart" size={15} /> Tablero
              </button>
            </div>
          </div>
          <div className="card-pad" style={{ paddingTop: 4 }}>
            <div className="res-row">
              <ResCell val={project.etapasPlan} label="Planificadas" small />
              <ResCell val={project.etapasFin} label="Finalizadas" small />
              <ResCell val={project.progress} suffix="%" label="Total obra" small accent={project.color} />
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div className="ch-icon"><Icon name="layers" size={20} /></div>
          <div>
            <h2>Etapas</h2>
            <div className="ch-sub">{project.etapas.length} etapas · {project.etapasFin} finalizadas</div>
          </div>
          <div className="ch-right">
            {isAdmin && (
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/proyectos/${pid}/config`)}>
                <Icon name="settings" size={15} /> Configurar
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/proyectos/${pid}/historial`)}>
              <Icon name="clock" size={15} /> Historial
            </button>
            <button className="btn btn-gold btn-sm" onClick={() => setDrawer("parte")}>
              <Icon name="plus" size={15} /> Cargar parte diario
            </button>
          </div>
        </div>

        <div className="etapa-tools">
          <div className="seg">
            {["orden", "avance", "pendiente"].map((s) => (
              <button key={s} className={clsx(sortBy === s && "on")} onClick={() => setSortBy(s)}>
                {s === "orden" ? "Orden" : s === "avance" ? "+ Avance" : "Pendientes"}
              </button>
            ))}
          </div>
          <div className="seg">
            {tags.map((t) => (
              <button key={t} className={clsx(tagFilter === t && "on")} onClick={() => setTagFilter(t)}>
                {t === "Todas" ? "Todas" : t.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="etapas etapas-wide">
          {etapas.length === 0 && (
            <div style={{ padding: "36px 24px", textAlign: "center", opacity: 0.45 }}>
              {isAdmin ? (
                <>
                  Sin etapas configuradas.{" "}
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/proyectos/${pid}/config`)}>
                    Configurar
                  </button>
                </>
              ) : (
                "Sin etapas configuradas. Pedile a un administrador que las cargue."
              )}
            </div>
          )}
          {etapas.map((e) => {
            const pct = e.total ? Math.round((e.done / e.total) * 100) : 0;
            return (
              <div key={e.id} className="etapa" onClick={() => navigate(`/proyectos/${pid}/etapas/${e.id}`)}>
                <div className="et-ic" style={{ background: e.color + "22", color: e.color }}>
                  <Icon name={pct >= 100 ? "checkCircle" : pct === 0 ? "clock" : "sun"} size={20} />
                </div>
                <div className="et-main">
                  <div className="et-tag">{e.tag}</div>
                  <div className="et-name">{e.name}</div>
                  <div className="et-prog">
                    <Bar pct={pct} color={e.color} />
                    <span className="et-num">{fmt(e.done)} / {fmt(e.total)} {e.unit}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="et-pct" style={{ color: e.color }}>{pct}%</div>
                  <Icon name="chevR" size={18} style={{ color: "var(--ink-3)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {drawer === "parte" && (
        <ParteBuilder project={project} onClose={() => setDrawer(null)} onSave={handleSaveParte} />
      )}
    </div>
  );
}
