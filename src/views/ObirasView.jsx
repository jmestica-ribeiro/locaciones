import React from 'react';
import { Icon, clsx } from '../components.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useProjects } from '../context/ProjectsContext.jsx';
import { getObiras, getUbicacionesObiras, getResponsablesSugeridos } from '../supabase.js';
import { cacheGet, cacheSet } from '../db.js';
import {
  SECTORES, ESTADOS, ESTADO_PILL,
  cantidadEnHoras, fmtCantidad, fmtFecha, norm, exportarObirasXlsx,
} from '../obiras.js';
import { ObiraDrawer } from '../drawers/ObiraDrawer.jsx';
import { AccionesDefinitivasDrawer } from '../drawers/AccionesDefinitivasDrawer.jsx';

const CACHE_KEY = "obiras";
const FILTROS_VACIOS = { sector: "", estado: "", ubicacion: "", responsable: "", desde: "", hasta: "" };

const COLUMNAS = [
  { key: "id", label: "ID" },
  { key: "cantidad", label: "Cantidad" },
  { key: "sector", label: "Sector" },
  { key: "ubicacion", label: "Ubicación" },
  { key: "titulo", label: "Título del problema" },
  { key: "estado", label: "Estado general" },
  { key: "fecha_ocurrencia", label: "Fecha de ocurrencia" },
  { key: "responsable", label: "Responsable" },
];

const comparar = {
  id: (a, b) => a.id - b.id,
  cantidad: (a, b) => cantidadEnHoras(a) - cantidadEnHoras(b),
  estado: (a, b) => ESTADOS.indexOf(a.estado) - ESTADOS.indexOf(b.estado),
  fecha_ocurrencia: (a, b) => String(a.fecha_ocurrencia).localeCompare(String(b.fecha_ocurrencia)),
};
const compararTexto = (k) => (a, b) => String(a[k] ?? "").localeCompare(String(b[k] ?? ""), "es", { sensitivity: "base" });

/** Lee las obiras de la base; si no hay conexión, usa la última copia guardada. */
async function leerObiras() {
  try {
    const data = (await getObiras()) || [];
    cacheSet(CACHE_KEY, data).catch(() => {});
    return { data, offline: false };
  } catch (e) {
    const cached = await cacheGet(CACHE_KEY).catch(() => null);
    if (cached) return { data: cached, offline: true };
    return { error: e.message || "No se pudieron cargar las obiras" };
  }
}

