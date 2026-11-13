import React from 'react';
import { Icon, clsx } from '../components.jsx';
import {
  guardarObira, deleteObira,
  getArchivosObira, uploadArchivoObira, deleteArchivoObira, getArchivoObiraUrl,
} from '../supabase.js';
import {
  SECTORES, UNIDADES, ESTADOS, STATUS_ANORMALIDAD, STATUS_DEFINITIVA,
  fmtFecha, fmtTamano, hoyISO, porOrden, porFecha,
} from '../obiras.js';

const CAMPOS = [
  "sector", "ubicacion", "fecha_ocurrencia", "responsable", "titulo", "detalle",
  "etapa_constructiva", "cantidad", "unidad", "estado", "accion_inmediata", "causa_raiz",
];

const REQUERIDOS = {
  sector: "Elegí el sector",
  ubicacion: "Indicá la ubicación",
  fecha_ocurrencia: "Indicá la fecha de ocurrencia",
  titulo: "Escribí el título del problema",
  etapa_constructiva: "Indicá la etapa constructiva",
  cantidad: "Indicá la cantidad",
  unidad: "Elegí la unidad",
  estado: "Elegí el estado general",
};

const vacia = () => ({
  sector: "", ubicacion: "", fecha_ocurrencia: hoyISO(), responsable: "", titulo: "", detalle: "",
  etapa_constructiva: "", cantidad: "", unidad: "", estado: "Sin iniciar", accion_inmediata: "", causa_raiz: "",
});

const desdeObira = (o) => Object.fromEntries(CAMPOS.map((k) => [k, o[k] ?? ""]));

let seq = 0;
const nuevaKey = () => `nueva-${++seq}`;

// Filas de las listas: se les agrega _key para React; las que vienen de la base usan su id.
const conKey = (filas) => filas.map((f) => ({ ...f, _key: f.id || nuevaKey() }));

const DL_UBICACIONES = "obi-dl-ubicaciones";
const DL_RESPONSABLES = "obi-dl-responsables";

/* ── Campo con label / error ───────────────────────────────────────────── */
function Campo({ label, req, error, hint, span, children }) {
  return (
    <div className={clsx("field", span && `obi-span-${span}`)} style={{ marginBottom: 0 }}>
      <label>{label}{req && <> <span className="req">*</span></>}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
      {error && <div className="err">{error}</div>}
    </div>
  );
}

