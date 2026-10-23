import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon, fmt } from '../components.jsx';
import { useProjects } from '../context/ProjectsContext.jsx';
import { getEtapasByProyecto, upsertEtapas, deleteEtapa, getFases, insertFase, getInsumosByEtapa, upsertInsumo, deleteInsumo } from '../supabase.js';
import { cacheGet, cacheSet } from '../db.js';
import { UMS, descargarPlantillaEtapas, parseEtapasXlsx } from '../etapasXlsx.js';

const emptyForm = () => ({ nombre_etapa: "", fase: "", UM: "", total: "", incidencia: "" });

// ── Selector de fase con creación inline ─────────────────────────────────────
function FaseSelector({ value, onChange, fases, onFaseCreated }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = fases.filter((f) => f.nombre.toLowerCase().includes(search.toLowerCase()));
  const exactMatch = fases.some((f) => f.nombre.toLowerCase() === search.trim().toLowerCase());

  const select = (nombre) => { onChange(nombre); setOpen(false); setSearch(""); };

  const createNew = async () => {
    const nombre = search.trim().toUpperCase();
    if (!nombre) return;
    setCreating(true);
    try {
      const nueva = await insertFase(nombre);
      onFaseCreated(nueva);
      select(nueva.nombre);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        className="input"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
      >
        <span style={{ color: value ? "var(--on-cream)" : "var(--on-cream-2)" }}>
          {value || "— Seleccionar —"}
        </span>
        <Icon name="chevR" size={14} style={{ transform: open ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform 0.15s" }} />
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 70,
          background: "var(--bg-2)", border: "1.5px solid var(--line-cream)",
          borderRadius: "var(--r-sm)", boxShadow: "0 8px 24px rgba(0,0,0,0.14)", overflow: "hidden",
        }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--line-cream)" }}>
            <input
              className="input"
              style={{ padding: "7px 10px", fontSize: 13 }}
              placeholder="Buscar o escribir nueva fase…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {value && (
              <div
                style={{ padding: "9px 14px", fontSize: 13, cursor: "pointer", color: "var(--on-cream-2)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
                onMouseLeave={(e) => e.currentTarget.style.background = ""}
                onClick={() => select("")}
              >— Sin fase —</div>
            )}
            {filtered.map((f) => (
              <div
                key={f.id}
                style={{ padding: "9px 14px", fontSize: 13, cursor: "pointer", fontWeight: f.nombre === value ? 600 : 400, background: f.nombre === value ? "rgba(231,177,58,0.1)" : "" }}
                onMouseEnter={(e) => { if (f.nombre !== value) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                onMouseLeave={(e) => { if (f.nombre !== value) e.currentTarget.style.background = ""; }}
                onClick={() => select(f.nombre)}
              >
                {f.nombre}
              </div>
            ))}
            {search.trim() && !exactMatch && (
              <div
                style={{ padding: "9px 14px", fontSize: 13, cursor: creating ? "default" : "pointer", color: "var(--gold-deep)", borderTop: "1px solid var(--line-cream)", display: "flex", alignItems: "center", gap: 7 }}
                onMouseEnter={(e) => { if (!creating) e.currentTarget.style.background = "rgba(231,177,58,0.08)"; }}
                onMouseLeave={(e) => e.currentTarget.style.background = ""}
                onClick={creating ? undefined : createNew}
              >
                {creating
                  ? <><Icon name="refresh" size={13} style={{ animation: "spin 0.7s linear infinite" }} /> Creando…</>
                  : <><Icon name="plus" size={13} /> Crear "{search.trim().toUpperCase()}"</>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Confirmación genérica ─────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel = "Confirmar", danger, busy, onConfirm, onCancel }) {
  return (
    <div className="pb-scrim" style={{ zIndex: 95 }} onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="pb-modal" style={{ width: "min(380px, 92vw)" }}>
        <div className="pb-body" style={{ padding: "24px 24px 0" }}>
          {title && <h3 style={{ margin: "0 0 8px", fontSize: 15, color: "var(--on-cream)" }}>{title}</h3>}
          <p style={{ margin: 0, fontSize: 14, color: "var(--on-cream-2)" }}>{message}</p>
        </div>
        <div className="pb-foot" style={{ justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-cream btn-sm" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button
            className={`btn btn-sm${danger ? "" : " btn-gold"}`}
            style={danger ? { background: "var(--red)", color: "#fff" } : undefined}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal para agregar / editar una etapa ────────────────────────────────────
function EtapaModal({ initial, disponible, fases, onFaseCreated, onConfirm, onClose }) {
  const [form, setForm] = useState(initial || emptyForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const incidenciaNum = parseFloat(form.incidencia) || 0;
  // disponible ya descuenta el valor original si es edición
  const restante = disponible + (parseFloat(initial?.incidencia) || 0);
  const excede = incidenciaNum > restante + 0.001;
  const incidColor = excede ? "var(--red)" : incidenciaNum > 0 ? "var(--green)" : "var(--on-cream-2)";

  const askConfirm = () => {
    const e = {};
    if (!form.nombre_etapa.trim()) e.nombre_etapa = "El nombre es requerido";
    if (excede) e.incidencia = `Máximo disponible: ${restante.toFixed(1)}%`;
    if (Object.keys(e).length) { setErrors(e); return; }
    setConfirming(true);
  };

  const doSave = async () => {
    setSaving(true);
    try {
      await onConfirm(form);
    } catch (err) {
      setErrors({ general: "Error al guardar: " + err.message });
      setSaving(false);
      setConfirming(false);
    }
  };

  return (
    <div className="pb-scrim" style={{ zIndex: 60 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb-modal" style={{ width: "min(480px, 95vw)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="pb-head">
          <div className="pb-title">
            <div className="ch-icon"><Icon name="layers" size={20} /></div>
            <div>
              <h2>{initial ? "Editar etapa" : "Nueva etapa"}</h2>
              <p>Completá los datos de la etapa</p>
            </div>
          </div>
          <button className="btn btn-cream btn-sm" style={{ marginLeft: "auto" }} onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="pb-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label>Nombre de la etapa <span className="req">*</span></label>
            <input
              className={`input${errors.nombre_etapa ? " bad" : ""}`}
              placeholder="Ej: Excavación para cajeo"
              value={form.nombre_etapa}
              onChange={(e) => { set("nombre_etapa", e.target.value); setErrors((er) => ({ ...er, nombre_etapa: undefined })); }}
              autoFocus
            />
            {errors.nombre_etapa && <div className="err">{errors.nombre_etapa}</div>}
          </div>

          <div className="field">
            <label>Fase</label>
            <FaseSelector
              value={form.fase}
              onChange={(v) => set("fase", v)}
              fases={fases}
              onFaseCreated={onFaseCreated}
            />
            <div className="hint">Agrupa las etapas por categoría · podés crear una nueva escribiendo</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Unidad de medida</label>
              <select className="select" value={form.UM} onChange={(e) => set("UM", e.target.value)}>
                <option value="">— Seleccionar —</option>
                {UMS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Cantidad total</label>
              <input
                className="input"
                type="number"
                min="0"
                placeholder="0"
                value={form.total}
                onChange={(e) => set("total", e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Incidencia %</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                className={`input${errors.incidencia ? " bad" : ""}`}
                type="number"
                min="0"
                max={restante}
                step="0.1"
                placeholder="0"
                value={form.incidencia}
                onChange={(e) => { set("incidencia", e.target.value); setErrors((er) => ({ ...er, incidencia: undefined })); }}
              />
              <span style={{ fontSize: 15, color: "var(--on-cream-2)" }}>%</span>
            </div>
            {errors.incidencia
              ? <div className="err">{errors.incidencia}</div>
              : (
                <div className="hint" style={{ color: incidColor }}>
                  {restante <= 0
                    ? "No queda incidencia disponible (ya se asignó el 100%)"
                    : incidenciaNum > 0
                      ? `Disponible tras esta etapa: ${(restante - incidenciaNum).toFixed(1)}%`
                      : `Disponible: ${restante.toFixed(1)}%`}
                </div>
              )}
          </div>
          {errors.general && <div className="err">{errors.general}</div>}
        </div>

        <div className="pb-foot" style={{ justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-cream" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-gold" onClick={askConfirm} disabled={saving}>
            <Icon name="check" size={15} /> {initial ? "Guardar cambios" : "Agregar etapa"}
          </button>
        </div>
      </div>

      {confirming && (
        <ConfirmModal
          title={initial ? "Guardar cambios" : "Agregar etapa"}
          message={initial
            ? `¿Confirmás guardar los cambios en "${form.nombre_etapa.trim()}"?`
            : `¿Confirmás agregar la etapa "${form.nombre_etapa.trim()}"?`}
          confirmLabel={saving ? "Guardando…" : "Confirmar"}
          busy={saving}
          onConfirm={doSave}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

// ── Panel de insumos por etapa ───────────────────────────────────────────────
const INSUMO_EMPTY_CFG = { nombre: "", unidad: "", cantidad: "", costo_unitario: "", observaciones: "" };
const UMS_INSUMO_CFG = ["m³", "m²", "ml", "tn", "kg", "lt", "u", "gl", "m", "bolsa", "rollo", "juego"];

function InsumoFormModal({ insumo, onClose, onSave, saving }) {
  const [form, setForm] = useState(insumo || INSUMO_EMPTY_CFG);
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const total = form.cantidad && form.costo_unitario
    ? (Number(form.cantidad) * Number(form.costo_unitario)).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
    : null;

  return (
    <div className="pb-scrim" style={{ zIndex: 80 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb-modal" style={{ width: "min(480px, 95vw)" }}>
        <div className="pb-head">
          <div className="pb-title">
            <div className="ch-icon"><Icon name="box" size={18} /></div>
            <div>
              <h2>{insumo?.id ? "Editar insumo" : "Agregar insumo"}</h2>
              <p>Material o recurso necesario para esta etapa</p>
            </div>
          </div>
          <button className="btn btn-cream btn-sm" style={{ marginLeft: "auto" }} onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="pb-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <label>Material / Insumo <span className="req">*</span></label>
            <input className="input" placeholder="ej: Hormigón H30, Asfalto, Caños Ø300…" value={form.nombre} onChange={f("nombre")} autoFocus />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Unidad</label>
              <select className="select" value={form.unidad} onChange={f("unidad")}>
                <option value="">Seleccionar…</option>
                {UMS_INSUMO_CFG.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Cantidad planificada</label>
              <input className="input" type="number" min="0" placeholder="0" value={form.cantidad} onChange={f("cantidad")} />
            </div>
          </div>
          <div className="field">
            <label>Costo unitario <span style={{ fontSize: 11, color: "var(--on-cream-2)", fontWeight: 400 }}>(opcional)</span></label>
            <input className="input" type="number" min="0" placeholder="$ por unidad" value={form.costo_unitario} onChange={f("costo_unitario")} />
          </div>
          {total && (
            <div style={{ background: "rgba(231,177,58,0.1)", border: "1px solid rgba(231,177,58,0.3)", borderRadius: 8, padding: "9px 14px", fontSize: 13 }}>
              Total estimado: <strong>{total}</strong>
            </div>
          )}
          <div className="field">
            <label>Observaciones</label>
            <textarea className="input" rows={2} style={{ resize: "vertical" }} placeholder="Especificaciones, proveedor sugerido…" value={form.observaciones} onChange={f("observaciones")} />
          </div>
        </div>

        <div className="pb-foot" style={{ justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-cream" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={() => onSave(form)} disabled={saving || !form.nombre.trim()}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InsumosPanel({ row, onClose }) {
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formModal, setFormModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const noId = !row.ID;

  useEffect(() => {
    if (noId) { setLoading(false); return; }
    getInsumosByEtapa(row.ID)
      .then(setInsumos)
      .catch(() => setInsumos([]))
      .finally(() => setLoading(false));
  }, [row.ID]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        ID_Etapa: row.ID,
        nombre: form.nombre.trim(),
        unidad: form.unidad || null,
        cantidad: form.cantidad ? Number(form.cantidad) : null,
        costo_unitario: form.costo_unitario ? Number(form.costo_unitario) : null,
        observaciones: form.observaciones?.trim() || null,
      };
      const saved = await upsertInsumo(payload);
      setInsumos((prev) => form.id ? prev.map((i) => i.id === form.id ? saved : i) : [...prev, saved]);
      setFormModal(null);
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

  const totalCosto = insumos.reduce((sum, i) =>
    i.cantidad && i.costo_unitario ? sum + i.cantidad * i.costo_unitario : sum, 0);

  return (
    <>
      <div className="pb-scrim" style={{ zIndex: 70 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="ins-panel">
          {/* Header */}
          <div className="ins-panel-head">
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--on-cream-2)" }}>
                Insumos planificados
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--on-cream)" }}>{row.nombre_etapa}</div>
              {row.fase && <span className="pill pill-gold" style={{ fontSize: 11, alignSelf: "flex-start", marginTop: 2 }}>{row.fase}</span>}
            </div>
            <button className="icon-btn" style={{ color: "var(--on-cream-2)" }} onClick={onClose}><Icon name="x" size={18} /></button>
          </div>

          {/* Body */}
          <div className="ins-panel-body">
            {noId ? (
              <div style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💾</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--on-cream)", marginBottom: 6 }}>Guardá las etapas primero</div>
                <div style={{ fontSize: 13, color: "var(--on-cream-2)" }}>Los insumos se asocian al ID de la etapa. Guardá los cambios y volvé a entrar.</div>
              </div>
            ) : loading ? (
              <div style={{ padding: "40px 24px", textAlign: "center", opacity: 0.4 }}>
                <Icon name="refresh" size={22} style={{ animation: "spin 0.7s linear infinite" }} />
              </div>
            ) : insumos.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Icon name="box" size={28} style={{ opacity: 0.2 }} />
                <div style={{ fontSize: 13, color: "var(--on-cream-2)" }}>No hay insumos cargados para esta etapa.</div>
                <button className="btn btn-gold btn-sm" style={{ marginTop: 8 }} onClick={() => setFormModal(INSUMO_EMPTY_CFG)}>
                  <Icon name="plus" size={14} /> Agregar insumo
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {insumos.map((ins) => {
                  const subtotal = ins.cantidad && ins.costo_unitario ? ins.cantidad * ins.costo_unitario : null;
                  return (
                    <div key={ins.id} className="ins-panel-row"
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(42,38,32,0.04)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--on-cream)" }}>{ins.nombre}</div>
                        <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                          {ins.cantidad != null && (
                            <span style={{ fontSize: 12, color: "var(--on-cream-2)" }}>
                              <b style={{ color: "var(--on-cream)" }}>{fmt(ins.cantidad)}</b> {ins.unidad || ""}
                            </span>
                          )}
                          {ins.costo_unitario != null && (
                            <span style={{ fontSize: 12, color: "var(--on-cream-2)" }}>
                              ${Number(ins.costo_unitario).toLocaleString("es-AR")} / {ins.unidad || "u"}
                            </span>
                          )}
                          {subtotal && (
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold-deep)" }}>
                              = ${subtotal.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                            </span>
                          )}
                        </div>
                        {ins.observaciones && (
                          <div style={{ fontSize: 12, color: "var(--on-cream-2)", marginTop: 3, fontStyle: "italic" }}>{ins.observaciones}</div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button className="icon-btn" style={{ color: "var(--on-cream-2)" }} onClick={() => setFormModal(ins)} title="Editar">
                          <Icon name="edit" size={14} />
                        </button>
                        <button className="icon-btn icon-btn-red" onClick={() => setConfirmDel(ins)} title="Eliminar">
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {totalCosto > 0 && (
                  <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line-cream)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--on-cream-2)", fontWeight: 600 }}>Total estimado</span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "var(--gold-deep)" }}>
                      ${totalCosto.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {!noId && (
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-cream)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--on-cream-2)" }}>
                {insumos.length} insumo{insumos.length !== 1 ? "s" : ""}
              </span>
              <button className="btn btn-gold btn-sm" onClick={() => setFormModal(INSUMO_EMPTY_CFG)}>
                <Icon name="plus" size={14} /> Agregar
              </button>
            </div>
          )}
        </div>
      </div>

      {formModal && (
        <InsumoFormModal
          insumo={formModal}
          onClose={() => setFormModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {confirmDel && (
        <div className="pb-scrim" style={{ zIndex: 90 }} onClick={(e) => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="pb-modal" style={{ width: "min(360px, 92vw)" }}>
            <div className="pb-body" style={{ padding: "24px 24px 0" }}>
              <p style={{ margin: 0, fontSize: 14 }}>¿Eliminar el insumo <b>{confirmDel.nombre}</b>?</p>
            </div>
            <div className="pb-foot" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-cream btn-sm" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn btn-sm" style={{ background: "var(--red)", color: "#fff" }} onClick={() => handleDelete(confirmDel.id)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Importación masiva de etapas desde .xlsx ────────────────────────────────
function ImportEtapasModal({ existentes, fases, onImport, onClose }) {
  const [archivo, setArchivo] = useState(null);
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setArchivo(file.name);
    setFilas(null);
    setError(null);
    setParsing(true);
    try {
      const res = await parseEtapasXlsx(file, { existentes, fases });
      if (res.error) setError(res.error);
      else setFilas(res.filas);
    } catch (err) {
      setError("Error al leer el archivo: " + err.message);
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const descargar = async () => {
    setDescargando(true);
    try { await descargarPlantillaEtapas(fases); } finally { setDescargando(false); }
  };

  const conErrores = (filas || []).filter((f) => f.errores.length).length;
  const nuevas = (filas || []).filter((f) => !f.ID).length;
  const actualiza = (filas || []).length - nuevas;

  // Incidencia resultante: las etapas actualizadas toman el valor del archivo
  // (si viene vacío conservan el actual) y las nuevas se suman.
  const incidFinal = filas ? (() => {
    const porId = new Map(filas.filter((f) => f.ID).map((f) => [f.ID, f]));
    const base = existentes.reduce((s, e) => {
      const f = porId.get(e.ID);
      const v = f && f.incidencia !== null ? f.incidencia : parseFloat(e.incidencia) || 0;
      return s + v;
    }, 0);
    return base + filas.filter((f) => !f.ID).reduce((s, f) => s + (f.incidencia || 0), 0);
  })() : 0;
  const incidExcede = incidFinal > 100.01;
  const incidOk = Math.abs(incidFinal - 100) < 0.01;
  const puedeImportar = filas && !conErrores && !incidExcede && !importing;

  const doImport = async () => {
    setImporting(true);
    setError(null);
    try {
      await onImport(filas);
    } catch (err) {
      setError("Error al importar: " + err.message);
      setImporting(false);
    }
  };

  const th = { padding: "8px 10px", textAlign: "left", fontSize: 11.5, fontWeight: 600, color: "var(--on-cream-2)", whiteSpace: "nowrap", position: "sticky", top: 0, background: "var(--bg-2)" };
  const td = { padding: "8px 10px", fontSize: 13, borderTop: "1px solid var(--line-cream)", verticalAlign: "top" };

  return (
    <div className="pb-scrim" style={{ zIndex: 60 }} onClick={(e) => e.target === e.currentTarget && !importing && onClose()}>
      <div className="pb-modal" style={{ width: "min(860px, 95vw)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="pb-head">
          <div className="pb-title">
            <div className="ch-icon"><Icon name="upload" size={20} /></div>
            <div>
              <h2>Importar etapas</h2>
              <p>Cargá un archivo .xlsx con las etapas del contrato</p>
            </div>
          </div>
          <button className="btn btn-cream btn-sm" style={{ marginLeft: "auto" }} onClick={onClose} disabled={importing}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="pb-body" style={{ display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn btn-cream btn-sm" onClick={descargar} disabled={descargando}>
              <Icon name="download" size={15} /> {descargando ? "Generando…" : "Descargar plantilla"}
            </button>
            <button className="btn btn-gold btn-sm" onClick={() => inputRef.current?.click()} disabled={parsing || importing}>
              <Icon name="paperclip" size={15} /> {archivo ? "Elegir otro archivo" : "Elegir archivo .xlsx"}
            </button>
            {archivo && <span style={{ fontSize: 13, color: "var(--on-cream-2)" }}>{archivo}</span>}
            <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>

          <div className="hint" style={{ fontSize: 12.5, color: "var(--on-cream-2)" }}>
            Si una etapa del archivo tiene el mismo nombre que una existente, se actualizan sus datos (las celdas vacías conservan el valor actual).
            Las fases que no existan se crean automáticamente.
          </div>

          {parsing && (
            <div style={{ padding: "30px 0", textAlign: "center", opacity: 0.5 }}>
              <Icon name="refresh" size={24} style={{ animation: "spin 0.7s linear infinite" }} />
            </div>
          )}

          {error && <div className="err" style={{ fontSize: 13, color: "var(--red)" }}><Icon name="alert" size={14} /> {error}</div>}

          {filas && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
                <span className="pill pill-green">{nuevas} nueva{nuevas !== 1 ? "s" : ""}</span>
                {actualiza > 0 && <span className="pill pill-gold">{actualiza} a actualizar</span>}
                {conErrores > 0 && <span className="pill pill-red">{conErrores} con errores</span>}
                <span style={{ marginLeft: "auto", fontWeight: 600, color: incidExcede ? "var(--red)" : incidOk ? "var(--green)" : "var(--gold-deep)" }}>
                  Incidencia total resultante: {incidFinal.toFixed(1)}%
                </span>
              </div>
              {incidExcede && <div className="err" style={{ fontSize: 13, color: "var(--red)" }}>La incidencia total supera el 100%. Corregí el archivo antes de importar.</div>}
              {!incidExcede && !incidOk && <div className="hint" style={{ fontSize: 12.5 }}>La incidencia no suma 100%: podés importar igual y ajustarla después.</div>}
              {conErrores > 0 && <div className="err" style={{ fontSize: 13, color: "var(--red)" }}>Corregí las filas con errores en el archivo y volvé a cargarlo.</div>}

              <div style={{ overflow: "auto", border: "1px solid var(--line-cream)", borderRadius: "var(--r-md)", maxHeight: "45vh" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>{["Fila", "Nombre de etapa", "Fase", "UM", "Total", "Incid.", "Estado"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.fila} style={f.errores.length ? { background: "rgba(226,73,59,0.06)" } : undefined}>
                        <td style={{ ...td, color: "var(--on-cream-2)" }}>{f.fila}</td>
                        <td style={{ ...td, fontWeight: 500 }}>{f.nombre_etapa || "—"}</td>
                        <td style={td}>{f.fase || "—"}</td>
                        <td style={td}>{f.UM || "—"}</td>
                        <td style={td}>{f.total !== null ? Number(f.total).toLocaleString("es-AR") : "—"}</td>
                        <td style={td}>{f.incidencia !== null ? `${f.incidencia}%` : "—"}</td>
                        <td style={td}>
                          {f.errores.length
                            ? <span style={{ color: "var(--red)", fontSize: 12 }}>{f.errores.join(" · ")}</span>
                            : <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                <span className={`pill ${f.ID ? "pill-gold" : "pill-green"}`} style={{ fontSize: 11 }}>{f.ID ? "Actualiza" : "Nueva"}</span>
                                {f.avisos.map((a) => <span key={a} className="pill pill-dim2" style={{ fontSize: 11 }}>{a}</span>)}
                              </span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="pb-foot" style={{ justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-cream" onClick={onClose} disabled={importing}>Cancelar</button>
          <button className="btn btn-gold" onClick={doImport} disabled={!puedeImportar}>
            {importing
              ? <><Icon name="refresh" size={15} style={{ animation: "spin 0.7s linear infinite" }} /> Importando…</>
              : <><Icon name="check" size={15} /> Importar {filas ? filas.length : ""} etapa{filas?.length === 1 ? "" : "s"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vista principal ──────────────────────────────────────────────────────────
export function ConfigProyecto() {
  const { pid } = useParams();
  const navigate = useNavigate();
  const { projects, refreshProject } = useProjects();
  const project = projects.find((p) => p.id === pid) || null;
  const onBack = async () => { await refreshProject(pid); navigate(`/proyectos/${pid}`); };
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rowBusy, setRowBusy] = useState(null); // _key de la fila que se está eliminando
  const [confirmDelete, setConfirmDelete] = useState(null); // row pendiente de eliminar
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [fases, setFases] = useState([]);
  const [insumosPanel, setInsumosPanel] = useState(null); // row | null
  const [insumosCounts, setInsumosCounts] = useState({}); // { [rowID]: count }
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (!pid) return;
    async function load() {
      try {
        const [etapas, fasesData] = await Promise.all([getEtapasByProyecto(pid), getFases()]);
        await Promise.all([cacheSet(`etapas_${pid}`, etapas), cacheSet('fases', fasesData)]);
        setRows((etapas || []).map((e) => ({ ...e, _key: e.ID })));
        setFases(fasesData || []);
        // Cargar conteos de insumos por etapa
        const counts = {};
        await Promise.all((etapas || []).map(async (e) => {
          try {
            const ins = await getInsumosByEtapa(e.ID);
            counts[e.ID] = ins.length;
          } catch { counts[e.ID] = 0; }
        }));
        setInsumosCounts(counts);
      } catch {
        const [etapas, fasesData] = await Promise.all([cacheGet(`etapas_${pid}`), cacheGet('fases')]);
        setRows((etapas || []).map((e) => ({ ...e, _key: e.ID })));
        setFases(fasesData || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [pid]);

  const etapaPayload = (form, row) => ({
    ...(row?.ID ? { ID: row.ID } : {}),
    ID_Proyecto: pid,
    nombre_etapa: form.nombre_etapa.trim(),
    fase: (form.fase || "").trim(),
    UM: form.UM || null,
    total: parseFloat(form.total) || null,
    incidencia: parseFloat(form.incidencia) || null,
  });

  const syncAfterChange = async (nextRows) => {
    await cacheSet(`etapas_${pid}`, nextRows);
    await refreshProject(pid);
  };

  const addEtapa = async (form) => {
    const [saved] = await upsertEtapas([etapaPayload(form)]);
    const nextRows = [...rows, { ...saved, _key: saved.ID }];
    setRows(nextRows);
    setInsumosCounts((prev) => ({ ...prev, [saved.ID]: 0 }));
    await syncAfterChange(nextRows);
    setModal(null);
    setToast("Etapa agregada");
  };

  const editEtapa = async (form) => {
    const row = modal.row;
    const [saved] = await upsertEtapas([etapaPayload(form, row)]);
    const nextRows = rows.map((r) => r._key === row._key ? { ...saved, _key: saved.ID } : r);
    setRows(nextRows);
    await syncAfterChange(nextRows);
    setModal(null);
    setToast("Etapa actualizada");
  };

  // Inserta las etapas nuevas y actualiza las existentes (match por nombre).
  // En las actualizaciones se conserva el nombre original —el avance se vincula
  // por nombre_etapa— y las celdas vacías mantienen el valor actual.
  const importEtapas = async (filas) => {
    const conocidas = new Set(fases.map((f) => f.nombre.toUpperCase()));
    const nuevasFases = [...new Set(filas.map((f) => f.fase).filter((f) => f && !conocidas.has(f)))];
    const creadas = [];
    for (const nombre of nuevasFases) {
      try { creadas.push(await insertFase(nombre)); } catch (err) { console.error(err); }
    }
    if (creadas.length) setFases((prev) => [...prev, ...creadas].sort((a, b) => a.nombre.localeCompare(b.nombre)));

    const porId = new Map(rows.map((r) => [r.ID, r]));
    const inserts = filas.filter((f) => !f.ID).map((f) => ({
      ID_Proyecto: pid,
      nombre_etapa: f.nombre_etapa,
      fase: f.fase,
      UM: f.UM,
      total: f.total,
      incidencia: f.incidencia,
    }));
    const updates = filas.filter((f) => f.ID).map((f) => {
      const r = porId.get(f.ID);
      return {
        ID: r.ID,
        ID_Proyecto: pid,
        nombre_etapa: r.nombre_etapa,
        fase: f.fase || r.fase || "",
        UM: f.UM ?? r.UM ?? null,
        total: f.total ?? r.total ?? null,
        incidencia: f.incidencia ?? r.incidencia ?? null,
      };
    });

    const [insertadas, actualizadas] = await Promise.all([
      inserts.length ? upsertEtapas(inserts) : [],
      updates.length ? upsertEtapas(updates) : [],
    ]);
    const actPorId = new Map(actualizadas.map((e) => [e.ID, e]));
    const nextRows = [
      ...rows.map((r) => actPorId.has(r.ID) ? { ...actPorId.get(r.ID), _key: r.ID } : r),
      ...insertadas.map((e) => ({ ...e, _key: e.ID })),
    ];
    setRows(nextRows);
    setInsumosCounts((prev) => ({ ...prev, ...Object.fromEntries(insertadas.map((e) => [e.ID, 0])) }));
    await syncAfterChange(nextRows);
    setImportOpen(false);
    setToast(`${insertadas.length} etapa${insertadas.length !== 1 ? "s" : ""} importada${insertadas.length !== 1 ? "s" : ""}` +
      (actualizadas.length ? ` · ${actualizadas.length} actualizada${actualizadas.length !== 1 ? "s" : ""}` : ""));
  };

  const removeRow = async (row) => {
    setRowBusy(row._key);
    try {
      if (row.ID) await deleteEtapa(row.ID);
      const nextRows = rows.filter((r) => r._key !== row._key);
      setRows(nextRows);
      await syncAfterChange(nextRows);
      setToast("Etapa eliminada");
    } catch (err) {
      setToast("Error al eliminar: " + err.message);
    } finally {
      setRowBusy(null);
    }
  };

  const totalIncid = rows.reduce((s, r) => s + (parseFloat(r.incidencia) || 0), 0);
  const incidOk = Math.abs(totalIncid - 100) < 0.01;
  const disponible = Math.max(0, 100 - totalIncid);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!project) return null;

  return (
    <div className="fade-in">
      <div className="home-head" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="home-h2">Configuración · {project.code}</h2>
          <p className="home-sub">Definí las etapas del contrato, unidades y porcentajes de incidencia</p>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <button className="btn btn-cream btn-sm" onClick={onBack}>
            <Icon name="chevR" size={15} style={{ transform: "rotate(180deg)" }} /> Volver
          </button>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div className="ch-icon"><Icon name="layers" size={20} /></div>
          <div>
            <h2>Etapas del contrato</h2>
            <div className="ch-sub">
              {rows.length} etapas · incidencia total:&nbsp;
              <span style={{ fontWeight: 700, color: incidOk ? "var(--green)" : totalIncid > 100 ? "var(--red)" : "var(--gold)" }}>
                {totalIncid.toFixed(1)}%
              </span>
              {!incidOk && totalIncid > 0 && <span style={{ color: "var(--on-cream-2)", fontSize: 12 }}> (debe sumar 100%)</span>}
            </div>
          </div>
          <div className="ch-right" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => descargarPlantillaEtapas(fases)} title="Descargar plantilla .xlsx">
              <Icon name="download" size={15} /> Plantilla
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setImportOpen(true)} disabled={loading}>
              <Icon name="upload" size={15} /> Importar xlsx
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setModal({ mode: "add" })}>
              <Icon name="plus" size={15} /> Agregar etapa
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "40px 24px", textAlign: "center", opacity: 0.5 }}>
            <Icon name="refresh" size={28} style={{ animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1.5px solid var(--line-cream)" }}>
                  {["#", "Nombre de etapa", "Fase / Tag", "UM", "Total", "Incidencia", ""].map((h, i) => (
                    <th key={i} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--on-cream-2)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: "40px 24px", textAlign: "center", opacity: 0.45 }}>
                      No hay etapas todavía. Hacé clic en "Agregar etapa" o importalas desde un .xlsx con "Importar xlsx".
                    </td>
                  </tr>
                )}
                {rows.map((row, i) => (
                  <tr key={row._key} style={{ borderBottom: "1px solid var(--line-cream)" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.02)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = ""}
                  >
                    <td style={{ padding: "12px 16px", color: "var(--on-cream-2)", fontSize: 13, width: 36 }}>{i + 1}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 500 }}>{row.nombre_etapa}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {row.fase ? <span className="pill pill-gold" style={{ fontSize: 12 }}>{row.fase}</span> : <span style={{ color: "var(--on-cream-2)", fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--on-cream-2)" }}>{row.UM || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>{row.total ? Number(row.total).toLocaleString("es-AR") : "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "var(--gold-deep)" }}>
                      {row.incidencia ? `${parseFloat(row.incidencia).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", width: 110 }}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "5px 8px", position: "relative" }}
                          onClick={() => setInsumosPanel(row)}
                          title="Insumos planificados"
                        >
                          <Icon name="box" size={14} />
                          {row.ID && insumosCounts[row.ID] > 0 && (
                            <span style={{
                              position: "absolute", top: 1, right: 1,
                              background: "var(--gold)", color: "#fff",
                              borderRadius: "50%", width: 14, height: 14,
                              fontSize: 9, fontWeight: 700,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              lineHeight: 1,
                            }}>
                              {insumosCounts[row.ID]}
                            </span>
                          )}
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: "5px 8px" }}
                          onClick={() => setModal({ mode: "edit", row })} title="Editar">
                          <Icon name="settings" size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: "5px 8px", color: "var(--red)" }}
                          onClick={() => setConfirmDelete(row)} disabled={rowBusy === row._key} title="Eliminar">
                          {rowBusy === row._key
                            ? <Icon name="refresh" size={14} style={{ animation: "spin 0.7s linear infinite" }} />
                            : <Icon name="x" size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-cream)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setModal({ mode: "add" })}>
            <Icon name="plus" size={15} /> Agregar etapa
          </button>
          {rows.length > 0 && (
            <span style={{ fontSize: 12.5, color: incidOk ? "var(--green)" : "var(--on-cream-2)" }}>
              {incidOk ? "✓ Incidencia completa al 100%" : `Faltan ${(100 - totalIncid).toFixed(1)}% por asignar`}
            </span>
          )}
        </div>
      </section>

      {modal?.mode === "add" && (
        <EtapaModal
          disponible={disponible}
          fases={fases}
          onFaseCreated={(f) => setFases((prev) => [...prev, f].sort((a, b) => a.nombre.localeCompare(b.nombre)))}
          onConfirm={addEtapa}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === "edit" && (
        <EtapaModal
          initial={{ nombre_etapa: modal.row.nombre_etapa, fase: modal.row.fase || "", UM: modal.row.UM || "", total: modal.row.total ?? "", incidencia: modal.row.incidencia ?? "" }}
          disponible={disponible}
          fases={fases}
          onFaseCreated={(f) => setFases((prev) => [...prev, f].sort((a, b) => a.nombre.localeCompare(b.nombre)))}
          onConfirm={editEtapa}
          onClose={() => setModal(null)}
        />
      )}

      {importOpen && (
        <ImportEtapasModal
          existentes={rows}
          fases={fases}
          onImport={importEtapas}
          onClose={() => setImportOpen(false)}
        />
      )}

      {insumosPanel && (
        <InsumosPanel
          row={insumosPanel}
          onClose={() => setInsumosPanel(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Eliminar etapa"
          message={`¿Eliminar la etapa "${confirmDelete.nombre_etapa}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          danger
          busy={rowBusy === confirmDelete._key}
          onConfirm={async () => { await removeRow(confirmDelete); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "var(--surface)", border: "1.5px solid var(--line-cream)",
          borderRadius: "var(--r-md)", padding: "12px 22px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          fontSize: 14, fontWeight: 600, zIndex: 99,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
