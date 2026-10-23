import React from 'react';
import { useParams } from 'react-router-dom';
import { useProjects, cappedContrib } from '../context/ProjectsContext.jsx';
import {
  ResponsiveContainer, BarChart, Bar as RBar, AreaChart, Area,
  LineChart, Line, PieChart, Pie, Cell, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, PolarAngleAxis, ReferenceLine,
} from 'recharts';
import { Icon, fmt, clsx, ActividadHeatmap } from '../components.jsx';
import { CurvasPlanDrawer } from '../drawers/CurvasPlanDrawer.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getCurvasByProyecto, getMotivosNPT, setMotivoNPT } from '../supabase.js';
import { cacheGet, cacheSet } from '../db.js';

const NPT_COLORS = { gestionable: "#e7b13a", no_gestionable: "#8f8878", sin_clasificar: "#5b9fd4" };
const NPT_LABELS = { gestionable: "Gestionable", no_gestionable: "No gestionable", sin_clasificar: "Sin clasificar" };

const CURVE_COLORS = ["#e7b13a", "#5b9fd4", "#a98bd6", "#74c074", "#5fb6a8", "#e2493b"];
const AXIS = { fontSize: 11, fontFamily: "Archivo, sans-serif", fill: "#948c7c" };
const GRID = "rgba(255,255,255,0.06)";

