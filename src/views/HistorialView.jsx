import React from 'react';
import { useParams } from 'react-router-dom';
import { useProjects } from '../context/ProjectsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getAvanceByProyecto, updateEstadoRevision, getFotosByParte, deleteFoto, deleteAvance, deleteRecursosByAvance } from '../supabase.js';
import { cacheGet, cacheSet } from '../db.js';
import { Icon, clsx, fmt } from '../components.jsx';
import { EditParteDrawer } from '../drawers/EditParteDrawer.jsx';
import { ExportParteModal } from '../drawers/ExportParteModal.jsx';
import { ExportCertificadoModal } from '../drawers/ExportCertificadoModal.jsx';

const fmtFecha = (s) => {
  try {
    return new Date(s + "T00:00:00").toLocaleDateString("es-AR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch { return s; }
};

const fmtShort = (s) => {
  try {
    const d = new Date(s + "T00:00:00");
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch { return s; }
};

const fmtCargado = (isoStr) => {
  try {
    const d = new Date(isoStr);
    const dia = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${dia} · ${hora} hs`;
  } catch { return null; }
};

const ESTADOS = ["SIN REVISAR", "REVISADO", "APROBADO", "RECHAZADO"];
const ESTADO_STYLE = {
  "SIN REVISAR": "pill-dim",
  "REVISADO":    "pill-gold",
  "APROBADO":    "pill-green",
  "RECHAZADO":   "pill pill-red",
};

export function FotasParte({ idParte, onCount }) {
  const [fotos, setFotos] = React.useState(null);
  const [lightbox, setLightbox] = React.useState(null);

  React.useEffect(() => {
    if (!idParte || idParte.startsWith("fecha:")) return;
    getFotosByParte(idParte).then((data) => {
      setFotos(data);
      onCount?.(data.length);
    }).catch(() => setFotos([]));
  }, [idParte]);

  const handleDelete = async (foto) => {
    try {
      await deleteFoto(foto.id, foto.url);
      setFotos((prev) => prev.filter((f) => f.id !== foto.id));
    } catch (e) { console.error(e); }
  };

  if (!fotos?.length) return null;

  return (
    <div className="hist-fotos">
      {fotos.map((f) => (
        <div key={f.id} className="hist-foto-wrap">
          <img src={f.url} alt={f.nombre} className="hist-foto-thumb" onClick={() => setLightbox(f)} />
          <button className="hist-foto-del" onClick={() => handleDelete(f)}>
            <Icon name="x" size={10} />
          </button>
        </div>
      ))}
      {lightbox && (
        <div className="foto-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox.url} alt={lightbox.nombre} />
        </div>
      )}
    </div>
  );
}

export function HistorialView() {
  const { pid } = useParams();
  const { projects } = useProjects();
  const { isAdmin } = useAuth();
  const project = projects.find((p) => p.id === pid);

  const [avances, setAvances] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(null);
  const [updatingEstado, setUpdatingEstado] = React.useState(null);
  const [editingParte, setEditingParte] = React.useState(null);
  const [exportingParte, setExportingParte] = React.useState(null);
  const [exportingCert, setExportingCert] = React.useState(false);
  const [fotosCounts, setFotosCounts] = React.useState({});
  const [confirmDelParte, setConfirmDelParte] = React.useState(null);
  const [deletingParte, setDeletingParte] = React.useState(false);

  // Filtros
  const [fechaDesde, setFechaDesde] = React.useState("");
  const [fechaHasta, setFechaHasta] = React.useState("");
  const [filtroEtapa, setFiltroEtapa] = React.useState("");
  const [filtroFase, setFiltroFase] = React.useState("");
  const [filtroEstado, setFiltroEstado] = React.useState("");
  const [filtroNPT, setFiltroNPT] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  React.useEffect(() => {
    if (!pid) return;
    setLoading(true);
    async function load() {
      try {
        const data = await getAvanceByProyecto(pid);
        await cacheSet(`avance_${pid}`, data);
        setAvances(data || []);
        if (data?.length) {
          const first = data[0];
          setExpanded(first.ID_Parte || `fecha:${first.fecha_avance}`);
        }
      } catch {
        const cached = await cacheGet(`avance_${pid}`);
        setAvances(cached || []);
        if (cached?.length) {
          const first = cached[0];
          setExpanded(first.ID_Parte || `fecha:${first.fecha_avance}`);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [pid]);

  // Opciones únicas para selects
  const etapasUnicas = React.useMemo(() =>
    [...new Set(avances.map((a) => a.nombre_etapa).filter(Boolean))].sort(), [avances]);
  const fasesUnicas = React.useMemo(() =>
    [...new Set(avances.map((a) => a.fase).filter(Boolean))].sort(), [avances]);

  // Aplicar filtros
  const avancesFiltrados = React.useMemo(() => {
    return avances.filter((a) => {
      if (fechaDesde && a.fecha_avance < fechaDesde) return false;
      if (fechaHasta && a.fecha_avance > fechaHasta) return false;
      if (filtroEtapa && a.nombre_etapa !== filtroEtapa) return false;
      if (filtroFase && a.fase !== filtroFase) return false;
      if (filtroEstado && (a.estado_revision || "SIN REVISAR") !== filtroEstado) return false;
      if (filtroNPT && !a.motivo_npt) return false;
      return true;
    });
  }, [avances, fechaDesde, fechaHasta, filtroEtapa, filtroFase, filtroEstado, filtroNPT]);

  const activeFilters = [fechaDesde, fechaHasta, filtroEtapa, filtroFase, filtroEstado, filtroNPT].filter(Boolean).length;

  const clearFilters = () => {
    setFechaDesde(""); setFechaHasta(""); setFiltroEtapa("");
    setFiltroFase(""); setFiltroEstado(""); setFiltroNPT(false);
  };

  // Agrupar por ID_Parte (si existe) o por fecha como fallback
  const byParte = React.useMemo(() => {
    const map = {};
    avancesFiltrados.forEach((a) => {
      const key = a.ID_Parte || `fecha:${a.fecha_avance || a.created_at?.slice(0, 10) || "sin fecha"}`;
      if (!map[key]) map[key] = { id: key, idCorto: a.ID_Parte ? a.ID_Parte.slice(0, 8).toUpperCase() : null, fecha: a.fecha_avance || a.created_at?.slice(0, 10), items: [] };
      map[key].items.push(a);
    });
    const sorted = Object.values(map).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    // Asignar número secuencial (más reciente = mayor número)
    const total = sorted.length;
    return sorted.map((p, i) => ({ ...p, num: total - i }));
  }, [avancesFiltrados]);

  const handleEstado = async (avanceId, estado) => {
    setUpdatingEstado(avanceId);
    try {
      await updateEstadoRevision(avanceId, estado);
      setAvances((prev) => prev.map((a) => a.id === avanceId ? { ...a, estado_revision: estado } : a));
    } catch (e) { console.error(e); }
    setUpdatingEstado(null);
  };

  const reloadAvances = async () => {
    setLoading(true);
    try {
      const data = await getAvanceByProyecto(pid);
      await cacheSet(`avance_${pid}`, data);
      setAvances(data || []);
    } catch {
      const cached = await cacheGet(`avance_${pid}`);
      setAvances(cached || []);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteParte = async (parte) => {
    setDeletingParte(true);
    try {
      for (const av of parte.items) {
        await deleteRecursosByAvance(av.id);
        await deleteAvance(av.id);
      }
      if (!parte.id.startsWith("fecha:")) {
        const fotos = await getFotosByParte(parte.id).catch(() => []);
        for (const foto of fotos) await deleteFoto(foto.id, foto.url).catch(() => {});
      }
      await reloadAvances();
    } catch (e) { console.error(e); }
    setDeletingParte(false);
    setConfirmDelParte(null);
  };

  if (!project) return null;

  return (
    <div className="fade-in">

      {/* ── Resumen de totales ── */}
      {!loading && avances.length > 0 && (() => {
        const totalPorEtapa = {};
        avancesFiltrados.forEach((a) => {
          if (!a.nombre_etapa) return; // filas "solo NPT"
          const key = a.nombre_etapa;
          if (!totalPorEtapa[key]) totalPorEtapa[key] = { val: 0, unit: a.UM || "" };
          totalPorEtapa[key].val += Number(a.total_avance) || 0;
        });
        const nptCount = avancesFiltrados.filter((a) => a.motivo_npt).length;
        const nptHoras = avancesFiltrados.reduce((s, a) => s + (Number(a.tiempo_npt) || 0), 0);
        const aprobados = avancesFiltrados.filter((a) => a.estado_revision === "APROBADO").length;
        return (
          <div className="hf-summary">
            <div className="hf-sum-kpis">
              <div className="hf-sum-kpi">
                <div className="hf-sum-val">{avancesFiltrados.length}</div>
                <div className="hf-sum-lbl"><Icon name="report" size={13} /> Registros</div>
              </div>
              <div className="hf-sum-kpi">
                <div className="hf-sum-val">{[...new Set(avancesFiltrados.map(a => a.fecha_avance).filter(Boolean))].length}</div>
                <div className="hf-sum-lbl"><Icon name="calendar" size={13} /> Fechas</div>
              </div>
              <div className="hf-sum-kpi" style={{ color: nptCount > 0 ? "#ff8a7a" : "inherit" }}>
                <div className="hf-sum-val">{nptCount}</div>
                <div className="hf-sum-lbl"><Icon name="alert" size={13} /> NPT{nptHoras > 0 ? ` · ${nptHoras} hs` : ""}</div>
              </div>
              <div className="hf-sum-kpi" style={{ color: "var(--green)" }}>
                <div className="hf-sum-val">{aprobados}</div>
                <div className="hf-sum-lbl"><Icon name="checkCircle" size={13} /> Aprobados</div>
              </div>
            </div>
            {Object.keys(totalPorEtapa).length > 0 && (
              <div className="hf-sum-etapas">
                {Object.entries(totalPorEtapa).map(([name, { val, unit }]) => (
                  <div key={name} className="hf-sum-etapa">
                    <span className="hf-sum-etapa-name">{name}</span>
                    <span className="hf-sum-etapa-val">{fmt(val)} <small>{unit}</small></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Barra de filtros ── */}
      <div className="hf-bar">
        <button
          className={clsx("btn btn-sm", filtersOpen ? "btn-dark" : "btn-cream")}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <Icon name="filter" size={15} />
          Filtros
          {activeFilters > 0 && <span className="hf-badge">{activeFilters}</span>}
        </button>

        {/* Chips de filtros activos */}
        <div className="hf-active">
          {fechaDesde && (
            <span className="hf-chip">Desde {fmtShort(fechaDesde)}
              <button onClick={() => setFechaDesde("")}><Icon name="x" size={11} /></button>
            </span>
          )}
          {fechaHasta && (
            <span className="hf-chip">Hasta {fmtShort(fechaHasta)}
              <button onClick={() => setFechaHasta("")}><Icon name="x" size={11} /></button>
            </span>
          )}
          {filtroEtapa && (
            <span className="hf-chip">{filtroEtapa}
              <button onClick={() => setFiltroEtapa("")}><Icon name="x" size={11} /></button>
            </span>
          )}
          {filtroFase && (
            <span className="hf-chip">{filtroFase}
              <button onClick={() => setFiltroFase("")}><Icon name="x" size={11} /></button>
            </span>
          )}
          {filtroEstado && (
            <span className="hf-chip">{filtroEstado}
              <button onClick={() => setFiltroEstado("")}><Icon name="x" size={11} /></button>
            </span>
          )}
          {filtroNPT && (
            <span className="hf-chip hf-chip-red">Solo NPT
              <button onClick={() => setFiltroNPT(false)}><Icon name="x" size={11} /></button>
            </span>
          )}
          {activeFilters > 1 && (
            <button className="hf-clear" onClick={clearFilters}>Limpiar todo</button>
          )}
        </div>

        <span className="hf-count">
          {avancesFiltrados.length} de {avances.length} avances
        </span>
        <button className="btn btn-sm" style={{ background: "#5b9fd4", color: "#fff", marginLeft: "auto" }}
          onClick={() => setExportingCert(true)}>
          <Icon name="upload" size={14} /> Exportar certificado
        </button>
      </div>

      {/* ── Panel de filtros expandible ── */}
      {filtersOpen && (
        <div className="hf-panel">
          <div className="hf-panel-grid">
            <div className="hf-field">
              <label>Desde</label>
              <input type="date" className="input" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </div>
            <div className="hf-field">
              <label>Hasta</label>
              <input type="date" className="input" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            </div>
            <div className="hf-field">
              <label>Etapa</label>
              <select className="select" value={filtroEtapa} onChange={(e) => setFiltroEtapa(e.target.value)}>
                <option value="">Todas</option>
                {etapasUnicas.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="hf-field">
              <label>Fase</label>
              <select className="select" value={filtroFase} onChange={(e) => setFiltroFase(e.target.value)}>
                <option value="">Todas</option>
                {fasesUnicas.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="hf-field">
              <label>Estado</label>
              <select className="select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos</option>
                {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="hf-field hf-field-check">
              <label>Solo con NPT</label>
              <button
                className={clsx("hf-toggle", filtroNPT && "on")}
                onClick={() => setFiltroNPT((v) => !v)}
              >
                {filtroNPT ? <Icon name="check" size={14} /> : null}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, opacity: 0.5 }}>
          <Icon name="refresh" size={26} style={{ animation: "spin 0.7s linear infinite" }} />
        </div>
      ) : byParte.length === 0 ? (
        <div className="hist-empty">
          <Icon name="clock" size={32} />
          <p>{activeFilters > 0 ? "Sin resultados para los filtros aplicados." : "No hay partes cargados para este proyecto."}</p>
          {activeFilters > 0 && <button className="btn btn-cream btn-sm" onClick={clearFilters}>Limpiar filtros</button>}
        </div>
      ) : (
        <div className="hist-timeline">
          {byParte.map((parte) => {
            const { id, idCorto, fecha, items, num } = parte;
            const isOpen = expanded === id;
            const tieneNPT = items.some((a) => a.motivo_npt);
            const sinRevisar = items.filter((a) => !a.estado_revision || a.estado_revision === "SIN REVISAR").length;
            const cargadoEn = items.reduce((min, a) => {
              if (!a.created_at) return min;
              return (!min || a.created_at < min) ? a.created_at : min;
            }, null);

            // Horas totales por recurso en este parte
            const horasPorRecurso = {};
            items.forEach((av) => {
              (av.Recursos || []).forEach((r) => {
                if (!r.total_hs) return;
                const key = r.detalle_recurso || "Sin nombre";
                if (!horasPorRecurso[key]) horasPorRecurso[key] = { nombre: key, horas: 0, tipo: r.tipo_recurso };
                horasPorRecurso[key].horas += Number(r.total_hs);
              });
            });
            const resumenRecursos = Object.values(horasPorRecurso).sort((a, b) => b.horas - a.horas);
            const totalHs = resumenRecursos.reduce((s, r) => s + r.horas, 0);

            return (
              <div key={id} className={clsx("hist-day", isOpen && "open")}>
                <div className="hist-day-head" onClick={() => setExpanded(isOpen ? null : id)}>
                  <div className="hist-day-date">
                    <div className="hist-day-dd">{fmtShort(fecha)}</div>
                    <div className="hist-day-label">{fmtFecha(fecha)}</div>
                    {cargadoEn && (
                      <div className="hist-day-cargado">
                        <Icon name="upload" size={11} /> Cargado {fmtCargado(cargadoEn)}
                      </div>
                    )}
                  </div>
                  <div className="hist-day-meta">
                    <span className="hist-parte-id">
                      P-{String(num).padStart(3, "0")}
                      {idCorto && <span style={{ opacity: 0.5, marginLeft: 4, fontSize: 9 }}>#{idCorto}</span>}
                    </span>
                    <span className="pill pill-dim">
                      <Icon name="report" size={12} /> {items.length} avance{items.length !== 1 ? "s" : ""}
                    </span>
                    {totalHs > 0 && (
                      <span className="pill pill-dim">
                        <Icon name="clock" size={12} /> {totalHs} hs
                      </span>
                    )}
                    {(fotosCounts[id] > 0) && (
                      <span className="pill pill-dim">
                        <Icon name="paperclip" size={12} /> {fotosCounts[id]} foto{fotosCounts[id] !== 1 ? "s" : ""}
                      </span>
                    )}
                    {tieneNPT && (
                      <span className="pill pill-gold">
                        <Icon name="alert" size={12} /> NPT
                      </span>
                    )}
                    {sinRevisar > 0 && (
                      <span className="pill pill-dim" style={{ opacity: 0.6 }}>
                        {sinRevisar} sin revisar
                      </span>
                    )}
                  </div>
                  <div className="hist-action-wrap" style={{ marginLeft: "auto" }}>
                    <button
                      className="hist-action-btn pdf"
                      onClick={(e) => { e.stopPropagation(); setExportingParte(parte); }}
                    >
                      <Icon name="upload" size={14} />
                    </button>
                    <span className="hist-action-lbl">PDF</span>
                  </div>
                  <div className="hist-action-wrap">
                    <button
                      className="hist-action-btn edit"
                      onClick={(e) => { e.stopPropagation(); setEditingParte(parte); }}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <span className="hist-action-lbl">Editar</span>
                  </div>
                  {isAdmin && (
                    <div className="hist-action-wrap">
                      <button
                        className="hist-action-btn"
                        style={{ color: "var(--red)" }}
                        onClick={(e) => { e.stopPropagation(); setConfirmDelParte(parte); }}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                      <span className="hist-action-lbl">Eliminar</span>
                    </div>
                  )}
                  <Icon name={isOpen ? "chevDown" : "chevR"} size={17} style={{ color: "var(--ink-3)" }} />
                </div>

                {isOpen && (
                  <div className="hist-day-body">
                    {/* Fotos del parte */}
                    <FotasParte idParte={id}
                      onCount={(n) => setFotosCounts((prev) => ({ ...prev, [id]: n }))} />

                    {/* Observaciones del parte */}
                    {items[0]?.observaciones_parte && (
                      <div className="hist-obs-parte">
                        <Icon name="paperclip" size={13} />
                        <span>{items[0].observaciones_parte}</span>
                      </div>
                    )}

                    {/* Resumen de horas por recurso */}
                    {resumenRecursos.length > 0 && (
                      <div className="hist-horas-resumen">
                        <span className="hist-horas-title"><Icon name="clock" size={13} /> Horas por recurso</span>
                        <div className="hist-horas-chips">
                          {resumenRecursos.map((r) => (
                            <span key={r.nombre} className={clsx("rec-summary-chip", r.tipo === "vehiculo" ? "veh" : "per")}>
                              <Icon name={r.tipo === "vehiculo" ? "truck" : "user"} size={11} />
                              {r.nombre}
                              <b>{r.horas} hs</b>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {items.map((av) => {
                      const recursos = av.Recursos || [];
                      const vehiculos = recursos.filter((r) => r.tipo_recurso === "vehiculo");
                      const personal  = recursos.filter((r) => r.tipo_recurso === "personal");
                      const estadoStyle = ESTADO_STYLE[av.estado_revision] || "pill-dim";

                      return (
                        <div key={av.id} className="hist-avance">
                          <div className="hist-av-top">
                            <div className="hist-av-info">
                              {av.fase && <span className="hist-av-fase">{av.fase}</span>}
                              <span className="hist-av-etapa">{av.nombre_etapa || (av.motivo_npt ? "Solo NPT" : "—")}</span>
                              {av.descripcion && <span className="hist-av-desc">{av.descripcion}</span>}
                            </div>
                            <div className="hist-av-right">
                              {av.nombre_etapa && (
                                <span className="hist-av-val">
                                  +{fmt(Number(av.total_avance) || 0)}
                                  <small>{av.UM}</small>
                                </span>
                              )}
                              <select
                                className={clsx("hist-estado-sel", estadoStyle)}
                                value={av.estado_revision || "SIN REVISAR"}
                                disabled={updatingEstado === av.id}
                                onChange={(e) => handleEstado(av.id, e.target.value)}
                              >
                                {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                              </select>
                            </div>
                          </div>

                          {av.motivo_npt && (
                            <div className="hist-npt">
                              <Icon name="alert" size={13} />
                              <span><b>NPT:</b> {av.motivo_npt}</span>
                              {av.tiempo_npt && <span>· {av.tiempo_npt} hs</span>}
                              {av.detalle_npt && <span>· {av.detalle_npt}</span>}
                            </div>
                          )}

                          {recursos.length > 0 && (
                            <div className="hist-recursos">
                              {vehiculos.map((r) => (
                                <span key={r.id} className="rec-summary-chip veh">
                                  <Icon name="truck" size={11} />
                                  {r.detalle_recurso}
                                  {(r.familia || r.subfamilia) && <span className="rec-chip-meta">{[r.familia, r.subfamilia].filter(Boolean).join(" / ")}</span>}
                                  {r.total_hs ? <b>{r.total_hs} hs</b> : null}
                                </span>
                              ))}
                              {personal.map((r) => (
                                <span key={r.id} className="rec-summary-chip per">
                                  <Icon name="user" size={11} />
                                  {r.detalle_recurso}
                                  {r.puesto && <span className="rec-chip-meta">{r.puesto}</span>}
                                  {r.total_hs ? <b>{r.total_hs} hs</b> : null}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {exportingCert && (
        <ExportCertificadoModal
          avancesTotales={avances}
          project={project}
          onClose={() => setExportingCert(false)}
        />
      )}
      {exportingParte && (
        <ExportParteModal
          parte={exportingParte}
          project={project}
          onClose={() => setExportingParte(null)}
        />
      )}
      {editingParte && (
        <EditParteDrawer
          parte={editingParte}
          project={project}
          onClose={() => setEditingParte(null)}
          onSaved={reloadAvances}
        />
      )}
      {confirmDelParte && (
        <div className="scrim" style={{ justifyContent: "center", alignItems: "center", zIndex: 50 }}
          onMouseDown={(e) => e.target === e.currentTarget && !deletingParte && setConfirmDelParte(null)}>
          <div className="rec-confirm">
            <p>¿Eliminar el parte <b>P-{String(confirmDelParte.num).padStart(3, "0")}</b> del {fmtFecha(confirmDelParte.fecha)}? Se van a borrar sus {confirmDelParte.items.length} avance{confirmDelParte.items.length !== 1 ? "s" : ""}, recursos y fotos asociadas. Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-cream btn-sm" disabled={deletingParte} onClick={() => setConfirmDelParte(null)}>Cancelar</button>
              <button className="btn btn-sm" style={{ background: "var(--red)", color: "#fff" }} disabled={deletingParte} onClick={() => handleDeleteParte(confirmDelParte)}>
                {deletingParte ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
