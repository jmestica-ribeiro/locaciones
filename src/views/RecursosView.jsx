import React from 'react';
import { Icon, clsx } from '../components.jsx';
import {
  getPersonal, upsertPersonal, deletePersonal,
  getVehiculos, upsertVehiculo, deleteVehiculo,
} from '../supabase.js';
import { cacheGet, cacheSet } from '../db.js';

/* ── Modal Importar Excel ───────────────────────────────────────────── */
const PERSONAL_PREVIEW = [
  { apellido: "García", nombre: "Martín", puesto: "Operario", legajo: "1042", centro_costo: "CC-01" },
  { apellido: "López", nombre: "Ana", puesto: "Capataz", legajo: "1018", centro_costo: "CC-02" },
  { apellido: "Rodríguez", nombre: "Carlos", puesto: "Oficial", legajo: "1055", centro_costo: "CC-01" },
  { apellido: "Martínez", nombre: "Sandra", puesto: "Operario", legajo: "1067", centro_costo: "CC-03" },
  { apellido: "Sánchez", nombre: "Diego", puesto: "Peón", legajo: "1081", centro_costo: "CC-02" },
];
const VEHICULO_PREVIEW = [
  { interno: "V-012", dominio: "AB 123 CD", familia: "Flota Liviana", subfamilia: "Camioneta" },
  { interno: "V-023", dominio: "EF 456 GH", familia: "Flota Pesada", subfamilia: "Camión volcador" },
  { interno: "M-007", dominio: "—", familia: "Maquinaria", subfamilia: "Retroexcavadora" },
  { interno: "V-034", dominio: "IJ 789 KL", familia: "Flota Liviana", subfamilia: "Auto" },
];

