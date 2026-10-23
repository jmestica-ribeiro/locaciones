import React from 'react';
import { useParams } from 'react-router-dom';
import { Icon, Bar, clsx, fmt } from '../components.jsx';
import { useProjects } from '../context/ProjectsContext.jsx';
import { getAvanceByProyecto, getInsumosByEtapa, upsertInsumo, deleteInsumo } from '../supabase.js';
import { cacheGet, cacheSet } from '../db.js';
import {
  ResponsiveContainer, BarChart, Bar as RBar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

const AXIS = { fontSize: 11, fontFamily: "Archivo, sans-serif", fill: "#948c7c" };
const GRID = "rgba(255,255,255,0.06)";

const fmtFecha = (s) => {
  try {
    return new Date(s + "T00:00:00").toLocaleDateString("es-AR", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return s; }
};

const fmtD = (s) => {
  try {
    const d = new Date(s + "T00:00:00");
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch { return s; }
};

const ESTADO_STYLE = {
  "SIN REVISAR": { bg: "rgba(42,38,32,0.08)", color: "#3a3320" },
  "REVISADO":    { bg: "rgba(231,177,58,0.14)", color: "#7a5200" },
  "APROBADO":    { bg: "rgba(116,192,116,0.14)", color: "#2e6e2e" },
  "RECHAZADO":   { bg: "rgba(226,73,59,0.12)", color: "#b52a1a" },
};

function ChartTip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rc-tip">
      <div className="t">{label}</div>
      {payload.map((p, i) => (
        <div className="r" key={i}>
          <span className="d" style={{ background: p.fill }} />
          {p.name}<b>{fmt(p.value)} {unit}</b>
        </div>
      ))}
    </div>
  );
}

const INSUMO_EMPTY = { nombre: "", unidad: "", cantidad: "", costo_unitario: "", observaciones: "" };

const UMS_INSUMO = ["m³", "m²", "ml", "tn", "kg", "lt", "u", "gl", "m", "bolsa", "rollo", "juego"];

function InsumoModal({ insumo, onClose, onSave, saving }) {
  const [form, setForm] = React.useState(insumo || INSUMO_EMPTY);
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const total = form.cantidad && form.costo_unitario
    ? (Number(form.cantidad) * Number(form.costo_unitario)).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
    : null;

  return (
    <div className="scrim" style={{ justifyContent: "center", alignItems: "center" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rec-modal" style={{ width: "min(520px, 96vw)" }}>
        <div className="rec-modal-head">
          <h2>{insumo?.id ? "Editar insumo" : "Agregar insumo"}</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="rec-modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label>Material / Insumo <span className="req">*</span></label>
            <input className="input" placeholder="ej: Hormigón H30, Asfalto, Caños Ø300…" value={form.nombre} onChange={f("nombre")} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Unidad</label>
              <select className="select" value={form.unidad} onChange={f("unidad")}>
                <option value="">Seleccionar…</option>
                {UMS_INSUMO.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Cantidad planificada</label>
              <input className="input" type="number" min="0" placeholder="0" value={form.cantidad} onChange={f("cantidad")} />
            </div>
          </div>
          <div className="field">
            <label>Costo unitario <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400 }}>(opcional)</span></label>
            <input className="input" type="number" min="0" placeholder="$ por unidad" value={form.costo_unitario} onChange={f("costo_unitario")} />
          </div>
          {total && (
            <div style={{ background: "rgba(231,177,58,0.1)", border: "1px solid rgba(231,177,58,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--on-cream)" }}>
              Total estimado: <strong>{total}</strong>
            </div>
          )}
          <div className="field">
            <label>Observaciones</label>
            <textarea className="input" rows={2} style={{ resize: "vertical" }} placeholder="Notas, especificaciones, proveedor sugerido…" value={form.observaciones} onChange={f("observaciones")} />
          </div>
        </div>
        <div className="rec-modal-foot">
          <button className="btn btn-cream" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={() => onSave(form)} disabled={saving || !form.nombre.trim()}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanInsumos({ etapaId, etapaColor }) {
  const [insumos, setInsumos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState(null); // null | insumo object (con o sin id)
  const [saving, setSaving] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(null);

  React.useEffect(() => {
    if (!etapaId) return;
    getInsumosByEtapa(etapaId)
      .then(setInsumos)
      .catch(() => setInsumos([]))
      .finally(() => setLoading(false));
  }, [etapaId]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        ID_Etapa: etapaId,
        nombre: form.nombre.trim(),
        unidad: form.unidad,
        cantidad: form.cantidad ? Number(form.cantidad) : null,
        costo_unitario: form.costo_unitario ? Number(form.costo_unitario) : null,
        observaciones: form.observaciones?.trim() || null,
      };
      const saved = await upsertInsumo(payload);
      setInsumos((prev) =>
        form.id ? prev.map((i) => i.id === form.id ? saved : i) : [...prev, saved]
      );
      setModal(null);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await deleteInsumo(id);
      setInsumos((prev) => prev.filter((i) => i.id !== id));
    } catch (e) { console.error(e); }
    setConfirmDel(null);
  };

  const totalCosto = insumos.reduce((sum, i) => {
    if (i.cantidad && i.costo_unitario) return sum + i.cantidad * i.costo_unitario;
    return sum;
  }, 0);
  const color = etapaColor;

  return (
    <>
      <section className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div className="ch-icon" style={{ background: color + "22", color }}><Icon name="box" size={20} /></div>
          <div>
            <h2>Planificación de insumos</h2>
            <div className="ch-sub">
              {loading ? "Cargando…" : `${insumos.length} insumo${insumos.length !== 1 ? "s" : ""}${totalCosto > 0 ? ` · Total est. ${totalCosto.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}` : ""}`}
            </div>
          </div>
          <div className="ch-right">
            <button className="btn btn-gold btn-sm" onClick={() => setModal(INSUMO_EMPTY)}>
              <Icon name="plus" size={14} /> Agregar
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "36px 24px", textAlign: "center", opacity: 0.4 }}>
            <Icon name="refresh" size={22} style={{ animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : insumos.length === 0 ? (
          <div className="ins-empty">
            <Icon name="box" size={28} style={{ opacity: 0.25, marginBottom: 10 }} />
            <div>No hay insumos planificados para esta etapa.</div>
            <button className="btn btn-gold btn-sm" style={{ marginTop: 14 }} onClick={() => setModal(INSUMO_EMPTY)}>
              <Icon name="plus" size={14} /> Agregar insumo
            </button>
          </div>
        ) : (
          <div className="ins-table-wrap">
            <table className="ins-table">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th className="num">Cantidad</th>
                  <th>Unidad</th>
                  <th className="num">Costo unit.</th>
                  <th className="num">Total est.</th>
                  <th>Observaciones</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((ins) => {
                  const total = ins.cantidad && ins.costo_unitario ? ins.cantidad * ins.costo_unitario : null;
                  return (
                    <tr key={ins.id}>
                      <td className="ins-nombre">{ins.nombre}</td>
                      <td className="num mono">{ins.cantidad != null ? fmt(ins.cantidad) : "—"}</td>
                      <td><span className="pill pill-dim">{ins.unidad || "—"}</span></td>
                      <td className="num">{ins.costo_unitario != null ? `$${Number(ins.costo_unitario).toLocaleString("es-AR")}` : "—"}</td>
                      <td className="num" style={{ color: total ? color : undefined, fontWeight: total ? 600 : undefined }}>
                        {total ? `$${total.toLocaleString("es-AR", { maximumFractionDigits: 0 })}` : "—"}
                      </td>
                      <td className="ins-obs">{ins.observaciones || <span style={{ opacity: 0.3 }}>—</span>}</td>
                      <td className="rec-actions">
                        <button className="icon-btn" onClick={() => setModal(ins)} title="Editar"><Icon name="edit" size={14} /></button>
                        <button className="icon-btn icon-btn-red" onClick={() => setConfirmDel(ins)} title="Eliminar"><Icon name="trash" size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {totalCosto > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ textAlign: "right", fontWeight: 600, fontSize: 12, color: "var(--ink-3)", padding: "10px 18px" }}>
                      Total estimado
                    </td>
                    <td className="num" style={{ fontWeight: 700, color, fontSize: 14, padding: "10px 18px" }}>
                      ${totalCosto.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>

      {modal && (
        <InsumoModal
          insumo={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {confirmDel && (
        <div className="scrim" style={{ justifyContent: "center", alignItems: "center" }}
          onMouseDown={(e) => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="rec-confirm">
            <p>¿Eliminar el insumo <b>{confirmDel.nombre}</b>?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-cream btn-sm" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn btn-sm" style={{ background: "var(--red)", color: "#fff" }} onClick={() => handleDelete(confirmDel.id)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function EtapaDetail() {
  const { pid, eid } = useParams();
  const { projects } = useProjects();
  const project = projects.find((p) => p.id === pid);
  const etapa = project?.etapas?.find((e) => e.id === eid);

  const [avances, setAvances] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!pid || !etapa) return;
    async function load() {
      try {
        const data = await getAvanceByProyecto(pid);
        await cacheSet(`avance_${pid}`, data);
        const filtrados = (data || []).filter((a) => a.nombre_etapa === etapa.name);
        setAvances(filtrados.sort((a, b) => b.fecha_avance?.localeCompare(a.fecha_avance)));
      } catch {
        const cached = await cacheGet(`avance_${pid}`);
        const filtrados = (cached || []).filter((a) => a.nombre_etapa === etapa.name);
        setAvances(filtrados.sort((a, b) => b.fecha_avance?.localeCompare(a.fecha_avance)));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [pid, etapa?.name]);

  if (!project || !etapa) return (
    <div style={{ padding: 40, textAlign: "center", opacity: 0.5 }}>
      <Icon name="refresh" size={28} style={{ animation: "spin 0.7s linear infinite" }} />
    </div>
  );

  const pct = etapa.total ? Math.min(100, Math.round((etapa.done / etapa.total) * 100)) : 0;
  const restante = Math.max(0, etapa.total - etapa.done);
  const color = etapa.color;

  // Datos para el gráfico de barras por fecha
  const chartData = React.useMemo(() => {
    const map = {};
    avances.forEach((a) => {
      const d = fmtD(a.fecha_avance);
      map[d] = (map[d] || 0) + (Number(a.total_avance) || 0);
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, v]) => ({ d, Avance: v }));
  }, [avances]);

  // NPT resumen
  const avancesNPT = avances.filter((a) => a.motivo_npt);
  const totalRecursos = avances.reduce((s, a) => s + (a.Recursos?.length || 0), 0);

  return (
    <div className="fade-in">

      {/* ── KPIs ── */}
      <div className="etd-kpis">
        <div className="etd-kpi-main" style={{ borderColor: color + "55" }}>
          <div className="etd-kpi-label">Ejecutado</div>
          <div className="etd-kpi-val" style={{ color }}>{fmt(etapa.done)} <span>{etapa.unit}</span></div>
          <div style={{ marginTop: 14 }}>
            <Bar pct={pct} color={color} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "var(--ink-3)" }}>
            <span>0 {etapa.unit}</span>
            <span style={{ fontWeight: 700, color }}>{pct}%</span>
            <span>{fmt(etapa.total)} {etapa.unit}</span>
          </div>
        </div>

        <div className="etd-kpi-grid">
          <div className="etd-stat">
            <div className="etd-stat-val">{fmt(etapa.total)}</div>
            <div className="etd-stat-lbl"><Icon name="target" size={13} /> Total</div>
          </div>
          <div className="etd-stat">
            <div className="etd-stat-val" style={{ color: restante === 0 ? "var(--green)" : "var(--ink)" }}>
              {fmt(restante)}
            </div>
            <div className="etd-stat-lbl"><Icon name="clock" size={13} /> Restante</div>
          </div>
          <div className="etd-stat">
            <div className="etd-stat-val">{avances.length}</div>
            <div className="etd-stat-lbl"><Icon name="report" size={13} /> Partes</div>
          </div>
          <div className="etd-stat">
            <div className="etd-stat-val" style={{ color: avancesNPT.length > 0 ? "var(--red)" : "var(--green)" }}>
              {avancesNPT.length}
            </div>
            <div className="etd-stat-lbl"><Icon name="alert" size={13} /> NPT</div>
          </div>
          {etapa.tag && (
            <div className="etd-stat" style={{ gridColumn: "span 2" }}>
              <div className="etd-stat-val" style={{ fontSize: 15 }}>{etapa.tag}</div>
              <div className="etd-stat-lbl"><Icon name="layers" size={13} /> Fase</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Planificación de insumos ── */}
      <PlanInsumos etapaId={etapa.id} etapaColor={color} />

      {/* ── Gráfico de avances por fecha ── */}
      {chartData.length > 0 && (
        <section className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <div className="ch-icon" style={{ background: color + "22", color }}><Icon name="chart" size={20} /></div>
            <div><h2>Avance por parte</h2><div className="ch-sub">Cantidad registrada por fecha · {etapa.unit}</div></div>
          </div>
          <div className="chart-box" style={{ height: 200, padding: "0 8px 8px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 12, left: -10, bottom: 0 }} barCategoryGap="40%">
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="d" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<ChartTip unit={etapa.unit} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <RBar dataKey="Avance" fill={color} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Historial de avances ── */}
      <section className="card">
        <div className="card-head">
          <div className="ch-icon"><Icon name="clock" size={20} /></div>
          <div>
            <h2>Historial de avances</h2>
            <div className="ch-sub">{loading ? "Cargando…" : `${avances.length} registro${avances.length !== 1 ? "s" : ""}`}</div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "36px 24px", textAlign: "center", opacity: 0.4 }}>
            <Icon name="refresh" size={22} style={{ animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : avances.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", opacity: 0.4, fontSize: 13 }}>
            Sin registros todavía para esta etapa.
          </div>
        ) : (
          <div className="etd-avances">
            {avances.map((av) => {
              const est = ESTADO_STYLE[av.estado_revision] || ESTADO_STYLE["SIN REVISAR"];
              const recursos = av.Recursos || [];
              const vehiculos = recursos.filter((r) => r.tipo_recurso === "vehiculo");
              const personal  = recursos.filter((r) => r.tipo_recurso === "personal");
              return (
                <div key={av.id} className="etd-avance-row">
                  <div className="etd-av-fecha">
                    <div className="etd-av-dd">{fmtD(av.fecha_avance)}</div>
                    <div className="etd-av-full">{fmtFecha(av.fecha_avance)}</div>
                  </div>

                  <div className="etd-av-body">
                    {av.descripcion && <div className="etd-av-desc">{av.descripcion}</div>}

                    {av.motivo_npt && (
                      <div className="etd-av-npt">
                        <Icon name="alert" size={12} />
                        <span>NPT: {av.motivo_npt}{av.tiempo_npt ? ` · ${av.tiempo_npt} hs` : ""}</span>
                        {av.detalle_npt && <span>— {av.detalle_npt}</span>}
                      </div>
                    )}

                    {recursos.length > 0 && (
                      <div className="etd-av-recursos">
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

                  <div className="etd-av-right">
                    <div className="etd-av-val" style={{ color }}>
                      +{fmt(Number(av.total_avance))} <span>{av.UM}</span>
                    </div>
                    <span className="pill" style={{ background: est.bg, color: est.color, fontSize: 10.5 }}>
                      {av.estado_revision || "SIN REVISAR"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
