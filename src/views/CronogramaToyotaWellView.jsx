import React from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { Icon, clsx } from '../components.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useProjects } from '../context/ProjectsContext.jsx';
import { getCronogramaToyotaWell } from '../supabase.js';
import { cacheGet, cacheSet } from '../db.js';
import { hoyISO, norm } from '../obiras.js';
import {
  ESTADOS_TAREA, FILTROS_ESTADO,
  calcularCronograma, indicadores, curvaAvance, exportarCronogramaXlsx,
  fmtFechaCorta, fmtDias, fmtDesvio,
} from '../toyotaWell.js';
import { TareaCronogramaDrawer } from '../drawers/TareaCronogramaDrawer.jsx';

// Colores de las curvas (validados contra la superficie oscura de las tarjetas).
const C_PLAN = "#4a90c8";
const C_REAL = "#5aa85a";
const AXIS = { fontSize: 11, fontFamily: "Archivo, sans-serif", fill: "#948c7c" };
const GRID = "rgba(255,255,255,0.06)";

const nf1 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (x) => `${nf1.format(x)} %`;
const fmtLargo = (iso) => (iso ? fmtFechaCorta(iso, { semana: false }) : "—");

/** Lee el cronograma; si no hay conexión, usa la última copia guardada. */
async function leerCronograma(sector) {
  const key = `toyota_well_${sector}`;
  try {
    const data = (await getCronogramaToyotaWell(sector)) || [];
    cacheSet(key, data).catch(() => {});
    return { data, offline: false };
  } catch (e) {
    const cached = await cacheGet(key).catch(() => null);
    if (cached) return { data: cached, offline: true };
    return { error: e.message || "No se pudo cargar el cronograma" };
  }
}

/* ── Curva de avance vs fecha ─────────────────────────────────────────── */

