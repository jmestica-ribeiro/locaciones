import React from 'react';
import { Icon, clsx, fmt } from '../components.jsx';
import {
  getCurvasByProyecto, getEtapasByProyecto, insertCurva, updateCurva, deleteCurva,
  insertPunto, updatePunto, deletePunto,
  insertPuntoItem, updatePuntoItem, deletePuntoItem,
} from '../supabase.js';
import { resolverCurvas } from '../curvas.js';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';

const CURVE_COLORS = ["#e7b13a", "#5b9fd4", "#a98bd6", "#74c074", "#5fb6a8", "#e2493b"];
const AXIS = { fontSize: 11, fontFamily: "Archivo, sans-serif", fill: "#948c7c" };
const GRID = "rgba(255,255,255,0.06)";

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rc-tip">
      <div className="t">{label}</div>
      {payload.map((p, i) => (
        <div className="r" key={i}>
          <span className="d" style={{ background: p.color }} />
          {p.name}<b>{fmt(p.value)}%</b>
        </div>
      ))}
    </div>
  );
}

const fmtD = (s) => {
  try {
    const d = new Date(s + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch { return ""; }
};

/* ── Merge de curvas plan + real en un array para el gráfico ──
   Se une y ordena por fecha ISO (YYYY-MM-DD): ordenar por el label "DD/MM"
   mezclaba meses y dejaba la curva real y la planificada una detrás de otra. */
function buildChartData(curvas, realCurve) {
  const rows = {};
  const rowFor = (iso) => (rows[iso] ||= { iso, d: fmtD(iso) });
  curvas.forEach((c) => (c.PuntosCurva || []).forEach((p) => {
    if (p.fecha) rowFor(p.fecha)[c.nombre] = Number(p.avance);
  }));
  (realCurve || []).forEach((p) => {
    if (p.iso) rowFor(p.iso).Real = p.real;
  });
  return Object.values(rows).sort((x, y) => x.iso.localeCompare(y.iso));
}

/* ── Editor de puntos de una curva ─────────────────────────────────── */
function PuntosEditor({ curva, onUpdate }) {
  const [fecha, setFecha] = React.useState("");
  const [avance, setAvance] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [editFecha, setEditFecha] = React.useState("");
  const [editAvance, setEditAvance] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);

  const puntos = [...(curva.PuntosCurva || [])].sort((a, b) => a.fecha.localeCompare(b.fecha));

  const handleAdd = async () => {
    if (!fecha || avance === "") return;
    const val = Number(avance);
    if (isNaN(val) || val < 0 || val > 100) return;
    setSaving(true);
    try {
      const nuevo = await insertPunto(curva.id, fecha, val);
      onUpdate({
        ...curva,
        PuntosCurva: [...(curva.PuntosCurva || []), nuevo],
      });
      setFecha("");
      setAvance("");
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await deletePunto(id);
      onUpdate({ ...curva, PuntosCurva: (curva.PuntosCurva || []).filter((p) => p.id !== id) });
    } catch (e) { console.error(e); }
  };

  const handleStartEdit = (p) => {
    setEditingId(p.id);
    setEditFecha(p.fecha);
    setEditAvance(String(p.avance));
  };

  const handleCancelEdit = () => setEditingId(null);

  const handleSaveEdit = async (id) => {
    if (!editFecha || editAvance === "") return;
    const val = Number(editAvance);
    if (isNaN(val) || val < 0 || val > 100) return;
    setSavingEdit(true);
    try {
      const actualizado = await updatePunto(id, editFecha, val);
      onUpdate({
        ...curva,
        PuntosCurva: (curva.PuntosCurva || []).map((p) => p.id === id ? actualizado : p),
      });
      setEditingId(null);
    } catch (e) { console.error(e); }
    setSavingEdit(false);
  };

  return (
    <div className="cp-puntos">
      <div className="cp-puntos-add">
        <input
          type="date"
          className="input cp-date-input"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        <div className="cp-avance-wrap">
          <input
            className="input cp-avance-input"
            inputMode="decimal"
            placeholder="0"
            value={avance}
            onChange={(e) => setAvance(e.target.value.replace(",", "."))}
          />
          <span className="cp-unit">%</span>
        </div>
        <button
          className="btn btn-gold btn-sm"
          onClick={handleAdd}
          disabled={saving || !fecha || avance === ""}
        >
          <Icon name="plus" size={14} /> Agregar
        </button>
      </div>

      {puntos.length === 0 ? (
        <p className="cp-no-puntos">Sin puntos cargados. Agregá fecha y avance para construir la curva.</p>
      ) : (
        <div className="cp-puntos-list">
          {puntos.map((p) => (
            <div className="cp-punto-row" key={p.id}>
              {editingId === p.id ? (
                <>
                  <input
                    type="date"
                    className="input cp-date-input"
                    value={editFecha}
                    autoFocus
                    onChange={(e) => setEditFecha(e.target.value)}
                  />
                  <div className="cp-avance-wrap">
                    <input
                      className="input cp-avance-input"
                      inputMode="decimal"
                      value={editAvance}
                      onChange={(e) => setEditAvance(e.target.value.replace(",", "."))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(p.id);
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                    />
                    <span className="cp-unit">%</span>
                  </div>
                  <button className="icon-btn" onClick={() => handleSaveEdit(p.id)} disabled={savingEdit} title="Guardar">
                    <Icon name="check" size={14} />
                  </button>
                  <button className="icon-btn" onClick={handleCancelEdit} title="Cancelar">
                    <Icon name="x" size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className="cp-punto-fecha">{fmtD(p.fecha)}</span>
                  <span className="cp-punto-val">{fmt(Number(p.avance))}%</span>
                  <button className="icon-btn" onClick={() => handleStartEdit(p)} title="Editar">
                    <Icon name="edit" size={14} />
                  </button>
                  <button className="icon-btn icon-btn-red" onClick={() => handleDelete(p.id)} title="Quitar">
                    <Icon name="x" size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Editor por ítem: cantidad acumulada planificada por etapa y fecha ── */
const errMsg = (e) => e?.code === "23505"
  ? "Ese ítem ya tiene una cantidad cargada para esa fecha. Editala en la lista."
  : "No se pudo guardar. Revisá la conexión e intentá de nuevo.";

function PuntosItemEditor({ curva, etapas, onUpdate }) {
  const items = etapas.filter((e) => Number(e.total) > 0);
  const [etapaId, setEtapaId] = React.useState("");
  const [fecha, setFecha] = React.useState("");
  const [cantidad, setCantidad] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [editingId, setEditingId] = React.useState(null);
  const [editFecha, setEditFecha] = React.useState("");
  const [editCant, setEditCant] = React.useState("");

  const puntos = curva.PuntosCurvaItem || [];
  const etapaSel = items.find((e) => e.ID === etapaId);
  const sumaInc = items.reduce((s, e) => s + (Number(e.incidencia) || 0), 0);
  const sinTotal = etapas.length - items.length;

  const pctItem = (e, cant) => fmt(Math.round(Math.min(Number(cant) / Number(e.total), 1) * 1000) / 10);

  const handleAdd = async () => {
    const val = Number(cantidad);
    if (!etapaId || !fecha || cantidad === "" || isNaN(val) || val < 0) return;
    setSaving(true); setError(null);
    try {
      const nuevo = await insertPuntoItem(curva.id, etapaId, fecha, val);
      onUpdate({ ...curva, PuntosCurvaItem: [...puntos, nuevo] });
      setFecha(""); setCantidad("");
    } catch (e) { console.error(e); setError(errMsg(e)); }
    setSaving(false);
  };

  const handleSaveEdit = async (id) => {
    const val = Number(editCant);
    if (!editFecha || editCant === "" || isNaN(val) || val < 0) return;
    setError(null);
    try {
      const act = await updatePuntoItem(id, editFecha, val);
      onUpdate({ ...curva, PuntosCurvaItem: puntos.map((p) => p.id === id ? act : p) });
      setEditingId(null);
    } catch (e) { console.error(e); setError(errMsg(e)); }
  };

  const handleDelete = async (id) => {
    setError(null);
    try {
      await deletePuntoItem(id);
      onUpdate({ ...curva, PuntosCurvaItem: puntos.filter((p) => p.id !== id) });
    } catch (e) { console.error(e); setError(errMsg(e)); }
  };

  const grupos = items
    .map((e) => ({ e, pts: puntos.filter((p) => p.ID_Etapa === e.ID).sort((a, b) => a.fecha.localeCompare(b.fecha)) }))
    .filter((g) => g.pts.length > 0);

  const resultante = curva.PuntosCurva || [];

  if (items.length === 0) return (
    <div className="cp-puntos">
      <p className="cp-no-puntos">El proyecto no tiene ítems con cantidad total. Cargalos en la configuración del proyecto para planificar por ítem.</p>
    </div>
  );

  return (
    <div className="cp-puntos">
      {(Math.abs(sumaInc - 100) > 0.01 || sinTotal > 0) && (
        <div className="cp-warn">
          <Icon name="alert" size={14} />
          <span>
            {Math.abs(sumaInc - 100) > 0.01 && <>Las incidencias de los ítems suman {fmt(sumaInc)}%, la curva no va a llegar a 100%. </>}
            {sinTotal > 0 && <>{sinTotal} ítem{sinTotal > 1 ? "s" : ""} sin cantidad total no se pueden planificar.</>}
          </span>
        </div>
      )}

      <div className="cp-item-add">
        <select className="select" value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
          <option value="">Elegí un ítem…</option>
          {items.map((e) => (
            <option key={e.ID} value={e.ID}>
              {e.nombre_etapa} · {fmt(Number(e.total))} {e.UM || ""} · {fmt(Number(e.incidencia) || 0)}%
            </option>
          ))}
        </select>
        <div className="cp-puntos-add" style={{ marginBottom: 0 }}>
          <input type="date" className="input cp-date-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <div className="cp-avance-wrap">
            <input
              className="input cp-avance-input" inputMode="decimal" placeholder="Acumulado"
              style={{ paddingRight: 42 }}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value.replace(",", "."))}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <span className="cp-unit">{etapaSel?.UM || ""}</span>
          </div>
          <button className="btn btn-gold btn-sm" onClick={handleAdd}
            disabled={saving || !etapaId || !fecha || cantidad === ""}>
            <Icon name="plus" size={14} /> Agregar
          </button>
        </div>
        {etapaSel && cantidad !== "" && !isNaN(Number(cantidad)) && (
          <p className="cp-item-hint">
            = {pctItem(etapaSel, cantidad)}% del ítem
            {Number(cantidad) > Number(etapaSel.total) && <> · supera el total ({fmt(Number(etapaSel.total))} {etapaSel.UM}), cuenta como 100%</>}
          </p>
        )}
      </div>

      {error && <p className="cp-error">{error}</p>}

      {grupos.length === 0 ? (
        <p className="cp-no-puntos">Sin cargas. Elegí un ítem, la fecha y la cantidad acumulada planificada a esa fecha.</p>
      ) : (
        <div className="cp-item-groups">
          {grupos.map(({ e, pts }) => (
            <div key={e.ID} className="cp-item-group">
              <div className="cp-item-head">
                <span className="cp-item-name">{e.nombre_etapa}</span>
                <span className="cp-item-meta">{fmt(Number(e.total))} {e.UM} · inc. {fmt(Number(e.incidencia) || 0)}%</span>
              </div>
              {pts.map((p, k) => {
                const decrece = k > 0 && Number(p.cantidad) < Number(pts[k - 1].cantidad);
                return (
                  <div className="cp-punto-row" key={p.id}>
                    {editingId === p.id ? (
                      <>
                        <input type="date" className="input cp-date-input" value={editFecha} onChange={(ev) => setEditFecha(ev.target.value)} />
                        <div className="cp-avance-wrap">
                          <input className="input cp-avance-input" inputMode="decimal" autoFocus style={{ paddingRight: 42 }}
                            value={editCant}
                            onChange={(ev) => setEditCant(ev.target.value.replace(",", "."))}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter") handleSaveEdit(p.id);
                              if (ev.key === "Escape") setEditingId(null);
                            }}
                          />
                          <span className="cp-unit">{e.UM}</span>
                        </div>
                        <button className="icon-btn" onClick={() => handleSaveEdit(p.id)} title="Guardar"><Icon name="check" size={14} /></button>
                        <button className="icon-btn" onClick={() => setEditingId(null)} title="Cancelar"><Icon name="x" size={14} /></button>
                      </>
                    ) : (
                      <>
                        <span className="cp-punto-fecha">{fmtD(p.fecha)}</span>
                        <span className="cp-punto-val" style={{ minWidth: 90 }}>{fmt(Number(p.cantidad))} {e.UM}</span>
                        <span className={clsx("cp-item-pct", decrece && "bad")}
                          title={decrece ? "Menor que la carga anterior: la cantidad es acumulada, debería crecer" : undefined}>
                          {pctItem(e, p.cantidad)}%
                        </span>
                        <button className="icon-btn" onClick={() => { setEditingId(p.id); setEditFecha(p.fecha); setEditCant(String(p.cantidad)); }} title="Editar">
                          <Icon name="edit" size={14} />
                        </button>
                        <button className="icon-btn icon-btn-red" onClick={() => handleDelete(p.id)} title="Quitar">
                          <Icon name="x" size={14} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {resultante.length > 0 && (
        <div className="cp-resultante">
          <div className="cp-resultante-title">Curva resultante · % acumulado de obra</div>
          <div className="cp-resultante-list">
            {resultante.map((p) => (
              <span key={p.fecha}><i>{fmtD(p.fecha)}</i><b>{fmt(p.avance)}%</b></span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Drawer principal ───────────────────────────────────────────── */
export function CurvasPlanDrawer({ project, realCurve, onClose, onUpdate }) {
  const [curvasRaw, setCurvas] = React.useState([]);
  const [etapas, setEtapas] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(null);
  const [newNombre, setNewNombre] = React.useState("");
  const [newModo, setNewModo] = React.useState("item");
  const [addingCurva, setAddingCurva] = React.useState(false);
  const [editId, setEditId] = React.useState(null);
  const [editNombre, setEditNombre] = React.useState("");
  const [confirmDel, setConfirmDel] = React.useState(null);

  React.useEffect(() => {
    Promise.all([getCurvasByProyecto(project.id), getEtapasByProyecto(project.id)])
      .then(([data, et]) => {
        setCurvas(data || []);
        setEtapas(et || []);
        if (data?.length > 0) setExpanded(data[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [project.id]);

  // Las curvas por ítem se recalculan con cada cambio de sus cargas
  const curvas = React.useMemo(() => resolverCurvas(curvasRaw, etapas), [curvasRaw, etapas]);

  // Avisar al tablero para que su gráfico quede al día
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    onUpdate?.(curvas);
  }, [curvas]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddCurva = async () => {
    if (!newNombre.trim()) return;
    setAddingCurva(true);
    try {
      const nueva = await insertCurva(project.id, newNombre.trim(), newModo);
      nueva.PuntosCurva = [];
      nueva.PuntosCurvaItem = [];
      setCurvas((prev) => [...prev, nueva]);
      setExpanded(nueva.id);
      setNewNombre("");
    } catch (e) { console.error(e); }
    setAddingCurva(false);
  };

  const handleRename = async (id) => {
    if (!editNombre.trim()) return;
    try {
      await updateCurva(id, editNombre.trim());
      setCurvas((prev) => prev.map((c) => c.id === id ? { ...c, nombre: editNombre.trim() } : c));
      setEditId(null);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteCurva(id);
      setCurvas((prev) => prev.filter((c) => c.id !== id));
      if (expanded === id) setExpanded(null);
    } catch (e) { console.error(e); }
    setConfirmDel(null);
  };

  const updateCurvaLocal = (updated) => {
    setCurvas((prev) => prev.map((c) => c.id === updated.id ? updated : c));
  };

  // Merge real + plan para el gráfico
  const mergedData = buildChartData(curvas, realCurve);

  const hasData = mergedData.length > 0;

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer">
        <div className="drawer-head">
          <div className="ch-icon" style={{ background: "rgba(91,159,212,0.15)", color: "#5b9fd4" }}>
            <Icon name="chart" size={20} />
          </div>
          <div>
            <h2>Curvas planificadas</h2>
            <p>{project.code} · {project.location}</p>
          </div>
          <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {/* Gráfico combinado */}
          {hasData && (
            <div className="cp-chart-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={mergedData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cpReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#74c074" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#74c074" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="d" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} unit="%" width={42} domain={[0, 100]} />
                  <Tooltip content={<ChartTip />} />
                  {curvas.map((c, i) => (
                    <Area
                      key={c.id}
                      type="monotone"
                      dataKey={c.nombre}
                      stroke={CURVE_COLORS[i % CURVE_COLORS.length]}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      fill="none"
                      dot={{ r: 3, fill: CURVE_COLORS[i % CURVE_COLORS.length] }}
                      connectNulls
                    />
                  ))}
                  <Area
                    type="monotone"
                    dataKey="Real"
                    stroke="#74c074"
                    strokeWidth={2.5}
                    fill="url(#cpReal)"
                    dot={{ r: 3, fill: "#74c074" }}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="cp-legend">
                {curvas.map((c, i) => (
                  <span key={c.id} className="cp-legend-item">
                    <span className="cp-legend-dot" style={{ background: CURVE_COLORS[i % CURVE_COLORS.length], opacity: 0.85, borderStyle: "dashed" }} />
                    {c.nombre}
                  </span>
                ))}
                <span className="cp-legend-item">
                  <span className="cp-legend-dot" style={{ background: "#74c074" }} />
                  Real
                </span>
              </div>
            </div>
          )}

          {/* Nueva curva */}
          <div className="cp-modo">
            <span>Cargar por</span>
            <button className={clsx(newModo === "item" && "on")} onClick={() => setNewModo("item")}>Ítem (cantidades)</button>
            <button className={clsx(newModo === "porcentaje" && "on")} onClick={() => setNewModo("porcentaje")}>% global</button>
          </div>
          <div className="cp-new-curva">
            <input
              className="input"
              placeholder="Nombre de la nueva curva…"
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCurva()}
            />
            <button
              className="btn btn-gold btn-sm"
              onClick={handleAddCurva}
              disabled={addingCurva || !newNombre.trim()}
            >
              <Icon name="plus" size={15} /> Crear curva
            </button>
          </div>

          {/* Lista de curvas */}
          {loading ? (
            <p style={{ color: "var(--on-cream-2)", fontSize: 13, textAlign: "center", padding: 24 }}>Cargando…</p>
          ) : curvas.length === 0 ? (
            <p style={{ color: "var(--on-cream-2)", fontSize: 13, textAlign: "center", padding: 24 }}>
              No hay curvas planificadas. Creá la primera arriba.
            </p>
          ) : (
            <div className="cp-curvas-list">
              {curvas.map((c, i) => (
                <div key={c.id} className={clsx("cp-curva-card", expanded === c.id && "open")}>
                  <div className="cp-curva-head" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                    <span className="cp-curva-dot" style={{ background: CURVE_COLORS[i % CURVE_COLORS.length] }} />
                    {editId === c.id ? (
                      <input
                        className="input cp-rename-input"
                        value={editNombre}
                        autoFocus
                        onChange={(e) => setEditNombre(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(c.id);
                          if (e.key === "Escape") setEditId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="cp-curva-name">{c.nombre}</span>
                    )}
                    <span className="cp-curva-modo">{c.modo === "item" ? "por ítem" : "por %"}</span>
                    <span className="cp-curva-count">
                      {c.modo === "item" ? `${(c.PuntosCurvaItem || []).length} cargas` : `${(c.PuntosCurva || []).length} pts`}
                    </span>
                    <div className="cp-curva-actions" onClick={(e) => e.stopPropagation()}>
                      {editId === c.id ? (
                        <button className="icon-btn" onClick={() => handleRename(c.id)} title="Guardar nombre">
                          <Icon name="check" size={15} />
                        </button>
                      ) : (
                        <button className="icon-btn" onClick={() => { setEditId(c.id); setEditNombre(c.nombre); }} title="Renombrar">
                          <Icon name="edit" size={15} />
                        </button>
                      )}
                      <button className="icon-btn icon-btn-red" onClick={() => setConfirmDel(c)} title="Eliminar curva">
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                    <Icon name={expanded === c.id ? "chevDown" : "chevR"} size={16} style={{ color: "var(--on-cream-2)", marginLeft: 4 }} />
                  </div>

                  {expanded === c.id && (
                    c.modo === "item"
                      ? <PuntosItemEditor curva={c} etapas={etapas} onUpdate={updateCurvaLocal} />
                      : <PuntosEditor curva={c} onUpdate={updateCurvaLocal} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmación borrado */}
      {confirmDel && (
        <div className="scrim" style={{ justifyContent: "center", alignItems: "center", zIndex: 50 }}
          onMouseDown={(e) => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="rec-confirm">
            <p>¿Eliminar la curva <b>"{confirmDel.nombre}"</b> y todas sus cargas?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-cream btn-sm" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn btn-sm" style={{ background: "var(--red)", color: "#fff" }} onClick={() => handleDelete(confirmDel.id)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