function ChartTip({ active, payload, label, unit }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rc-tip">
      <div className="t">{label}</div>
      {payload.map((p, i) => (
        <div className="r" key={i}>
          <span className="d" style={{ background: p.color || p.fill }} />
          {p.name}<b>{fmt(p.value)}{unit ? " " + unit : ""}</b>
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

function computeFilteredData(avances, etapasRaw, palette) {
  const seen = new Set();
  const deduped = avances.filter((a) => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
  const sorted = [...deduped].sort((a, b) => new Date(a.fecha_avance || a.created_at) - new Date(b.fecha_avance || b.created_at));

  const etapas = (etapasRaw || []).map((e, j) => {
    const done = deduped.filter((a) => a.nombre_etapa === e.nombre_etapa).reduce((s, a) => s + (Number(a.total_avance) || 0), 0);
    return { id: e.ID, name: e.nombre_etapa || "", done, total: Number(e.total) || 0, unit: e.UM || "", tag: e.fase || "", color: palette[j % palette.length] };
  });

  const progress = Math.round(etapas.reduce((s, e, j) => {
    if (!e.total) return s;
    return s + Math.min(e.done / e.total, 1) * (Number(etapasRaw[j]?.incidencia) || 0);
  }, 0));

  const byDateCurve = {};
  const acumEtapa = {};
  sorted.forEach((a) => {
    const date = a.fecha_avance || a.created_at?.slice(0, 10);
    if (!date || isNaN(new Date(date + "T00:00:00").getTime())) return;
    const etDB = (etapasRaw || []).find((e) => e.nombre_etapa === a.nombre_etapa);
    if (!etDB || !Number(etDB.total)) return;
    byDateCurve[date] = (byDateCurve[date] || 0) + cappedContrib(acumEtapa, a, etDB);
  });
  const curveEntries = Object.entries(byDateCurve).sort((a, b) => a[0].localeCompare(b[0]));
  let acc = 0;
  const curve = curveEntries.map(([d, v]) => { acc += v; return { d: fmtD(d), iso: d, real: Math.round(Math.min(acc, 100)) }; });

  const byDateDaily = {};
  sorted.forEach((a) => {
    const date = a.fecha_avance || a.created_at?.slice(0, 10);
    if (!date || !a.nombre_etapa) return;
    const key = a.fase || a.nombre_etapa || "Sin fase";
    if (!byDateDaily[date]) byDateDaily[date] = { d: fmtD(date) };
    byDateDaily[date][key] = (byDateDaily[date][key] || 0) + (Number(a.total_avance) || 0);
  });
  const daily = Object.values(byDateDaily).slice(-10);

  const velocity = curveEntries.map(([d, v]) => ({ d: fmtD(d), Velocidad: Math.round(v * 10) / 10 }));

  const nptGrouped = {};
  deduped.filter((a) => a.motivo_npt).forEach((a) => {
    const k = a.motivo_npt;
    if (!nptGrouped[k]) nptGrouped[k] = { horas: 0, ocurrencias: 0 };
    nptGrouped[k].horas += Number(a.tiempo_npt) || 1;
    nptGrouped[k].ocurrencias += 1;
  });
  const npt = Object.entries(nptGrouped).map(([motivo, v]) => ({ motivo, ...v })).sort((a, b) => b.horas - a.horas);

  const allRecursos = deduped.flatMap((a) => a.Recursos || []);
  const uniqueVehiculos = new Set(allRecursos.filter((r) => r.tipo_recurso === "vehiculo").map((r) => r.detalle_recurso));
  const uniquePersonal  = new Set(allRecursos.filter((r) => r.tipo_recurso === "personal").map((r) => r.detalle_recurso));
  const recGrouped = { vehiculo: uniqueVehiculos.size, personal: uniquePersonal.size };
  const REC_COLORS = { vehiculo: "#e7b13a", personal: "#5b9fd4", material: "#74c074", Otro: "#a98bd6" };
  const distrib = Object.entries(recGrouped).filter(([, v]) => v > 0).map(([name, value], i) => ({ name, value, color: REC_COLORS[name] || palette[i] }));
  const rankMap = {};
  allRecursos.forEach((r) => {
    const key = r.detalle_recurso || "Sin nombre";
    if (!rankMap[key]) rankMap[key] = { nombre: key, horas: 0, tipo: r.tipo_recurso || "Otro" };
    rankMap[key].horas += Number(r.total_hs) || 0;
  });
  const recursosRanking = Object.values(rankMap).filter((r) => r.horas > 0).sort((a, b) => b.horas - a.horas).slice(0, 10);

  const diasActivos = curveEntries.length;
  const avgDailyPct = diasActivos > 0 ? acc / diasActivos : 0;
  const diasRestantes = avgDailyPct > 0 ? Math.ceil((100 - Math.min(acc, 100)) / avgDailyPct) : null;

  return {
    curve, daily, velocity, npt, etapas, progress,
    recursos: { distrib, recursosRanking, maquinas: recGrouped.vehiculo || 0, personas: recGrouped.personal || 0, materiales: recGrouped.material || 0 },
    avgDailyPct: Math.round(avgDailyPct * 10) / 10,
    diasRestantes,
    etapasFin: etapas.filter((e) => e.total > 0 && e.done >= e.total).length,
    etapasPlan: etapas.length,
  };
}

export function ControlBoard() {
  const { pid } = useParams();
  const { projects, PALETTE } = useProjects();
  const { isAdmin } = useAuth();
  const project = projects.find((p) => p.id === pid);
  const [showCurvas, setShowCurvas] = React.useState(false);
  const [curvasPlan, setCurvasPlan] = React.useState([]);
  const [tab, setTab] = React.useState("resumen");
  const [motivosNPT, setMotivosNPT] = React.useState([]); // [{ nombre, clasificacion }]
  const [savingMotivo, setSavingMotivo] = React.useState(null);

  // Raw data para filtros
  const [rawAvances, setRawAvances] = React.useState([]);
  const [rawEtapas, setRawEtapas]   = React.useState([]);

  // Filtros
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [fechaDesde, setFechaDesde]   = React.useState("");
  const [fechaHasta, setFechaHasta]   = React.useState("");
  const [etapasActivas, setEtapasActivas] = React.useState(new Set()); // Set de nombre_etapa

  React.useEffect(() => {
    if (!pid) return;
    async function load() {
      try {
        const data = await getCurvasByProyecto(pid);
        await cacheSet(`curvas_${pid}`, data);
        setCurvasPlan(data || []);
      } catch {
        const cached = await cacheGet(`curvas_${pid}`);
        setCurvasPlan(cached || []);
      }
      // Cargar avances y etapas crudos para filtros
      const [av, et] = await Promise.all([cacheGet(`avance_${pid}`), cacheGet(`etapas_${pid}`)]);
      if (av) setRawAvances(av);
      if (et) setRawEtapas(et);
    }
    load();
  }, [pid]);

  React.useEffect(() => {
    getMotivosNPT().then(setMotivosNPT).catch(() => {});
  }, []);

  const clasificacionMap = React.useMemo(() => {
    const m = {};
    motivosNPT.forEach((r) => { m[r.nombre] = r.clasificacion; });
    return m;
  }, [motivosNPT]);

  const clasificarMotivo = async (nombre, clasificacion) => {
    setSavingMotivo(nombre);
    setMotivosNPT((prev) => {
      const existe = prev.some((r) => r.nombre === nombre);
      return existe
        ? prev.map((r) => r.nombre === nombre ? { ...r, clasificacion } : r)
        : [...prev, { nombre, clasificacion }];
    });
    try {
      await setMotivoNPT(nombre, clasificacion);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingMotivo(null);
    }
  };

  // Filtros activos
  const hasFilters = fechaDesde || fechaHasta || etapasActivas.size > 0;

  // Calcular datos filtrados o usar los del contexto
  const data = React.useMemo(() => {
    if (!hasFilters || !rawAvances.length) return null;
    let filtered = rawAvances;
    if (fechaDesde) filtered = filtered.filter((a) => (a.fecha_avance || "") >= fechaDesde);
    if (fechaHasta) filtered = filtered.filter((a) => (a.fecha_avance || "") <= fechaHasta);
    if (etapasActivas.size > 0) filtered = filtered.filter((a) => etapasActivas.has(a.nombre_etapa));
    return computeFilteredData(filtered, rawEtapas, PALETTE);
  }, [hasFilters, rawAvances, rawEtapas, fechaDesde, fechaHasta, etapasActivas, PALETTE]);

  if (!project) return null;

  // Nombres de etapas únicos para el selector
  const etapaNombres = Array.from(new Set(rawEtapas.map((e) => e.nombre_etapa).filter(Boolean)));
  const activeCount = [fechaDesde, fechaHasta, etapasActivas.size > 0].filter(Boolean).length;

  // Fuente de datos: filtrada o del proyecto
  const d = data || project;

  const toggleEtapa = (nombre) => {
    setEtapasActivas((prev) => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre); else next.add(nombre);
      return next;
    });
  };

  const clearFilters = () => { setFechaDesde(""); setFechaHasta(""); setEtapasActivas(new Set()); };

  const diasConCargaProyecto = new Set(
    rawAvances.map((a) => a.fecha_avance || a.created_at?.slice(0, 10)).filter(Boolean)
  );

  // Datos de gráficos
  const stageData = d.etapas
    .filter((e) => e.total > 0)
    .map((e) => {
      const pct = Math.round((e.done / e.total) * 100);
      return { name: e.name.length > 22 ? e.name.slice(0, 20) + "…" : e.name, fullName: e.name, Ejecutado: pct, color: pct > 100 ? "#e2493b" : e.color, reprocesada: pct > 100, pct };
    });

  const totalPct   = d.progress;
  const gaugeData  = [{ name: "avance", value: totalPct, fill: project.color }];
  const resTotal   = d.recursos.distrib.reduce((a, x) => a + x.value, 0);

  const TABS = [
    { id: "resumen",    label: "Resumen",    icon: "gauge"     },
    { id: "etapas",     label: "Etapas",     icon: "layers"    },
    { id: "produccion", label: "Producción", icon: "chart"     },
    { id: "recursos",   label: "Recursos",   icon: "resources" },
    { id: "npt",        label: "NPT",        icon: "alert"     },
  ];

  return (
    <div className="fade-in">

      {/* ── Tabs + botón filtros ── */}
      <div className="board-tabs-row">
        <div className="board-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={clsx("board-tab", tab === t.id && "on")} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={15} />{t.label}
            </button>
          ))}
        </div>
        <button
          className={clsx("btn btn-sm", filtersOpen || hasFilters ? "btn-dark" : "btn-cream")}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <Icon name="filter" size={15} />
          Filtros
          {activeCount > 0 && <span className="hf-badge">{activeCount}</span>}
        </button>
      </div>

      {/* ── Panel de filtros ── */}
      {filtersOpen && (
        <div className="board-filters">
          <div className="bf-row">
            {/* Rango de fechas */}
            <div className="bf-group">
              <label className="bf-label">Fecha desde</label>
              <input type="date" className="select" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </div>
            <div className="bf-group">
              <label className="bf-label">Fecha hasta</label>
              <input type="date" className="select" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            </div>

            {/* Etapas */}
            {etapaNombres.length > 0 && (
              <div className="bf-group bf-group-etapas">
                <label className="bf-label">Etapas</label>
                <div className="bf-chips">
                  {etapaNombres.map((nombre) => (
                    <button
                      key={nombre}
                      className={clsx("chip", etapasActivas.has(nombre) && "on")}
                      onClick={() => toggleEtapa(nombre)}
                    >
                      {nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasFilters && (
              <button className="btn btn-ghost btn-sm bf-clear" onClick={clearFilters}>
                <Icon name="x" size={14} /> Limpiar
              </button>
            )}
          </div>

          {hasFilters && (
            <div className="bf-active-notice">
              <Icon name="filter" size={13} />
              Mostrando datos filtrados ·
              {fechaDesde && <span> Desde {fechaDesde}</span>}
              {fechaHasta && <span> hasta {fechaHasta}</span>}
              {etapasActivas.size > 0 && <span> · {etapasActivas.size} etapa{etapasActivas.size !== 1 ? "s" : ""}</span>}
            </div>
          )}
        </div>
      )}

      <div className="board-grid">
        {/* ── Tab: Resumen ── */}
        {tab === "resumen" && <>
        <section className="card col-4">
          <div className="card-head">
            <div className="ch-icon"><Icon name="gauge" size={20} /></div>
            <div><h2>Avance total</h2><div className="ch-sub">% de obra ejecutada{hasFilters ? " · filtrado" : ""}</div></div>
          </div>
          <div className="chart-box gauge-wrap" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="74%" outerRadius="100%" data={gaugeData} startAngle={220} endAngle={-40}>
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar background={{ fill: "rgba(255,255,255,0.07)" }} dataKey="value" cornerRadius={20} angleAxisId={0} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="gauge-center">
              <div className="gv">{totalPct}<span style={{ fontSize: 20, color: "var(--ink-3)" }}>%</span></div>
              <div className="gl">{d.etapasFin}/{d.etapasPlan} etapas</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", padding: "0 18px 18px", color: "var(--ink-3)", fontSize: 12 }}>
            <span><b style={{ color: "var(--gold-2)", fontFamily: "Sora" }}>{d.etapasPlan}</b> planificadas</span>
            <span><b style={{ color: "var(--green)", fontFamily: "Sora" }}>{d.etapasFin}</b> finalizadas</span>
          </div>
        </section>

        {(() => {
          const isValidDate = (v) => v && !isNaN(new Date(v + "T00:00:00").getTime());
          const realMap = Object.fromEntries((d.curve || []).filter((p) => isValidDate(p.iso)).map((p) => [p.iso, p.real]));
          const planDates = new Set();
          curvasPlan.forEach((c) => (c.PuntosCurva || []).forEach((p) => { if (isValidDate(p.fecha)) planDates.add(p.fecha); }));
          const allDates = Array.from(new Set([...Object.keys(realMap), ...planDates])).sort();
          const planMaps = curvasPlan.map((c) => Object.fromEntries((c.PuntosCurva || []).map((p) => [p.fecha, Number(p.avance)])));
          const mergedData = allDates.map((dt) => {
            const row = { d: fmtD(dt), Real: realMap[dt] ?? undefined };
            curvasPlan.forEach((c, i) => { row[c.nombre] = planMaps[i][dt] ?? undefined; });
            return row;
          });
          const hasData = mergedData.length > 0;
          return (
            <section className="card col-8">
              <div className="card-head">
                <div className="ch-icon"><Icon name="chart" size={20} /></div>
                <div><h2>Curva de avance</h2><div className="ch-sub">Acumulado real vs. planificado</div></div>
                <div className="ch-right">
                  {curvasPlan.map((c, i) => (
                    <span key={c.id} className="pill pill-dim" style={{ fontSize: 11 }}>
                      <span className="status-dot" style={{ background: CURVE_COLORS[i % CURVE_COLORS.length] }} /> {c.nombre}
                    </span>
                  ))}
                  {d.curve.length > 0 && (
                    <span className="pill pill-green" style={{ fontSize: 11 }}>
                      <span className="status-dot" style={{ background: "var(--green)" }} /> Real
                    </span>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowCurvas(true)}>
                    <Icon name="settings" size={14} /> Planificado
                  </button>
                </div>
              </div>
              <div className="chart-box" style={{ height: 230 }}>
                {!hasData ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--ink-3)", fontSize: 13 }}>
                    Sin datos. Cargá avances o agregá una curva planificada.
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowCurvas(true)}>
                      <Icon name="plus" size={14} /> Agregar curva planificada
                    </button>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mergedData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gReal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#74c074" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#74c074" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="d" tick={AXIS} axisLine={false} tickLine={false} />
                      <YAxis tick={AXIS} axisLine={false} tickLine={false} unit="%" width={42} domain={[0, 100]} />
                      <Tooltip content={<ChartTip unit="%" />} />
                      {curvasPlan.map((c, i) => (
                        <Area key={c.id} type="monotone" dataKey={c.nombre} stroke={CURVE_COLORS[i % CURVE_COLORS.length]} strokeWidth={2} strokeDasharray="5 4" fill="none" dot={{ r: 3, fill: CURVE_COLORS[i % CURVE_COLORS.length] }} connectNulls />
                      ))}
                      <Area type="monotone" dataKey="Real" name="Real" stroke="#74c074" strokeWidth={2.5} fill="url(#gReal)" dot={{ r: 3, fill: "#74c074" }} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          );
        })()}

        <ActividadHeatmap diasConCarga={diasConCargaProyecto} className="col-12" />
        </>}

        {/* ── Tab: Etapas ── */}
        {tab === "etapas" && <>
        <section className="card col-12">
          <div className="card-head">
            <div className="ch-icon"><Icon name="layers" size={20} /></div>
            <div><h2>Avance por etapa</h2><div className="ch-sub">% ejecutado sobre lo planificado{hasFilters ? " · filtrado" : ""}</div></div>
            <div className="ch-right">
              {stageData.some((d) => d.reprocesada) && (
                <span className="pill" style={{ background: "rgba(226,73,59,0.15)", color: "#e2493b", fontSize: 11 }}>
                  <Icon name="alert" size={12} /> {stageData.filter((d) => d.reprocesada).length} reprocesada{stageData.filter((d) => d.reprocesada).length > 1 ? "s" : ""}
                </span>
              )}
              <span className="pill pill-dim" style={{ fontSize: 11 }}>
                <span style={{ display: "inline-block", width: 12, height: 2, background: "rgba(255,255,255,0.4)", borderTop: "2px dashed rgba(255,255,255,0.4)", marginRight: 4 }} />
                100% planificado
              </span>
            </div>
          </div>
          <div className="chart-box" style={{ height: Math.max(260, stageData.length * 42 + 60) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 0 }} barCategoryGap={10}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" domain={[0, (dataMax) => Math.max(dataMax * 1.05, 105)]} unit="%" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ ...AXIS, fontSize: 11, fill: "#cfc7b6" }} width={150} axisLine={false} tickLine={false} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rc-tip">
                      <div className="t">{d.fullName}</div>
                      <div className="r"><span className="d" style={{ background: d.color }} />Ejecutado<b>{d.pct}%</b></div>
                      {d.reprocesada && <div className="r" style={{ color: "#e2493b" }}>⚠ Reprocesada (+{d.pct - 100}%)</div>}
                    </div>
                  );
                }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <ReferenceLine x={100} stroke="#e2493b" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: "100%", position: "insideTopRight", fontSize: 10, fill: "#e2493b", fontWeight: "bold", offset: 6 }} />
                <RBar dataKey="Ejecutado" radius={[0, 6, 6, 0]} barSize={18} label={{ position: "right", fontSize: 11, fill: "#cfc7b6", formatter: (v) => `${v}%` }}>
                  {stageData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </RBar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card col-6">
          <div className="card-head">
            <div className="ch-icon"><Icon name="gauge" size={20} /></div>
            <div>
              <h2>Velocidad de avance</h2>
              <div className="ch-sub">% ejecutado por día · promedio {d.avgDailyPct}%/día</div>
            </div>
          </div>
          <div className="chart-box" style={{ height: 220 }}>
            {d.velocity.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-3)", fontSize: 13 }}>Sin datos suficientes.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.velocity} margin={{ top: 8, right: 16, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="velColor" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#5b9fd4" /><stop offset="100%" stopColor="#a98bd6" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="d" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} width={38} unit="%" />
                  <Tooltip content={<ChartTip unit="%" />} />
                  {d.avgDailyPct > 0 && (
                    <ReferenceLine y={d.avgDailyPct} stroke="rgba(231,177,58,0.5)" strokeDasharray="4 3"
                      label={{ value: `Prom. ${d.avgDailyPct}%`, position: "insideTopRight", fontSize: 10, fill: "var(--gold-2)" }} />
                  )}
                  <Line type="monotone" dataKey="Velocidad" stroke="url(#velColor)" strokeWidth={2.5} dot={{ r: 4, fill: "#5b9fd4", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="card col-6">
          <div className="card-head">
            <div className="ch-icon"><Icon name="target" size={20} /></div>
            <div>
              <h2>Forecast de finalización</h2>
              <div className="ch-sub">
                {d.diasRestantes != null
                  ? d.diasRestantes === 0 ? "Obra completada"
                  : `~${d.diasRestantes} días restantes al ritmo actual`
                  : "Sin datos suficientes para proyectar"}
              </div>
            </div>
          </div>
          <div style={{ padding: "8px 22px 18px" }}>
            {d.etapas.filter((e) => e.total > 0).map((e) => {
              const pct = Math.min(100, e.total > 0 ? Math.round((e.done / e.total) * 100) : 0);
              const restante = Math.max(0, e.total - e.done);
              const diasEtapa = d.avgDailyPct > 0 && e.total > 0 ? Math.ceil((restante / e.total) * (100 / d.avgDailyPct)) : null;
              return (
                <div key={e.id} className="forecast-row">
                  <div className="forecast-name" style={{ color: e.color }}>{e.name.length > 28 ? e.name.slice(0, 26) + "…" : e.name}</div>
                  <div className="forecast-bar-wrap">
                    <div className="forecast-bar-track"><div className="forecast-bar-fill" style={{ width: pct + "%", background: e.color }} /></div>
                    <span className="forecast-pct" style={{ color: e.color }}>{pct}%</span>
                  </div>
                  <div className="forecast-eta">
                    {pct >= 100 ? <span style={{ color: "var(--green)" }}>✓ Completa</span>
                      : diasEtapa != null ? <span>~{diasEtapa}d</span>
                      : <span style={{ opacity: 0.4 }}>—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        </>}

        {/* ── Tab: Recursos ── */}
        {tab === "recursos" && <>
        <section className="card col-7">
          <div className="card-head">
            <div className="ch-icon"><Icon name="clock" size={20} /></div>
            <div><h2>Ranking por horas</h2><div className="ch-sub">Top 10 recursos · horas totales acumuladas{hasFilters ? " · filtrado" : ""}</div></div>
          </div>
          <div className="chart-box" style={{ height: 280 }}>
            {!d.recursos.recursosRanking?.length ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-3)", fontSize: 13 }}>Sin horas registradas{hasFilters ? " en el filtro" : " aún"}.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.recursos.recursosRanking} layout="vertical" margin={{ top: 4, right: 50, left: 12, bottom: 0 }} barCategoryGap={10}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} unit=" hs" />
                  <YAxis type="category" dataKey="nombre" tick={{ ...AXIS, fontSize: 11, fill: "#cfc7b6" }} width={130} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip unit="hs" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <RBar dataKey="horas" name="Horas" radius={[0, 6, 6, 0]} barSize={16}>
                    {d.recursos.recursosRanking.map((r, i) => <Cell key={i} fill={r.tipo === "vehiculo" ? "#e7b13a" : "#5b9fd4"} />)}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {d.recursos.recursosRanking?.length > 0 && (
            <div style={{ display: "flex", gap: 16, padding: "0 22px 16px", fontSize: 11.5, color: "var(--ink-3)" }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#e7b13a", marginRight: 5 }} />Vehículos</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#5b9fd4", marginRight: 5 }} />Personal</span>
            </div>
          )}
        </section>
        <section className="card col-5">
          <div className="card-head">
            <div className="ch-icon"><Icon name="resources" size={20} /></div>
            <div><h2>Recursos</h2><div className="ch-sub">Distribución en obra</div></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="chart-box gauge-wrap" style={{ height: 220, width: "55%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.recursos.distrib} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={3} stroke="none">
                    {d.recursos.distrib.map((item, i) => <Cell key={i} fill={item.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="gauge-center">
                <div className="gv" style={{ fontSize: 32 }}>{resTotal}</div>
                <div className="gl">recursos</div>
              </div>
            </div>
            <div className="legend" style={{ flex: 1 }}>
              {d.recursos.distrib.map((item, i) => (
                <div className="legend-item" key={i}>
                  <span className="sw" style={{ background: item.color }} />
                  <span className="ll">{item.name}</span>
                  <span className="lv">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        </>}

        {/* ── Tab: Producción ── */}
        {tab === "produccion" && <>
        {(() => {
          const faseKeys = Array.from(new Set(d.daily.flatMap((item) => Object.keys(item).filter((k) => k !== "d"))));
          const faseColor = (key) => { const et = d.etapas.find((e) => e.tag === key || e.name === key); return et?.color || PALETTE[faseKeys.indexOf(key) % PALETTE.length]; };
          return (
            <section className="card col-12">
              <div className="card-head">
                <div className="ch-icon"><Icon name="report" size={20} /></div>
                <div><h2>Producción diaria por parte</h2><div className="ch-sub">Últimos 10 días · por fase{hasFilters ? " · filtrado" : ""}</div></div>
                {faseKeys.length > 0 && (
                  <div className="ch-right" style={{ gap: 14 }}>
                    {faseKeys.map((k) => <span className="legend-item" key={k} style={{ fontSize: 12 }}><span className="sw" style={{ background: faseColor(k) }} /><span className="ll">{k}</span></span>)}
                  </div>
                )}
              </div>
              <div className="chart-box" style={{ height: 250 }}>
                {d.daily.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-3)", fontSize: 13 }}>Sin partes{hasFilters ? " en el filtro" : " cargados aún"}.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.daily} margin={{ top: 4, right: 12, left: -10, bottom: 0 }} barCategoryGap="28%">
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="d" tick={AXIS} axisLine={false} tickLine={false} />
                      <YAxis tick={AXIS} axisLine={false} tickLine={false} width={42} />
                      <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                      {faseKeys.map((k, i) => <RBar key={k} dataKey={k} stackId="a" fill={faseColor(k)} radius={i === faseKeys.length - 1 ? [5, 5, 0, 0] : undefined} />)}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          );
        })()}
        </>}

        {/* ── Tab: NPT ── */}
        {tab === "npt" && (() => {
          const totalHs = d.npt.reduce((s, n) => s + n.horas, 0);
          const peor = d.npt[0];
          const nptClasificado = d.npt.map((n) => ({ ...n, clasificacion: clasificacionMap[n.motivo] || "sin_clasificar" }));
          const totalPorClase = { gestionable: 0, no_gestionable: 0, sin_clasificar: 0 };
          nptClasificado.forEach((n) => { totalPorClase[n.clasificacion] += n.horas; });
          const pctGestionable = totalHs > 0 ? Math.round((totalPorClase.gestionable / totalHs) * 100) : 0;
          const pieData = ["gestionable", "no_gestionable", "sin_clasificar"]
            .map((k) => ({ key: k, horas: totalPorClase[k] }))
            .filter((p) => p.horas > 0);

          return (
            <>
              <div className="npt-kpis col-12">
                <div className="npt-kpi"><div className="npt-kpi-val">{totalHs}</div><div className="npt-kpi-lbl"><Icon name="clock" size={13} /> Total horas NPT</div></div>
                <div className="npt-kpi"><div className="npt-kpi-val">{d.npt.length}</div><div className="npt-kpi-lbl"><Icon name="alert" size={13} /> Factores distintos</div></div>
                <div className="npt-kpi"><div className="npt-kpi-val" style={{ fontSize: peor?.motivo?.length > 14 ? 18 : 24 }}>{peor ? peor.motivo : "—"}</div><div className="npt-kpi-lbl"><Icon name="target" size={13} /> Factor más impactante · {peor ? peor.horas + " hs" : ""}</div></div>
                <div className="npt-kpi"><div className="npt-kpi-val" style={{ color: totalHs > 0 ? "#e2493b" : "var(--ink)" }}>{d.progress > 0 ? Math.round((totalHs / d.progress) * 10) / 10 : 0}</div><div className="npt-kpi-lbl"><Icon name="gauge" size={13} /> hs NPT / % avance</div></div>
              </div>

              <section className="card col-12">
                <div className="card-head">
                  <div className="ch-icon" style={{ background: "rgba(226,73,59,0.15)", color: "#e2493b" }}><Icon name="alert" size={20} /></div>
                  <div><h2>Análisis de NPT</h2><div className="ch-sub">Tiempo no productivo · {totalHs} hs totales{hasFilters ? " · filtrado" : ""}</div></div>
                </div>
                <div className="chart-box" style={{ height: 220 }}>
                  {nptClasificado.length === 0 ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-3)", fontSize: 13 }}>Sin registros de NPT{hasFilters ? " en el filtro" : ""}.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={nptClasificado} layout="vertical" margin={{ top: 4, right: 40, left: 12, bottom: 0 }} barCategoryGap={12}>
                        <CartesianGrid stroke={GRID} horizontal={false} />
                        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} unit=" hs" />
                        <YAxis type="category" dataKey="motivo" tick={{ ...AXIS, fontSize: 11, fill: "#cfc7b6" }} width={160} axisLine={false} tickLine={false} />
                        <Tooltip content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const row = payload[0].payload;
                          return (<div className="rc-tip"><div className="t">{row.motivo}</div><div className="r"><span className="d" style={{ background: NPT_COLORS[row.clasificacion] }} />{NPT_LABELS[row.clasificacion]}<b>{row.horas} hs</b></div><div className="r"><span className="d" style={{ background: "transparent" }} />Ocurrencias<b>{row.ocurrencias}</b></div></div>);
                        }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                        <RBar dataKey="horas" name="Horas NPT" radius={[0, 0, 0, 0]} barSize={18} label={{ position: "right", fontSize: 11, fill: "#cfc7b6", formatter: (v) => `${v} hs` }}>
                          {nptClasificado.map((row, i) => <Cell key={i} fill={NPT_COLORS[row.clasificacion]} />)}
                        </RBar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section className="card col-12">
                <div className="card-head">
                  <div className="ch-icon" style={{ background: "rgba(231,177,58,0.15)" }}><Icon name="target" size={20} /></div>
                  <div><h2>Gestionables vs No gestionables</h2><div className="ch-sub">Qué parte del NPT era evitable con mejor planificación o control</div></div>
                </div>

                {nptClasificado.length === 0 ? (
                  <div style={{ padding: "30px 24px", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Sin registros de NPT{hasFilters ? " en el filtro" : ""}.</div>
                ) : (
                  <div className="npt-clasif-grid">
                    <div className="chart-box gauge-wrap" style={{ height: 190 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="horas" nameKey="key" innerRadius={58} outerRadius={82} paddingAngle={pieData.length > 1 ? 3 : 0} startAngle={90} endAngle={-270}>
                            {pieData.map((p) => <Cell key={p.key} fill={NPT_COLORS[p.key]} />)}
                          </Pie>
                          <Tooltip content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const p = payload[0].payload;
                            return (<div className="rc-tip"><div className="t">{NPT_LABELS[p.key]}</div><div className="r"><span className="d" style={{ background: NPT_COLORS[p.key] }} />Horas<b>{p.horas} hs</b></div></div>);
                          }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="gauge-center">
                        <div className="gv" style={{ fontSize: 32, color: "var(--gold-2)" }}>{pctGestionable}%</div>
                        <div className="gl">Gestionable</div>
                      </div>
                    </div>

                    <div className="npt-clasif-list">
                      <div className="npt-clasif-legend">
                        <span><i style={{ background: NPT_COLORS.gestionable }} /> Gestionable · {totalPorClase.gestionable} hs</span>
                        <span><i style={{ background: NPT_COLORS.no_gestionable }} /> No gestionable · {totalPorClase.no_gestionable} hs</span>
                        {totalPorClase.sin_clasificar > 0 && (
                          <span><i style={{ background: NPT_COLORS.sin_clasificar }} /> Sin clasificar · {totalPorClase.sin_clasificar} hs</span>
                        )}
                      </div>

                      {nptClasificado.map((n) => (
                        <div key={n.motivo} className="npt-clasif-row">
                          <div className="ncr-info">
                            <span className="ncr-motivo">{n.motivo}</span>
                            <span className="ncr-meta">{n.horas} hs · {n.ocurrencias} ocurrencia{n.ocurrencias !== 1 ? "s" : ""}</span>
                          </div>
                          {isAdmin ? (
                            <div className="npt-clasif-seg">
                              <button
                                className={clsx("ncs-btn", n.clasificacion === "gestionable" && "on-gestionable")}
                                disabled={savingMotivo === n.motivo}
                                onClick={() => clasificarMotivo(n.motivo, "gestionable")}
                              >Gestionable</button>
                              <button
                                className={clsx("ncs-btn", n.clasificacion === "no_gestionable" && "on-no-gestionable")}
                                disabled={savingMotivo === n.motivo}
                                onClick={() => clasificarMotivo(n.motivo, "no_gestionable")}
                              >No gestionable</button>
                            </div>
                          ) : (
                            <span className="pill" style={{ background: NPT_COLORS[n.clasificacion] + "26", color: NPT_COLORS[n.clasificacion], borderColor: NPT_COLORS[n.clasificacion] + "66" }}>
                              {NPT_LABELS[n.clasificacion]}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </>
          );
        })()}
      </div>

      {showCurvas && (
        <CurvasPlanDrawer project={project} realCurve={project.curve} onClose={() => setShowCurvas(false)} onUpdate={(updated) => setCurvasPlan(updated)} />
      )}
    </div>
  );
}