function TipCurva({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const fila = payload[0].payload;
  const real = fila.real ?? fila.proy;
  const desvio = real != null ? real - fila.plan : null;
  return (
    <div className="rc-tip">
      <div className="t">{fmtFechaCorta(label)}</div>
      <div className="r"><span className="d" style={{ background: C_PLAN }} />Planificado<b>{pct(fila.plan)}</b></div>
      {fila.real != null && <div className="r"><span className="d" style={{ background: C_REAL }} />Real<b>{pct(fila.real)}</b></div>}
      {fila.real == null && fila.proy != null && (
        <div className="r"><span className="d tw-tip-dash" style={{ borderColor: C_REAL }} />Proyección<b>{pct(fila.proy)}</b></div>
      )}
      {desvio != null && (
        <div className="r tw-tip-desvio">Desvío<b className={desvio < -0.05 ? "neg" : ""}>{desvio > 0 ? "+" : desvio < 0 ? "−" : ""}{nf1.format(Math.abs(desvio))} pts</b></div>
      )}
    </div>
  );
}

function CurvaAvanceCard({ crono, hoy }) {
  const etapas = React.useMemo(() => crono.lista.filter((n) => n.esResumen && n.nivel === 2), [crono]);
  const [ambito, setAmbito] = React.useState("");
  const nodo = ambito ? crono.nodos.get(Number(ambito)) : null;
  const hojas = React.useMemo(() => (nodo ? crono.hojasDe(nodo) : crono.hojas), [crono, nodo]);
  const datos = React.useMemo(() => curvaAvance(hojas, hoy), [hojas, hoy]);
  const k = React.useMemo(() => indicadores(hojas, hoy), [hojas, hoy]);
  const desvio = k.real - k.plan;

  return (
    <section className="card tw-curva">
      <div className="card-head">
        <div className="ch-icon"><Icon name="chart" size={20} /></div>
        <div>
          <h2>Avance vs fecha</h2>
          <div className="ch-sub">
            Al {fmtLargo(hoy)}: real {pct(k.real)} vs plan {pct(k.plan)} ({desvio >= 0 ? "+" : "−"}{nf1.format(Math.abs(desvio))} pts)
            · fin proyectado {fmtLargo(k.finEst)}{k.desvioFin ? ` (${fmtDesvio(k.desvioFin)} hábiles)` : ""}
          </div>
        </div>
        <div className="ch-right">
          <select className="select tw-ambito" value={ambito} onChange={(e) => setAmbito(e.target.value)} aria-label="Ámbito del gráfico">
            <option value="">Todo el cronograma</option>
            {etapas.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className="tw-legend">
        <span><i className="tw-sw" style={{ background: C_PLAN }} />Planificado (línea base)</span>
        <span><i className="tw-sw" style={{ background: C_REAL }} />Real</span>
        <span><i className="tw-sw tw-sw-dash" style={{ borderColor: C_REAL }} />Proyección según avance real</span>
      </div>
      <div className="chart-box" style={{ height: 300 }}>
        {datos.length === 0 ? (
          <div className="tw-chart-empty">Sin fechas planificadas para graficar.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={datos} margin={{ top: 14, right: 18, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="twReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C_REAL} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C_REAL} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="fecha" tick={AXIS} axisLine={false} tickLine={false} minTickGap={36}
                tickFormatter={(iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" tick={AXIS} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<TipCurva />} cursor={{ stroke: "rgba(245,239,224,0.25)" }} />
              <ReferenceLine x={hoy} stroke="rgba(245,239,224,0.45)" strokeDasharray="3 3"
                label={{ value: "Hoy", position: "insideTopLeft", fill: "#cfc7b6", fontSize: 11 }} />
              <Line type="linear" dataKey="plan" name="Planificado" stroke={C_PLAN} strokeWidth={2} dot={false}
                activeDot={{ r: 4, stroke: "#26241f", strokeWidth: 2 }} isAnimationActive={false} />
              <Area type="linear" dataKey="real" name="Real" stroke={C_REAL} strokeWidth={2} fill="url(#twReal)" dot={false}
                activeDot={{ r: 4, stroke: "#26241f", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
              <Line type="linear" dataKey="proy" name="Proyección" stroke={C_REAL} strokeWidth={2} strokeDasharray="6 4" dot={false}
                activeDot={{ r: 4, stroke: "#26241f", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

/* ── Celdas de la tabla ───────────────────────────────────────────────── */

function Progreso({ valor }) {
  const v = Math.round(valor);
  return (
    <div className="tw-prog" title={`${nf1.format(valor)} % completado`}>
      <div className="tw-prog-track"><div className={clsx("tw-prog-fill", v >= 100 && "done")} style={{ width: `${Math.min(100, v)}%` }} /></div>
      <span>{v}%</span>
    </div>
  );
}

const contexto = (n) => n.ruta.slice(1).join(" › ");

function ChipsPredecesoras({ n, onAbrir }) {
  if (!n.preds.length) return null;
  return (
    <div className="tw-preds">
      {n.preds.map((p) => {
        const hecha = p.completa;
        return (
          <button key={p.id} type="button" className={clsx("tw-pred", hecha ? "done" : "pend")}
            title={`${p.orden} · ${p.nombre} (${contexto(p)}) — ${hecha ? "completada" : `${Math.round(p.avanceCalc)} %, termina ≈ ${fmtLargo(p.finEst)}`}`}
            onClick={(e) => { e.stopPropagation(); if (!p.esResumen) onAbrir(p.id); }}>
            {hecha && <Icon name="check" size={11} />}{p.orden}
          </button>
        );
      })}
    </div>
  );
}

function Desvio({ n }) {
  if (n.pF == null) return <span className="tw-muted">—</span>;
  return (
    <span className={clsx("tw-desvio", n.desvio > 0 && "pos", n.desvio < 0 && "neg")}
      title={`Fin plan ${fmtLargo(n.finPlan)} · fin ${n.finReal ? "real" : "proyectado"} ${fmtLargo(n.finReal || n.finEst)} (días hábiles)`}>
      {n.desvio === 0 ? "0 d" : fmtDesvio(n.desvio)}
    </span>
  );
}

/* ── Vista ────────────────────────────────────────────────────────────── */

export function CronogramaToyotaWellView({ sector }) {
  const { isAdmin } = useAuth();
  const { setToast } = useProjects();
  const [hoy] = React.useState(hoyISO);

  const [tareas, setTareas] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [offline, setOffline] = React.useState(false);

  const [query, setQuery] = React.useState("");
  const [filtro, setFiltro] = React.useState("");
  const [cerrados, setCerrados] = React.useState(() => new Set());
  const [abiertaId, setAbiertaId] = React.useState(null);
  const [exportando, setExportando] = React.useState(false);

  const aplicar = React.useCallback((r) => {
    if (r.error) setError(r.error);
    else { setTareas(r.data); setOffline(r.offline); setError(null); }
    setLoading(false);
  }, []);
  const cargar = React.useCallback(() => leerCronograma(sector).then(aplicar), [sector, aplicar]);

  React.useEffect(() => {
    let vivo = true;
    leerCronograma(sector).then((r) => { if (vivo) aplicar(r); });
    return () => { vivo = false; };
  }, [sector, aplicar]);

  const refrescar = () => { setLoading(true); cargar(); };

  const crono = React.useMemo(() => calcularCronograma(tareas, hoy), [tareas, hoy]);
  const k = React.useMemo(() => indicadores(crono.hojas, hoy), [crono, hoy]);

  // Filas visibles: con búsqueda o filtro se muestran las hojas que coinciden y
  // sus resúmenes (todo expandido); sin filtro, respeta lo contraído.
  const filas = React.useMemo(() => {
    const palabras = norm(query.trim()).split(/\s+/).filter(Boolean);
    const filtrando = palabras.length > 0 || filtro;
    if (!filtrando) {
      return crono.lista.filter((n) => {
        for (let p = n.padre; p; p = p.padre) if (cerrados.has(p.id)) return false;
        return true;
      });
    }
    const pasa = (n) => {
      if (filtro === "atrasadas" && !n.atrasadaAbierta) return false;
      if (filtro === "sin_justificar" && !n.sinJustificar) return false;
      if (filtro && !["atrasadas", "sin_justificar"].includes(filtro) && n.estado !== filtro) return false;
      if (palabras.length) {
        const texto = norm([...n.ruta, n.nombre].join(" "));
        if (!palabras.every((w) => texto.includes(w) || String(n.orden) === w)) return false;
      }
      return true;
    };
    const visibles = new Set();
    crono.hojas.filter(pasa).forEach((h) => {
      visibles.add(h.id);
      for (let p = h.padre; p; p = p.padre) visibles.add(p.id);
    });
    return crono.lista.filter((n) => visibles.has(n.id));
  }, [crono, query, filtro, cerrados]);

  const filtrando = !!(query.trim() || filtro);
  const resumenes = crono.lista.filter((n) => n.esResumen);
  const toggle = (id) => setCerrados((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });
  const expandirTodo = () => setCerrados(new Set());
  const contraerAEtapas = () => setCerrados(new Set(resumenes.filter((n) => n.nivel >= 2).map((n) => n.id)));

  const exportar = async () => {
    setExportando(true);
    try { await exportarCronogramaXlsx(crono, sector, hoy); }
    catch (e) { setToast(`No se pudo exportar: ${e.message || e}`); }
    finally { setExportando(false); }
  };

  const abierta = abiertaId != null ? crono.nodos.get(abiertaId) : null;
  const onSaved = (msg) => { setAbiertaId(null); setToast(msg); cargar(); };

  const raiz = crono.raices[0];

  return (
    <div className="fade-in">
      <div className="home-head" style={{ marginBottom: 14 }}>
        <div>
          <h2 className="home-h2">Cronograma de implementación</h2>
          <p className="home-sub">
            Toyota Well · {sector}
            {raiz && <> · línea base {fmtLargo(raiz.inicioPlan)} → {fmtLargo(raiz.finPlan)} · {k.total} tareas</>}
          </p>
        </div>
        {offline && (
          <span className="pill pill-cream-gold" title="No hay conexión con la base: se muestran los últimos datos descargados">
            <Icon name="wifiOff" size={13} /> Sin conexión · datos guardados
          </span>
        )}
      </div>

      {loading && tareas.length === 0 ? (
        <div className="rec-table-outer"><div className="rec-empty"><Icon name="refresh" size={22} style={{ animation: "spin 0.7s linear infinite" }} /></div></div>
      ) : error ? (
        <div className="rec-table-outer">
          <div className="rec-empty">
            <div style={{ color: "var(--red)", marginBottom: 12 }}>{error}</div>
            <button className="btn btn-cream btn-sm" onClick={refrescar}><Icon name="refresh" size={14} /> Reintentar</button>
          </div>
        </div>
      ) : tareas.length === 0 ? (
        <div className="rec-table-outer">
          <div className="rec-empty">Todavía no hay un cronograma cargado para {sector}.</div>
        </div>
      ) : (
        <>
          <div className="kpi-row tw-kpis">
            <div className="kpi">
              <div className="kpi-ic" style={{ background: "rgba(90,168,90,0.16)", color: C_REAL }}><Icon name="gauge" /></div>
              <div className="kpi-val">{nf1.format(k.real)}<small> %</small></div>
              <div className="kpi-lbl">Avance real · plan a hoy {pct(k.plan)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-ic" style={{ background: "rgba(74,144,200,0.16)", color: C_PLAN }}><Icon name="calendar" /></div>
              <div className="kpi-val tw-kpi-fecha">{fmtLargo(k.finEst)}</div>
              <div className="kpi-lbl">
                Fin proyectado · plan {fmtLargo(k.finPlan)}
                {k.desvioFin !== 0 && <b className={clsx("tw-kpi-desvio", k.desvioFin > 0 ? "pos" : "neg")}> {fmtDesvio(k.desvioFin)}</b>}
              </div>
            </div>
            <button type="button" className={clsx("kpi tw-kpi-btn", filtro === "atrasadas" && "on")} onClick={() => setFiltro((f) => (f === "atrasadas" ? "" : "atrasadas"))}
              title="Ver las tareas atrasadas">
              <div className="kpi-ic" style={{ background: "rgba(226,73,59,0.16)", color: "var(--red)" }}><Icon name="alert" /></div>
              <div className="kpi-val">{k.atrasadas}</div>
              <div className="kpi-lbl">
                Tareas atrasadas · {k.sinJustificar > 0
                  ? <b className="tw-kpi-desvio pos">{k.sinJustificar} sin justificar</b>
                  : "todas justificadas"}
              </div>
            </button>
            <button type="button" className={clsx("kpi tw-kpi-btn", filtro === "lista" && "on")} onClick={() => setFiltro((f) => (f === "lista" ? "" : "lista"))}
              title="Ver las tareas que ya pueden empezar">
              <div className="kpi-ic" style={{ background: "rgba(231,177,58,0.16)", color: "var(--gold-2)" }}><Icon name="target" /></div>
              <div className="kpi-val">{k.listas}</div>
              <div className="kpi-lbl">
                Listas para empezar · {k.enCurso} en curso
                {k.bloqueadas > 0 && <> · <b className="tw-kpi-desvio pos">{k.bloqueadas} bloqueada{k.bloqueadas !== 1 ? "s" : ""}</b></>}
              </div>
            </button>
          </div>

          <CurvaAvanceCard crono={crono} hoy={hoy} />

          <div className="rec-table-outer" style={{ marginTop: 22 }}>
            <div className="obi-toolbar">
              <div className="rec-search">
                <Icon name="search" size={15} />
                <input className="rec-search-input" placeholder="Buscar tarea, etapa o Id…" value={query} onChange={(e) => setQuery(e.target.value)} />
                {query && <button className="obi-iconlink" onClick={() => setQuery("")} title="Limpiar búsqueda"><Icon name="x" size={13} /></button>}
              </div>
              <div className="obi-tools">
                <select className="select obi-select-sm" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por estado">
                  {FILTROS_ESTADO.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <button className="btn btn-cream btn-sm" onClick={cerrados.size ? expandirTodo : contraerAEtapas} disabled={filtrando}
                  title={filtrando ? "Con búsqueda o filtro se muestra todo expandido" : undefined}>
                  <Icon name={cerrados.size ? "chevDown" : "chevUp"} size={14} /> {cerrados.size ? "Expandir todo" : "Contraer a etapas"}
                </button>
                <button className="btn btn-cream btn-sm" onClick={refrescar} disabled={loading} title="Actualizar" aria-label="Actualizar">
                  <Icon name="refresh" size={15} style={{ animation: loading ? "spin 0.7s linear infinite" : "none" }} />
                </button>
                <button className="btn btn-cream btn-sm" onClick={exportar} disabled={exportando}>
                  <Icon name="download" size={14} /> {exportando ? "Exportando…" : "Exportar a Excel"}
                </button>
              </div>
            </div>

            {filas.length === 0 ? (
              <div className="rec-empty">Ninguna tarea coincide con la búsqueda o el filtro.</div>
            ) : (
              <div className="rec-table-wrap">
                <table className="rec-table tw-table">
                  <thead>
                    <tr>
                      <th className="tw-c-id">Id</th>
                      <th>Nombre de tarea</th>
                      <th>Duración</th>
                      <th>Comienzo</th>
                      <th>Fin</th>
                      <th>Comienzo real</th>
                      <th title="Fin real; si la tarea no terminó, fin proyectado (≈)">Fin real / proy.</th>
                      <th>% completado</th>
                      <th>Predecesoras</th>
                      <th>Estado</th>
                      <th title="Fin real o proyectado contra el fin del plan, en días hábiles">Desvío</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((n) => {
                      const cerrado = cerrados.has(n.id) && !filtrando;
                      const est = ESTADOS_TAREA[n.estado];
                      return (
                        <tr key={n.id} className={clsx(n.esResumen ? "tw-resumen" : "tw-hoja", n.esResumen && `tw-nivel-${Math.min(n.nivel, 3)}`)}
                          onClick={() => (n.esResumen ? (!filtrando && toggle(n.id)) : setAbiertaId(n.id))}
                          title={n.esResumen ? undefined : "Registrar avance / ver qué falta"}>
                          <td className="tw-c-id mono">{n.orden}</td>
                          <td className="tw-c-nombre" style={{ paddingLeft: 10 + (n.nivel - 1) * 18 }}>
                            <span className="tw-nombre">
                              {n.esResumen
                                ? <span className={clsx("tw-caret", cerrado && "cerrado")}><Icon name="chevDown" size={13} /></span>
                                : <span className="tw-caret-sp" />}
                              <span className="tw-nombre-txt">{n.nombre}</span>
                              {n.notas && <span className="tw-nota" title={n.notas}><Icon name="edit" size={12} /></span>}
                            </span>
                          </td>
                          <td className="obi-nowrap">{fmtDias(n.dur)}</td>
                          <td className="obi-nowrap">{fmtFechaCorta(n.inicioPlan)}</td>
                          <td className="obi-nowrap">{fmtFechaCorta(n.finPlan)}</td>
                          <td className="obi-nowrap">
                            {n.inicioReal ? fmtFechaCorta(n.inicioReal)
                              : <span className="tw-est" title="Comienzo proyectado">≈ {fmtFechaCorta(n.inicioEst)}</span>}
                          </td>
                          <td className="obi-nowrap">
                            {n.finReal ? fmtFechaCorta(n.finReal)
                              : <span className={clsx("tw-est", n.eF > n.pF && "tarde")} title="Fin proyectado">≈ {fmtFechaCorta(n.finEst)}</span>}
                          </td>
                          <td><Progreso valor={n.avanceCalc} /></td>
                          <td><ChipsPredecesoras n={n} onAbrir={setAbiertaId} /></td>
                          <td className="obi-nowrap">
                            {n.esResumen ? (
                              <>
                                {n.nAtrasadas > 0 && <span className="tw-mini rojo">{n.nAtrasadas} atrasada{n.nAtrasadas !== 1 ? "s" : ""}</span>}
                                {n.completa && <span className="tw-mini verde">Completa</span>}
                              </>
                            ) : (
                              <span className="tw-estado">
                                <span className={clsx("pill", est.pill)}
                                  title={n.predsPendientes.length && !n.empezada ? `Esperando: ${n.predsPendientes.map((p) => p.orden).join(", ")}` : undefined}>
                                  {est.label}
                                </span>
                                {n.sinJustificar && (
                                  <span className="pill pill-red tw-sinjust" title="Atraso sin justificar: abrí la tarea para justificar el desvío">
                                    <Icon name="alert" size={11} /> Sin justificar
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="obi-nowrap"><Desvio n={n} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {abierta && (
        <TareaCronogramaDrawer
          key={abierta.id}
          tarea={abierta}
          crono={crono}
          hoy={hoy}
          isAdmin={isAdmin}
          onClose={() => setAbiertaId(null)}
          onAbrir={setAbiertaId}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