function Control({ col, value, onChange, bad }) {
  const common = { value: value ?? "", onChange: (e) => onChange(e.target.value) };
  if (col.type === "select") {
    return (
      <select className={clsx("select", bad && "bad")} {...common}>
        <option value="">— Seleccionar —</option>
        {col.options.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  }
  if (col.type === "textarea") {
    return <textarea className={clsx("textarea", bad && "bad")} rows={2} style={{ minHeight: 60 }} placeholder={col.placeholder} {...common} />;
  }
  return (
    <input
      className={clsx("input", bad && "bad")}
      type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
      min={col.type === "number" ? 0 : undefined}
      step={col.type === "number" ? "any" : undefined}
      list={col.list}
      placeholder={col.placeholder}
      {...common}
    />
  );
}

/* ── Lista editable (repeticiones / anormalidades / acciones definitivas) ── */
function ListaEditable({ titulo, descripcion, extraHead, nota, addLabel, columnas, filas, onChange, vacio }) {
  const [edit, setEdit] = React.useState(null); // { key: string|null (null = nueva), draft, errs }

  const abrirNueva = () => setEdit({ key: null, draft: Object.fromEntries(columnas.map((c) => [c.key, ""])), errs: {} });
  const abrirEdicion = (fila) => setEdit({ key: fila._key, draft: { ...fila }, errs: {} });
  const setDraft = (k, v) => setEdit((e) => ({ ...e, draft: { ...e.draft, [k]: v }, errs: { ...e.errs, [k]: false } }));

  const confirmar = () => {
    const errs = {};
    columnas.forEach((c) => {
      const v = String(edit.draft[c.key] ?? "").trim();
      if (c.required && !v) errs[c.key] = true;
      if (c.type === "number" && v && !(Number(v) >= 0)) errs[c.key] = true;
    });
    if (Object.keys(errs).length) { setEdit((e) => ({ ...e, errs })); return; }
    if (edit.key === null) onChange([...filas, { ...edit.draft, _key: nuevaKey() }]);
    else onChange(filas.map((f) => (f._key === edit.key ? { ...f, ...edit.draft } : f)));
    setEdit(null);
  };

  const borrar = (key) => {
    onChange(filas.filter((f) => f._key !== key));
    if (edit?.key === key) setEdit(null);
  };

  return (
    <section className="obi-sec">
      <div className="obi-sec-band">
        <div>
          <h3>{titulo}</h3>
          {descripcion && <p>{descripcion}</p>}
        </div>
        <div className="obi-sec-right">
          {extraHead}
          <button type="button" className="btn btn-cream btn-sm" onClick={abrirNueva} disabled={edit?.key === null}>
            <Icon name="plus" size={14} /> {addLabel}
          </button>
        </div>
      </div>
      {nota && <div className="obi-note"><Icon name="alert" size={13} /> {nota}</div>}

      {edit && (
        <div className="obi-subform">
          <div className="obi-grid">
            {columnas.map((c) => (
              <Campo key={c.key} label={c.label} req={c.required} span={c.span}>
                <Control col={c} value={edit.draft[c.key]} onChange={(v) => setDraft(c.key, v)} bad={edit.errs[c.key]} />
              </Campo>
            ))}
          </div>
          <div className="obi-subform-actions">
            <button type="button" className="btn btn-cream btn-sm" onClick={() => setEdit(null)}>Cancelar</button>
            <button type="button" className="btn btn-gold btn-sm" onClick={confirmar}>
              <Icon name="check" size={14} /> {edit.key === null ? "Agregar" : "Aplicar cambios"}
            </button>
          </div>
        </div>
      )}

      {filas.length === 0 ? (
        !edit && <div className="obi-subempty">{vacio}</div>
      ) : (
        <div className="obi-subtable-wrap">
          <table className="rec-table obi-subtable">
            <thead>
              <tr>
                {columnas.map((c) => <th key={c.key}>{c.label}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f._key} className={clsx(edit?.key === f._key && "obi-editing")}>
                  {columnas.map((c) => (
                    <td key={c.key} className={clsx(c.wrap && "obi-wrap", !c.wrap && "obi-nowrap")}>
                      {c.type === "date" ? fmtFecha(f[c.key]) : (f[c.key] === "" || f[c.key] == null ? "—" : String(f[c.key]))}
                    </td>
                  ))}
                  <td className="rec-actions">
                    <button type="button" className="icon-btn" title="Editar" onClick={() => abrirEdicion(f)}><Icon name="edit" size={15} /></button>
                    <button type="button" className="icon-btn icon-btn-red" title="Quitar" onClick={() => borrar(f._key)}><Icon name="trash" size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const COLS_REPETICION = [
  { key: "fecha", label: "Fecha de repetición", type: "date", required: true },
  { key: "cantidad", label: "Cantidad de la repetición", type: "number" },
  { key: "ubicacion", label: "Ubicación", list: DL_UBICACIONES },
  { key: "comentarios", label: "Comentarios", type: "textarea", span: 4, wrap: true },
];

const COLS_ANORMALIDAD = [
  { key: "descripcion", label: "Acciones a tomar para minimizar el impacto", type: "textarea", required: true, span: 4, wrap: true },
  { key: "fecha", label: "Fecha de finalización", type: "date" },
  { key: "responsable", label: "Responsable", list: DL_RESPONSABLES },
  { key: "status", label: "Status", type: "select", options: STATUS_ANORMALIDAD },
];

const COLS_DEFINITIVA = [
  { key: "descripcion", label: "Contramedida", type: "textarea", required: true, span: 4, wrap: true },
  { key: "fecha", label: "Fecha de implementación de contramedida", type: "date" },
  { key: "responsable", label: "Responsable", list: DL_RESPONSABLES },
  { key: "status", label: "Status acción definitiva", type: "select", options: STATUS_DEFINITIVA },
];

/* ── Drawer ─────────────────────────────────────────────────────────────── */
export function ObiraDrawer({ obira, ubicaciones = [], responsables = [], isAdmin, onClose, onSaved, onDeleted }) {
  const esNueva = !obira?.id;

  const [form, setForm] = React.useState(() => (obira ? desdeObira(obira) : vacia()));
  const [reps, setReps] = React.useState(() => conKey([...(obira?.repeticiones || [])].sort(porFecha)));
  const [anorm, setAnorm] = React.useState(() => conKey((obira?.acciones || []).filter((a) => a.tipo === "anormalidad").sort(porOrden)));
  const [defin, setDefin] = React.useState(() => conKey((obira?.acciones || []).filter((a) => a.tipo === "definitiva").sort(porOrden)));

  const [archivos, setArchivos] = React.useState([]);         // ya guardados
  const [archivosCargando, setArchivosCargando] = React.useState(!esNueva);
  const [nuevos, setNuevos] = React.useState([]);             // File[] que se suben al guardar
  const [aBorrar, setABorrar] = React.useState(() => new Set()); // ids de guardados a borrar al guardar
  const [descargando, setDescargando] = React.useState(null);

  const [errores, setErrores] = React.useState({});
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errorGuardar, setErrorGuardar] = React.useState(null);
  const [confirm, setConfirm] = React.useState(null); // "cerrar" | "eliminar"
  const [eliminando, setEliminando] = React.useState(false);

  const fileRef = React.useRef(null);
  const bodyRef = React.useRef(null);

  React.useEffect(() => {
    if (esNueva) return;
    let vivo = true;
    getArchivosObira(obira.id)
      .then((d) => { if (vivo) setArchivos(d || []); })
      .catch(() => { if (vivo) setErrorGuardar("No se pudieron cargar los archivos adjuntos"); })
      .finally(() => { if (vivo) setArchivosCargando(false); });
    return () => { vivo = false; };
  }, [esNueva, obira?.id]);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
    if (errores[k]) setErrores((e) => ({ ...e, [k]: undefined }));
  };
  const cambiarLista = (setter) => (filas) => { setter(filas); setDirty(true); };

  const validar = () => {
    const e = {};
    Object.entries(REQUERIDOS).forEach(([k, msg]) => { if (!String(form[k] ?? "").trim()) e[k] = msg; });
    if (!e.cantidad && !(Number(form.cantidad) >= 0)) e.cantidad = "Tiene que ser un número mayor o igual a 0";
    return e;
  };

  const accionPayload = (tipo) => (a) => ({
    id: a.id || null, tipo, descripcion: a.descripcion, fecha: a.fecha || null,
    responsable: a.responsable, status: a.status,
  });

  const handleGuardar = async () => {
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length) {
      bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving(true);
    setErrorGuardar(null);
    try {
      const id = await guardarObira(
        { ...form, id: obira?.id ?? null, cantidad: Number(form.cantidad) },
        reps.map((r) => ({
          id: r.id || null, fecha: r.fecha,
          cantidad: r.cantidad === "" || r.cantidad == null ? null : Number(r.cantidad),
          ubicacion: r.ubicacion, comentarios: r.comentarios,
        })),
        [...anorm.map(accionPayload("anormalidad")), ...defin.map(accionPayload("definitiva"))],
      );
      // La obira ya quedó guardada: si falla algún archivo se avisa, pero no se pierde la carga.
      const fallos = [];
      for (const a of archivos.filter((x) => aBorrar.has(x.id))) {
        try { await deleteArchivoObira(a); } catch { fallos.push(`no se pudo borrar ${a.nombre}`); }
      }
      for (const f of nuevos) {
        try { await uploadArchivoObira(id, f); } catch { fallos.push(`no se pudo subir ${f.name}`); }
      }
      onSaved(id, { nueva: esNueva, fallos });
    } catch (err) {
      setErrorGuardar(err.message || "No se pudo guardar la obira");
      setSaving(false);
    }
  };

  const handleEliminar = async () => {
    setEliminando(true);
    try {
      await deleteObira(obira.id);
      onDeleted(obira.id);
    } catch (err) {
      setErrorGuardar(err.message || "No se pudo eliminar la obira");
      setConfirm(null);
      setEliminando(false);
    }
  };

  const pedirCerrar = () => (dirty ? setConfirm("cerrar") : onClose());

  const descargar = async (a) => {
    setDescargando(a.id);
    try {
      const url = await getArchivoObiraUrl(a);
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setErrorGuardar(err.message || "No se pudo descargar el archivo");
    } finally {
      setDescargando(null);
    }
  };

  const archivosVisibles = archivos.filter((a) => !aBorrar.has(a.id));
  const hayArchivos = archivosVisibles.length > 0 || nuevos.length > 0;
  const nErrores = Object.values(errores).filter(Boolean).length;

  return (
    <div className="scrim">
      <div className="drawer obi-drawer" role="dialog" aria-modal="true" aria-label={esNueva ? "Nueva obira" : `Obira ${obira.id}`}>
        <div className="drawer-head">
          <div className="ch-icon"><Icon name={esNueva ? "plus" : "layers"} size={20} /></div>
          <div style={{ minWidth: 0 }}>
            <h2>{esNueva ? "Nueva obira" : `Obira #${obira.id}`}</h2>
            <p className="obi-head-sub">{esNueva ? "Completá la información del problema" : obira.titulo}</p>
          </div>
          <button className="btn btn-cream btn-sm" style={{ marginLeft: "auto" }} onClick={pedirCerrar} title="Cerrar">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="drawer-body" ref={bodyRef}>
          <datalist id={DL_UBICACIONES}>{ubicaciones.map((u) => <option key={u} value={u} />)}</datalist>
          <datalist id={DL_RESPONSABLES}>{responsables.map((r) => <option key={r} value={r} />)}</datalist>

          {nErrores > 0 && (
            <div className="obi-alert">
              <Icon name="alert" size={15} /> Faltan completar {nErrores} campo{nErrores !== 1 ? "s" : ""} obligatorio{nErrores !== 1 ? "s" : ""}.
            </div>
          )}

          {/* ── Datos del problema ── */}
          <div className="obi-grid">
            <Campo label="Sector" req error={errores.sector}>
              <select className={clsx("select", errores.sector && "bad")} value={form.sector} onChange={(e) => set("sector", e.target.value)}>
                <option value="">— Seleccionar —</option>
                {SECTORES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Campo>
            <Campo label="Ubicación" req error={errores.ubicacion}>
              <input className={clsx("input", errores.ubicacion && "bad")} list={DL_UBICACIONES} placeholder="Ej: LAJE48"
                value={form.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} />
            </Campo>
            <Campo label="Fecha de ocurrencia del problema" req error={errores.fecha_ocurrencia}>
              <input type="date" className={clsx("input", errores.fecha_ocurrencia && "bad")}
                value={form.fecha_ocurrencia} onChange={(e) => set("fecha_ocurrencia", e.target.value)} />
            </Campo>
            <Campo label="Responsable ítem">
              <input className="input" list={DL_RESPONSABLES} placeholder="Seleccionar un responsable"
                value={form.responsable} onChange={(e) => set("responsable", e.target.value)} />
            </Campo>

            <Campo label="Título del problema" req error={errores.titulo}>
              <textarea className={clsx("textarea", errores.titulo && "bad")} rows={3}
                value={form.titulo} onChange={(e) => set("titulo", e.target.value)} />
            </Campo>
            <Campo label="Detalle" span={3}>
              <textarea className="textarea" rows={3}
                value={form.detalle} onChange={(e) => set("detalle", e.target.value)} />
            </Campo>

            <Campo label="Etapa constructiva" req error={errores.etapa_constructiva}>
              <input className={clsx("input", errores.etapa_constructiva && "bad")} placeholder="Ej: E10_TERRAP_A"
                value={form.etapa_constructiva} onChange={(e) => set("etapa_constructiva", e.target.value)} />
            </Campo>
            <Campo label="Cantidad" req error={errores.cantidad}>
              <input type="number" min={0} step="any" className={clsx("input", errores.cantidad && "bad")}
                value={form.cantidad} onChange={(e) => set("cantidad", e.target.value)} />
            </Campo>
            <Campo label="Unidad" req error={errores.unidad}>
              <select className={clsx("select", errores.unidad && "bad")} value={form.unidad} onChange={(e) => set("unidad", e.target.value)}>
                <option value="">— Seleccionar —</option>
                {UNIDADES.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Campo>
            <Campo label="Estado general" req error={errores.estado}>
              <select className={clsx("select", errores.estado && "bad")} value={form.estado} onChange={(e) => set("estado", e.target.value)}>
                {ESTADOS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Campo>
          </div>

          {/* ── Fechas de repetición ── */}
          <ListaEditable
            titulo="Fechas de repetición del problema"
            extraHead={<span>Cantidad total: <b>{reps.length}</b></span>}
            nota="Al ingresar una fecha, considerá su correspondencia con la fecha de ocurrencia."
            addLabel="Agregar repetición"
            columnas={COLS_REPETICION}
            filas={reps}
            onChange={cambiarLista(setReps)}
            vacio="Sin repeticiones registradas."
          />

          {/* ── Acción inmediata + archivos ── */}
          <div className="obi-grid" style={{ marginTop: 28 }}>
            <Campo label="Acción inmediata" span={4}>
              <textarea className="textarea" rows={2} placeholder="Describir la acción inmediata tomada"
                value={form.accion_inmediata} onChange={(e) => set("accion_inmediata", e.target.value)} />
            </Campo>
          </div>

          <div className="obi-files">
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => {
              const fs = [...(e.target.files || [])];
              if (fs.length) { setNuevos((n) => [...n, ...fs]); setDirty(true); }
              e.target.value = "";
            }} />
            <button type="button" className="btn btn-cream btn-sm" onClick={() => fileRef.current?.click()}>
              <Icon name="paperclip" size={14} /> Adjuntar archivos
            </button>
            {archivosCargando && <span className="obi-muted">Cargando archivos…</span>}
            {hayArchivos && (
              <div className="obi-subtable-wrap">
                <table className="rec-table obi-subtable">
                  <thead>
                    <tr><th>Nombre del archivo</th><th>Tamaño</th><th style={{ textAlign: "center" }}>Descargar</th><th style={{ textAlign: "center" }}>Eliminar</th></tr>
                  </thead>
                  <tbody>
                    {archivosVisibles.map((a) => (
                      <tr key={a.id}>
                        <td className="obi-wrap">{a.nombre}</td>
                        <td className="obi-nowrap">{fmtTamano(a.tamano)}</td>
                        <td style={{ textAlign: "center" }}>
                          <button type="button" className="obi-iconlink" title="Descargar" disabled={descargando === a.id} onClick={() => descargar(a)}>
                            <Icon name={descargando === a.id ? "refresh" : "download"} size={16} />
                          </button>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button type="button" className="obi-iconlink danger" title="Eliminar" onClick={() => { setABorrar((s) => new Set(s).add(a.id)); setDirty(true); }}>
                            <Icon name="trash" size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {nuevos.map((f, i) => (
                      <tr key={`nuevo-${i}-${f.name}`}>
                        <td className="obi-wrap">{f.name} <span className="pill pill-cream-gold" style={{ marginLeft: 6 }}>Se sube al guardar</span></td>
                        <td className="obi-nowrap">{fmtTamano(f.size)}</td>
                        <td style={{ textAlign: "center" }} className="obi-muted">—</td>
                        <td style={{ textAlign: "center" }}>
                          <button type="button" className="obi-iconlink danger" title="Quitar" onClick={() => setNuevos((n) => n.filter((_, j) => j !== i))}>
                            <Icon name="trash" size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Causa raíz ── */}
          <div className="obi-grid" style={{ marginTop: 28 }}>
            <Campo label="Causa raíz preliminar" span={4}
              hint="Utilice este campo para volcar la causa raíz o el resumen de avance en su investigación.">
              <textarea className="textarea" rows={2} placeholder="Describir la causa raíz preliminar"
                value={form.causa_raiz} onChange={(e) => set("causa_raiz", e.target.value)} />
            </Campo>
          </div>

          {/* ── Acciones ── */}
          <ListaEditable
            titulo="Gestión de anormalidades"
            descripcion="Acciones tendientes a mejorar el tiempo de resolución la próxima vez que se presente el mismo modo de falla"
            addLabel="Agregar"
            columnas={COLS_ANORMALIDAD}
            filas={anorm}
            onChange={cambiarLista(setAnorm)}
            vacio="Sin acciones de gestión de anormalidades."
          />
          <ListaEditable
            titulo="Acciones definitivas"
            descripcion="Acciones tendientes a eliminar definitivamente las causas raíz del modo de falla"
            addLabel="Agregar"
            columnas={COLS_DEFINITIVA}
            filas={defin}
            onChange={cambiarLista(setDefin)}
            vacio="Sin acciones definitivas."
          />
        </div>

        <div className="drawer-foot obi-foot">
          {isAdmin && !esNueva && (
            <button className="btn btn-sm obi-btn-danger" onClick={() => setConfirm("eliminar")} disabled={saving}>
              <Icon name="trash" size={14} /> Eliminar
            </button>
          )}
          {errorGuardar && <span className="obi-foot-err"><Icon name="alert" size={14} /> {errorGuardar}</span>}
          <div className="obi-foot-right">
            <button className="btn btn-cream" onClick={pedirCerrar} disabled={saving}>Cancelar</button>
            <button className="btn btn-gold" onClick={handleGuardar} disabled={saving}>
              {saving
                ? <><Icon name="refresh" size={15} style={{ animation: "spin 0.7s linear infinite" }} /> Guardando…</>
                : <><Icon name="check" size={15} /> Guardar</>}
            </button>
          </div>
        </div>
      </div>

      {confirm && (
        <div className="scrim" style={{ justifyContent: "center", alignItems: "center", zIndex: 50 }}
          onMouseDown={(e) => e.target === e.currentTarget && !eliminando && setConfirm(null)}>
          <div className="rec-confirm">
            {confirm === "cerrar" ? (
              <p>Hay cambios sin guardar. ¿Querés descartarlos?</p>
            ) : (
              <p>¿Eliminar la obira <b>#{obira.id}</b>? Se van a borrar también sus repeticiones, acciones y archivos. Esta acción no se puede deshacer.</p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-cream btn-sm" onClick={() => setConfirm(null)} disabled={eliminando}>
                {confirm === "cerrar" ? "Seguir editando" : "Cancelar"}
              </button>
              {confirm === "cerrar" ? (
                <button className="btn btn-sm" style={{ background: "var(--red)", color: "#fff" }} onClick={onClose}>Descartar cambios</button>
              ) : (
                <button className="btn btn-sm" style={{ background: "var(--red)", color: "#fff" }} onClick={handleEliminar} disabled={eliminando}>
                  {eliminando ? "Eliminando…" : "Eliminar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