export function ObirasView() {
  const { isAdmin } = useAuth();
  const { setToast } = useProjects();

  const [obiras, setObiras] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [offline, setOffline] = React.useState(false);
  const [ubicaciones, setUbicaciones] = React.useState([]);
  const [responsablesBase, setResponsablesBase] = React.useState([]);

  const [query, setQuery] = React.useState("");
  const [filtrosOpen, setFiltrosOpen] = React.useState(false);
  const [filtros, setFiltros] = React.useState(FILTROS_VACIOS);
  const [orden, setOrden] = React.useState({ key: "id", dir: "asc" });
  const [seleccion, setSeleccion] = React.useState(() => new Set());
  const [abierta, setAbierta] = React.useState(null); // obira | { nueva: true }
  const [listadoOpen, setListadoOpen] = React.useState(false);
  const [exportando, setExportando] = React.useState(false);

  const aplicar = React.useCallback((r) => {
    if (r.error) setError(r.error);
    else { setObiras(r.data); setOffline(r.offline); setError(null); }
    setLoading(false);
  }, []);
  const cargar = React.useCallback(() => leerObiras().then(aplicar), [aplicar]);

  React.useEffect(() => {
    let vivo = true;
    leerObiras().then((r) => { if (vivo) aplicar(r); });
    return () => { vivo = false; };
  }, [aplicar]);
  React.useEffect(() => {
    getUbicacionesObiras().then((d) => setUbicaciones((d || []).map((u) => u.nombre))).catch(() => {});
    getResponsablesSugeridos().then(setResponsablesBase).catch(() => {});
  }, []);

  const refrescar = () => { setLoading(true); cargar(); };

  // Sugerencias de responsable: usuarios + personal + los ya usados en obiras y acciones.
  const responsables = React.useMemo(() => {
    const s = new Set(responsablesBase);
    obiras.forEach((o) => {
      if (o.responsable) s.add(o.responsable);
      (o.acciones || []).forEach((a) => a.responsable && s.add(a.responsable));
    });
    return [...s].sort((a, b) => a.localeCompare(b, "es"));
  }, [responsablesBase, obiras]);

  const responsablesUsados = React.useMemo(
    () => [...new Set(obiras.map((o) => o.responsable).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [obiras]);

  const filtradas = React.useMemo(() => {
    const q = norm(query.trim());
    const f = filtros;
    const lista = obiras.filter((o) => {
      if (f.sector && o.sector !== f.sector) return false;
      if (f.estado && o.estado !== f.estado) return false;
      if (f.ubicacion && !norm(o.ubicacion).includes(norm(f.ubicacion))) return false;
      if (f.responsable && o.responsable !== f.responsable) return false;
      if (f.desde && o.fecha_ocurrencia < f.desde) return false;
      if (f.hasta && o.fecha_ocurrencia > f.hasta) return false;
      if (q && ![o.id, o.titulo, o.detalle, o.ubicacion, o.etapa_constructiva, o.responsable].some((v) => norm(v).includes(q))) return false;
      return true;
    });
    const cmp = comparar[orden.key] || compararTexto(orden.key);
    lista.sort((a, b) => (orden.dir === "asc" ? 1 : -1) * (cmp(a, b) || a.id - b.id));
    return lista;
  }, [obiras, query, filtros, orden]);

  const nFiltros = Object.values(filtros).filter(Boolean).length;
  const setFiltro = (k, v) => setFiltros((f) => ({ ...f, [k]: v }));

  const porEstado = React.useMemo(() => {
    const c = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
    obiras.forEach((o) => { if (o.estado in c) c[o.estado]++; });
    return c;
  }, [obiras]);

  /* ── Selección ── */
  const visiblesIds = filtradas.map((o) => o.id);
  const nSelVisibles = visiblesIds.filter((id) => seleccion.has(id)).length;
  const todasSel = visiblesIds.length > 0 && nSelVisibles === visiblesIds.length;
  const toggleSel = (id) => setSeleccion((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleTodas = () => setSeleccion((s) => {
    const n = new Set(s);
    if (todasSel) visiblesIds.forEach((id) => n.delete(id));
    else visiblesIds.forEach((id) => n.add(id));
    return n;
  });

  const ordenarPor = (key) => setOrden((o) => (o.key === key ? { key, dir: o.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const exportar = async () => {
    const lista = seleccion.size ? obiras.filter((o) => seleccion.has(o.id)) : filtradas;
    if (!lista.length) return;
    setExportando(true);
    try { await exportarObirasXlsx(lista); }
    catch (e) { setToast(`No se pudo exportar: ${e.message || e}`); }
    finally { setExportando(false); }
  };

  const onSaved = (id, { nueva, fallos }) => {
    setAbierta(null);
    cargar();
    setToast(fallos.length
      ? `Obira #${id} guardada, pero ${fallos.join(" y ")}`
      : nueva ? `Obira #${id} creada` : `Obira #${id} guardada`);
  };

  const onDeleted = (id) => {
    setAbierta(null);
    setObiras((prev) => prev.filter((o) => o.id !== id));
    setSeleccion((s) => { const n = new Set(s); n.delete(id); return n; });
    setToast(`Obira #${id} eliminada`);
    cargar();
  };

  return (
    <div className="fade-in">
      <div className="home-head" style={{ marginBottom: 14 }}>
        <div>
          <h2 className="home-h2">Tablero de obiras</h2>
          <p className="home-sub">
            {obiras.length} obira{obiras.length !== 1 ? "s" : ""}
            {ESTADOS.map((e) => <React.Fragment key={e}> · {porEstado[e]} {e.toLowerCase()}</React.Fragment>)}
          </p>
        </div>
        {offline && (
          <span className="pill pill-cream-gold" title="No hay conexión con la base: se muestran los últimos datos descargados">
            <Icon name="wifiOff" size={13} /> Sin conexión · datos guardados
          </span>
        )}
      </div>

      <div className="rec-table-outer">
        <div className="obi-toolbar">
          <div className="rec-search">
            <Icon name="search" size={15} />
            <input className="rec-search-input" placeholder="Buscar por ID, título, ubicación…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && (
              <button className="obi-iconlink" onClick={() => setQuery("")} title="Limpiar búsqueda"><Icon name="x" size={13} /></button>
            )}
          </div>
          <div className="obi-tools">
            <button className="btn btn-cream btn-sm" onClick={refrescar} disabled={loading} title="Actualizar" aria-label="Actualizar">
              <Icon name="refresh" size={15} style={{ animation: loading ? "spin 0.7s linear infinite" : "none" }} />
            </button>
            <button className={clsx("btn btn-cream btn-sm", filtrosOpen && "obi-btn-on")} onClick={() => setFiltrosOpen((v) => !v)}>
              <Icon name="filter" size={14} /> Filtros
              {nFiltros > 0 && <span className="obi-badge">{nFiltros}</span>}
            </button>
            <button className="btn btn-cream btn-sm" onClick={exportar} disabled={exportando || (seleccion.size === 0 && filtradas.length === 0)}>
              <Icon name="download" size={14} />
              {exportando ? "Exportando…" : seleccion.size ? `Exportar ${seleccion.size} a Excel` : "Exportar a Excel"}
            </button>
            <button className="btn btn-dark btn-sm" onClick={() => setListadoOpen(true)}>
              <Icon name="checkCircle" size={14} /> Listado de acciones definitivas
            </button>
            <button className="btn btn-gold btn-sm" onClick={() => setAbierta({ nueva: true })}>
              <Icon name="plus" size={14} /> Cargar ítem
            </button>
          </div>
        </div>

        {filtrosOpen && (
          <div className="obi-filters">
            <div>
              <label htmlFor="obi-f-sector">Sector</label>
              <select id="obi-f-sector" className="select" value={filtros.sector} onChange={(e) => setFiltro("sector", e.target.value)}>
                <option value="">Todos</option>
                {SECTORES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="obi-f-estado">Estado general</label>
              <select id="obi-f-estado" className="select" value={filtros.estado} onChange={(e) => setFiltro("estado", e.target.value)}>
                <option value="">Todos</option>
                {ESTADOS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="obi-f-ubic">Ubicación</label>
              <input id="obi-f-ubic" className="input" placeholder="Contiene…" value={filtros.ubicacion} onChange={(e) => setFiltro("ubicacion", e.target.value)} />
            </div>
            <div>
              <label htmlFor="obi-f-resp">Responsable</label>
              <select id="obi-f-resp" className="select" value={filtros.responsable} onChange={(e) => setFiltro("responsable", e.target.value)}>
                <option value="">Todos</option>
                {responsablesUsados.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="obi-f-desde">Ocurrencia desde</label>
              <input id="obi-f-desde" type="date" className="input" value={filtros.desde} onChange={(e) => setFiltro("desde", e.target.value)} />
            </div>
            <div>
              <label htmlFor="obi-f-hasta">Ocurrencia hasta</label>
              <input id="obi-f-hasta" type="date" className="input" value={filtros.hasta} onChange={(e) => setFiltro("hasta", e.target.value)} />
            </div>
            <div>
              <button className="btn btn-cream btn-sm" onClick={() => setFiltros(FILTROS_VACIOS)} disabled={nFiltros === 0}>
                <Icon name="x" size={13} /> Limpiar filtros
              </button>
            </div>
          </div>
        )}

        {seleccion.size > 0 && (
          <div className="obi-selbar">
            <Icon name="checkCircle" size={15} />
            <span><b>{seleccion.size}</b> obira{seleccion.size !== 1 ? "s" : ""} seleccionada{seleccion.size !== 1 ? "s" : ""} · la exportación incluye solo la selección</span>
            <button className="obi-linkbtn" onClick={() => setSeleccion(new Set())}>Quitar selección</button>
          </div>
        )}

        {loading && obiras.length === 0 ? (
          <div className="rec-empty"><Icon name="refresh" size={22} style={{ animation: "spin 0.7s linear infinite" }} /></div>
        ) : error ? (
          <div className="rec-empty">
            <div style={{ color: "var(--red)", marginBottom: 12 }}>{error}</div>
            <button className="btn btn-cream btn-sm" onClick={refrescar}><Icon name="refresh" size={14} /> Reintentar</button>
          </div>
        ) : obiras.length === 0 ? (
          <div className="rec-empty">
            <div style={{ marginBottom: 14 }}>Todavía no hay obiras cargadas.</div>
            <button className="btn btn-gold btn-sm" onClick={() => setAbierta({ nueva: true })}><Icon name="plus" size={14} /> Cargar la primera</button>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="rec-empty">Ninguna obira coincide con la búsqueda o los filtros.</div>
        ) : (
          <div className="rec-table-wrap">
            <table className="rec-table obi-table">
              <thead>
                <tr>
                  <th className="obi-check">
                    <input type="checkbox" aria-label="Seleccionar todas" checked={todasSel}
                      ref={(el) => { if (el) el.indeterminate = nSelVisibles > 0 && !todasSel; }}
                      onChange={toggleTodas} />
                  </th>
                  <th className="obi-check" />
                  {COLUMNAS.map((c) => (
                    <th key={c.key} aria-sort={orden.key === c.key ? (orden.dir === "asc" ? "ascending" : "descending") : undefined}>
                      <button className={clsx("obi-th-sort", orden.key === c.key && "on")} onClick={() => ordenarPor(c.key)}>
                        {c.label}
                        {orden.key === c.key && <Icon name={orden.dir === "asc" ? "chevUp" : "chevDown"} size={12} />}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((o) => (
                  <tr key={o.id} className={clsx(seleccion.has(o.id) && "sel")} onClick={() => setAbierta(o)}>
                    <td className="obi-check" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Seleccionar obira ${o.id}`} checked={seleccion.has(o.id)} onChange={() => toggleSel(o.id)} />
                    </td>
                    <td className="obi-check">
                      <button className="obi-open" title={`Abrir obira #${o.id}`} aria-label={`Abrir obira ${o.id}`}
                        onClick={(e) => { e.stopPropagation(); setAbierta(o); }}>
                        <Icon name="chevR" size={15} />
                      </button>
                    </td>
                    <td className="mono">{o.id}</td>
                    <td className="obi-nowrap">{fmtCantidad(o.cantidad, o.unidad)}</td>
                    <td className="obi-nowrap">{o.sector}</td>
                    <td className="mono obi-nowrap">{o.ubicacion}</td>
                    <td className="obi-cell-clip" title={o.titulo}>{o.titulo}</td>
                    <td><span className={clsx("pill", ESTADO_PILL[o.estado] || "pill-dim2")}>{o.estado}</span></td>
                    <td className="obi-nowrap">{fmtFecha(o.fecha_ocurrencia)}</td>
                    <td className="obi-nowrap">{o.responsable || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {abierta && (
        <ObiraDrawer
          key={abierta.id ?? "nueva"}
          obira={abierta.nueva ? null : abierta}
          ubicaciones={ubicaciones}
          responsables={responsables}
          isAdmin={isAdmin}
          onClose={() => setAbierta(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}

      {listadoOpen && (
        <AccionesDefinitivasDrawer
          obiras={obiras}
          onClose={() => setListadoOpen(false)}
          onAbrirObira={(o) => { setListadoOpen(false); setAbierta(o); }}
        />
      )}
    </div>
  );
}