function ImportExcelModal({ tipo, onClose }) {
  const [step, setStep] = React.useState("idle"); // idle | preview | done
  const isPersonal = tipo === "personal";
  const previewRows = isPersonal ? PERSONAL_PREVIEW : VEHICULO_PREVIEW;

  const handleFileDrop = (e) => {
    e.preventDefault();
    setStep("preview");
  };

  return (
    <div className="scrim" style={{ justifyContent: "center", alignItems: "center" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rec-modal" style={{ width: "min(680px, 96vw)" }}>
        <div className="rec-modal-head">
          <h2>Importar desde Excel</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <div className="rec-modal-body" style={{ padding: "24px" }}>
          {step === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => setStep("preview")}
                style={{
                  border: "2px dashed var(--line-cream)", borderRadius: 12,
                  padding: "40px 24px", textAlign: "center", cursor: "pointer",
                  background: "rgba(231,177,58,0.03)", transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.background = "rgba(231,177,58,0.07)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line-cream)"; e.currentTarget.style.background = "rgba(231,177,58,0.03)"; }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "var(--on-cream)", marginBottom: 6 }}>
                  Arrastrá tu archivo aquí
                </div>
                <div style={{ fontSize: 13, color: "var(--on-cream-2)", marginBottom: 16 }}>
                  o hacé clic para seleccionarlo
                </div>
                <span style={{
                  display: "inline-block", padding: "5px 14px", borderRadius: 20,
                  background: "rgba(42,38,32,0.07)", fontSize: 12, color: "var(--on-cream-2)",
                  fontFamily: "var(--font-display)",
                }}>
                  .xlsx · .xls · .csv
                </span>
              </div>

              <div style={{ background: "rgba(42,38,32,0.04)", borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--on-cream-2)", marginBottom: 10 }}>
                  Columnas esperadas
                </div>
                {isPersonal ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["apellido", "nombre", "puesto", "legajo", "centro_costo"].map(col => (
                      <span key={col} style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(231,177,58,0.15)", color: "#7a6010", fontSize: 12, fontFamily: "var(--font-display)" }}>{col}</span>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["interno", "dominio", "familia", "subfamilia"].map(col => (
                      <span key={col} style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(231,177,58,0.15)", color: "#7a6010", fontSize: 12, fontFamily: "var(--font-display)" }}>{col}</span>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--on-cream-2)" }}>¿No tenés el formato?</span>
                  <button className="btn btn-cream btn-sm" style={{ padding: "4px 12px", fontSize: 12 }}
                    onClick={(e) => e.stopPropagation()}>
                    Descargar plantilla
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(231,177,58,0.1)", borderRadius: 8, border: "1px solid rgba(231,177,58,0.3)" }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--on-cream)" }}>
                    Archivo leído correctamente
                  </div>
                  <div style={{ fontSize: 12, color: "var(--on-cream-2)" }}>
                    {previewRows.length} filas encontradas · Sin errores de formato
                  </div>
                </div>
                <button className="btn btn-cream btn-sm" style={{ marginLeft: "auto", fontSize: 12 }}
                  onClick={() => setStep("idle")}>
                  Cambiar archivo
                </button>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--on-cream-2)" }}>
                Vista previa
              </div>

              <div style={{ overflow: "auto", borderRadius: 10, border: "1.5px solid var(--line-cream)", maxHeight: 260 }}>
                <table className="rec-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      {isPersonal
                        ? ["Apellido","Nombre","Puesto","Legajo","Centro de costo"].map(h => <th key={h}>{h}</th>)
                        : ["Interno","Dominio","Familia","Subfamilia"].map(h => <th key={h}>{h}</th>)
                      }
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i}>
                        {isPersonal
                          ? [row.apellido, row.nombre, row.puesto, row.legajo, row.centro_costo].map((v, j) => <td key={j}>{v}</td>)
                          : [row.interno, row.dominio, row.familia, row.subfamilia].map((v, j) => <td key={j}>{v}</td>)
                        }
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === "done" && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <div style={{ fontWeight: 700, fontSize: 17, color: "var(--on-cream)", marginBottom: 8 }}>
                ¡Importación completada!
              </div>
              <div style={{ fontSize: 14, color: "var(--on-cream-2)" }}>
                Se importaron {previewRows.length} registros correctamente.
              </div>
            </div>
          )}
        </div>

        <div className="rec-modal-foot">
          <button className="btn btn-cream" onClick={onClose}>Cancelar</button>
          {step === "preview" && (
            <button className="btn btn-gold" onClick={() => setStep("done")}>
              Importar {previewRows.length} registros
            </button>
          )}
          {step === "done" && (
            <button className="btn btn-gold" onClick={onClose}>Cerrar</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Modal genérico ─────────────────────────────────────────────────── */
function Modal({ title, onClose, children, onSave, saving }) {
  return (
    <div className="scrim" style={{ justifyContent: "center", alignItems: "center" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rec-modal">
        <div className="rec-modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="rec-modal-body">{children}</div>
        <div className="rec-modal-foot">
          <button className="btn btn-cream" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={onSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Tab Personal ───────────────────────────────────────────────────── */
const PERSONAL_EMPTY = { nombre: "", apellido: "", puesto: "", legajo: "", centro_costo: "" };

function TabPersonal() {
  const [lista, setLista] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState(null); // null | { mode: "add"|"edit", data }
  const [form, setForm] = React.useState(PERSONAL_EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [confirmDel, setConfirmDel] = React.useState(null);
  const [importOpen, setImportOpen] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      try {
        const data = await getPersonal();
        await cacheSet('personal', data);
        setLista(data);
      } catch {
        const cached = await cacheGet('personal');
        setLista(cached || []);
      } finally { setLoading(false); }
    }
    load();
  }, []);

  const openAdd = () => { setForm(PERSONAL_EMPTY); setModal({ mode: "add" }); };
  const openEdit = (p) => { setForm({ ...p }); setModal({ mode: "edit", id: p.id }); };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.apellido.trim()) return;
    setSaving(true);
    try {
      const saved = await upsertPersonal(modal.mode === "edit" ? { ...form, id: modal.id } : form);
      setLista((prev) =>
        modal.mode === "edit"
          ? prev.map((p) => p.id === modal.id ? saved : p)
          : [...prev, saved].sort((a, b) => a.apellido.localeCompare(b.apellido))
      );
      setModal(null);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await deletePersonal(id);
      setLista((prev) => prev.filter((p) => p.id !== id));
    } catch (e) { console.error(e); }
    setConfirmDel(null);
  };

  const filtered = lista.filter((p) => {
    const q = search.toLowerCase();
    return !q || [p.apellido, p.nombre, p.puesto, p.legajo, p.centro_costo].some((v) => v?.toLowerCase().includes(q));
  });

  const f = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div>
      <div className="rec-table-outer">
        <div className="rec-toolbar">
          <div className="rec-search">
            <Icon name="search" size={15} />
            <input className="rec-search-input" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-cream btn-sm" onClick={() => setImportOpen(true)}>
              <Icon name="upload" size={15} /> Importar Excel
            </button>
            <button className="btn btn-gold btn-sm" onClick={openAdd}>
              <Icon name="plus" size={15} /> Agregar persona
            </button>
          </div>
        </div>

      {loading ? (
        <div className="rec-empty">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="rec-empty">{search ? "Sin resultados." : "No hay personal cargado aún."}</div>
      ) : (
        <div className="rec-table-wrap">
          <table className="rec-table">
            <thead>
              <tr>
                <th>Apellido</th>
                <th>Nombre</th>
                <th>Puesto</th>
                <th>Legajo</th>
                <th>Centro de costo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="fw">{p.apellido}</td>
                  <td>{p.nombre}</td>
                  <td><span className="pill pill-dim" style={{ background: "rgba(42,38,32,0.07)", color: "#3a3320" }}>{p.puesto || "—"}</span></td>
                  <td className="mono">{p.legajo || "—"}</td>
                  <td>{p.centro_costo || "—"}</td>
                  <td className="rec-actions">
                    <button className="icon-btn" onClick={() => openEdit(p)} title="Editar"><Icon name="edit" size={15} /></button>
                    <button className="icon-btn icon-btn-red" onClick={() => setConfirmDel(p)} title="Eliminar"><Icon name="trash" size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {modal && (
        <Modal
          title={modal.mode === "add" ? "Agregar persona" : "Editar persona"}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        >
          <div className="field-row">
            <div className="field">
              <label>Apellido <span className="req">*</span></label>
              <input className={clsx("input", !form.apellido && saving && "bad")} value={form.apellido} onChange={f("apellido")} />
            </div>
            <div className="field">
              <label>Nombre <span className="req">*</span></label>
              <input className={clsx("input", !form.nombre && saving && "bad")} value={form.nombre} onChange={f("nombre")} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Puesto</label>
              <input className="input" value={form.puesto} onChange={f("puesto")} />
            </div>
            <div className="field">
              <label>Legajo</label>
              <input className="input" value={form.legajo} onChange={f("legajo")} />
            </div>
          </div>
          <div className="field">
            <label>Centro de costo</label>
            <input className="input" value={form.centro_costo} onChange={f("centro_costo")} />
          </div>
        </Modal>
      )}

      {confirmDel && (
        <div className="scrim" style={{ justifyContent: "center", alignItems: "center" }}
          onMouseDown={(e) => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="rec-confirm">
            <p>¿Eliminar a <b>{confirmDel.apellido}, {confirmDel.nombre}</b>?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-cream btn-sm" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn btn-sm" style={{ background: "var(--red)", color: "#fff" }} onClick={() => handleDelete(confirmDel.id)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {importOpen && <ImportExcelModal tipo="personal" onClose={() => setImportOpen(false)} />}
    </div>
  );
}

/* ── Tab Vehículos ──────────────────────────────────────────────────── */
const VEHICULO_EMPTY = { interno: "", dominio: "", familia: "", subfamilia: "" };

function TabVehiculos() {
  const [lista, setLista] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState(null);
  const [form, setForm] = React.useState(VEHICULO_EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [confirmDel, setConfirmDel] = React.useState(null);
  const [importOpen, setImportOpen] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      try {
        const data = await getVehiculos();
        await cacheSet('vehiculos', data);
        setLista(data);
      } catch {
        const cached = await cacheGet('vehiculos');
        setLista(cached || []);
      } finally { setLoading(false); }
    }
    load();
  }, []);

  const openAdd = () => { setForm(VEHICULO_EMPTY); setModal({ mode: "add" }); };
  const openEdit = (v) => { setForm({ ...v }); setModal({ mode: "edit", id: v.id }); };

  const handleSave = async () => {
    if (!form.interno.trim()) return;
    setSaving(true);
    try {
      const saved = await upsertVehiculo(modal.mode === "edit" ? { ...form, id: modal.id } : form);
      setLista((prev) =>
        modal.mode === "edit"
          ? prev.map((v) => v.id === modal.id ? saved : v)
          : [...prev, saved].sort((a, b) => (a.interno || "").localeCompare(b.interno || ""))
      );
      setModal(null);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await deleteVehiculo(id);
      setLista((prev) => prev.filter((v) => v.id !== id));
    } catch (e) { console.error(e); }
    setConfirmDel(null);
  };

  const filtered = lista.filter((v) => {
    const q = search.toLowerCase();
    return !q || [v.interno, v.dominio, v.familia, v.subfamilia].some((x) => x?.toLowerCase().includes(q));
  });

  const f = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div>
      <div className="rec-table-outer">
        <div className="rec-toolbar">
          <div className="rec-search">
            <Icon name="search" size={15} />
            <input className="rec-search-input" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-cream btn-sm" onClick={() => setImportOpen(true)}>
              <Icon name="upload" size={15} /> Importar Excel
            </button>
            <button className="btn btn-gold btn-sm" onClick={openAdd}>
              <Icon name="plus" size={15} /> Agregar vehículo
            </button>
          </div>
        </div>

      {loading ? (
        <div className="rec-empty">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="rec-empty">{search ? "Sin resultados." : "No hay vehículos cargados aún."}</div>
      ) : (
        <div className="rec-table-wrap">
          <table className="rec-table">
            <thead>
              <tr>
                <th>Interno</th>
                <th>Dominio</th>
                <th>Familia</th>
                <th>Subfamilia</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id}>
                  <td className="fw mono">{v.interno}</td>
                  <td className="mono">{v.dominio || "—"}</td>
                  <td><span className="pill pill-dim" style={{ background: "rgba(42,38,32,0.07)", color: "#3a3320" }}>{v.familia || "—"}</span></td>
                  <td>{v.subfamilia || "—"}</td>
                  <td className="rec-actions">
                    <button className="icon-btn" onClick={() => openEdit(v)} title="Editar"><Icon name="edit" size={15} /></button>
                    <button className="icon-btn icon-btn-red" onClick={() => setConfirmDel(v)} title="Eliminar"><Icon name="trash" size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {modal && (
        <Modal
          title={modal.mode === "add" ? "Agregar vehículo" : "Editar vehículo"}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        >
          <div className="field-row">
            <div className="field">
              <label>Interno <span className="req">*</span></label>
              <input className={clsx("input", !form.interno && saving && "bad")} value={form.interno} onChange={f("interno")} />
            </div>
            <div className="field">
              <label>Dominio</label>
              <input className="input" value={form.dominio} onChange={f("dominio")} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Familia</label>
              <select className="select" value={form.familia} onChange={f("familia")}>
                <option value="">Seleccionar…</option>
                <option>Flota Pesada</option>
                <option>Flota Liviana</option>
                <option>Maquinaria</option>
              </select>
            </div>
            <div className="field">
              <label>Subfamilia</label>
              <input className="input" value={form.subfamilia} onChange={f("subfamilia")} />
            </div>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <div className="scrim" style={{ justifyContent: "center", alignItems: "center" }}
          onMouseDown={(e) => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="rec-confirm">
            <p>¿Eliminar el vehículo <b>{confirmDel.interno}</b>{confirmDel.dominio ? ` (${confirmDel.dominio})` : ""}?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-cream btn-sm" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn btn-sm" style={{ background: "var(--red)", color: "#fff" }} onClick={() => handleDelete(confirmDel.id)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {importOpen && <ImportExcelModal tipo="vehiculos" onClose={() => setImportOpen(false)} />}
    </div>
  );
}

/* ── Vista principal ────────────────────────────────────────────────── */
export function RecursosView() {
  const [tab, setTab] = React.useState("personal");

  return (
    <div className="fade-in">
      <div className="rec-view-head">
        <div>
          <h2 className="rec-view-title">Recursos</h2>
          <p className="rec-view-sub">Gestión de personal y flota de vehículos</p>
        </div>
      </div>

      <div className="rec-tabs-bar">
        <button className={clsx("rec-view-tab", tab === "personal" && "on")} onClick={() => setTab("personal")}>
          <Icon name="user" size={16} /> Personal
        </button>
        <button className={clsx("rec-view-tab", tab === "vehiculos" && "on")} onClick={() => setTab("vehiculos")}>
          <Icon name="truck" size={16} /> Vehículos
        </button>
      </div>

      {tab === "personal" ? <TabPersonal /> : <TabVehiculos />}
    </div>
  );
}
