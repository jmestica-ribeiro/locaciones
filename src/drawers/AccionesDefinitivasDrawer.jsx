import React from 'react';
import { Icon, clsx } from '../components.jsx';
import { SECTORES, STATUS_DEFINITIVA, fmtFecha, porOrden, norm, statusPill, exportarAccionesDefinitivasXlsx } from '../obiras.js';

/** Listado de todas las acciones definitivas cargadas en las obiras. */
export function AccionesDefinitivasDrawer({ obiras, onClose, onAbrirObira }) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [sector, setSector] = React.useState("");
  const [exportando, setExportando] = React.useState(false);

  const items = React.useMemo(() => obiras
    .flatMap((o) => (o.acciones || []).filter((a) => a.tipo === "definitiva").sort(porOrden).map((a) => ({ o, a })))
    .sort((x, y) => x.o.id - y.o.id), [obiras]);

  // Opciones de status: las predefinidas más cualquier otra que ya esté cargada.
  const opcionesStatus = React.useMemo(() => {
    const extra = items.map(({ a }) => a.status).filter((s) => s && !STATUS_DEFINITIVA.includes(s));
    return [...STATUS_DEFINITIVA, ...new Set(extra)];
  }, [items]);

  const filtrados = React.useMemo(() => {
    const q = norm(query);
    return items.filter(({ o, a }) => {
      if (sector && o.sector !== sector) return false;
      if (status === "__sin" ? a.status : status && a.status !== status) return false;
      if (q && ![o.id, o.titulo, a.descripcion, a.responsable, o.ubicacion].some((v) => norm(v).includes(q))) return false;
      return true;
    });
  }, [items, query, status, sector]);

  const exportar = async () => {
    setExportando(true);
    try { await exportarAccionesDefinitivasXlsx(filtrados); } finally { setExportando(false); }
  };

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer obi-drawer" role="dialog" aria-modal="true" aria-label="Listado de acciones definitivas">
        <div className="drawer-head">
          <div className="ch-icon"><Icon name="checkCircle" size={20} /></div>
          <div>
            <h2>Listado de acciones definitivas</h2>
            <p>Contramedidas cargadas en cada obira · {items.length} en total</p>
          </div>
          <button className="btn btn-cream btn-sm" style={{ marginLeft: "auto" }} onClick={onClose} title="Cerrar">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="drawer-body" style={{ padding: 0 }}>
          <div className="obi-toolbar">
            <div className="rec-search">
              <Icon name="search" size={15} />
              <input className="rec-search-input" placeholder="Buscar contramedida, obira, responsable…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="obi-tools">
              <select className="select obi-select-sm" value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector">
                <option value="">Todos los sectores</option>
                {SECTORES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select className="select obi-select-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
                <option value="">Todos los status</option>
                {opcionesStatus.map((s) => <option key={s}>{s}</option>)}
                <option value="__sin">Sin status</option>
              </select>
              <button className="btn btn-cream btn-sm" onClick={exportar} disabled={exportando || filtrados.length === 0}>
                <Icon name="download" size={14} /> {exportando ? "Exportando…" : "Exportar a Excel"}
              </button>
            </div>
          </div>

          {filtrados.length === 0 ? (
            <div className="rec-empty">
              {items.length === 0 ? "Todavía no hay acciones definitivas cargadas en ninguna obira." : "Ninguna acción coincide con los filtros."}
            </div>
          ) : (
            <div className="rec-table-wrap">
              <table className="rec-table obi-table obi-table-acciones">
                <thead>
                  <tr>
                    <th>Obira</th>
                    <th>Título del problema</th>
                    <th>Contramedida</th>
                    <th>Fecha de implementación</th>
                    <th>Responsable</th>
                    <th>Status acción definitiva</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(({ o, a }) => (
                    <tr key={a.id} onClick={() => onAbrirObira(o)} title={`Abrir obira #${o.id}`}>
                      <td className="mono obi-nowrap">#{o.id}</td>
                      <td className="obi-wrap-sm">{o.titulo}</td>
                      <td className="obi-wrap">{a.descripcion}</td>
                      <td className="obi-nowrap">{fmtFecha(a.fecha)}</td>
                      <td className="obi-nowrap">{a.responsable || "—"}</td>
                      <td><span className={clsx("pill", statusPill(a.status))}>{a.status || "Sin status"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
