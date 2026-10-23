import React, { useState } from 'react';
import { Icon } from '../components.jsx';

const ESTADOS = ["En curso", "Pausado", "Finalizado"];
const TIPOS = ["Vial", "Arquitectura", "Hidráulica", "Saneamiento", "Otro"];
const CECOS = [
  "OP-Cipo-Rotonda Av Peron y Av Illia",
  "OP-CIPO-PLAN DE PAVIMENTO 163 CUADRAS",
  "OP-DPA-PLUVIALES CIPOLLETTI I",
];

const empty = () => ({
  ID_Proyecto: "",
  Cliente: "",
  Ubicación: "",
  Descripción: "",
  Estado: "En curso",
  Tipo_Proyecto: "",
  CECO: "",
});

export function NuevoProyecto({ onClose, onSave }) {
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.ID_Proyecto.trim()) e.ID_Proyecto = "Requerido";
    if (!form.Cliente.trim()) e.Cliente = "Requerido";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scrim" onClick={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="drawer">
        <div className="drawer-head">
          <div className="ch-icon"><Icon name="plus" size={20} /></div>
          <div>
            <h2>Nuevo proyecto</h2>
            <p>Completá los datos para crear el proyecto</p>
          </div>
          <button className="btn btn-cream btn-sm" style={{ marginLeft: "auto" }} onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="drawer-body">
          <div className="field">
            <label>Código / ID del proyecto <span className="req">*</span></label>
            <input
              className={`input${errors.ID_Proyecto ? " bad" : ""}`}
              placeholder="Ej: RP69, PROMEBA-ACHA"
              value={form.ID_Proyecto}
              onChange={(e) => { set("ID_Proyecto", e.target.value); setErrors((er) => ({ ...er, ID_Proyecto: undefined })); }}
            />
            {errors.ID_Proyecto && <div className="err">{errors.ID_Proyecto}</div>}
          </div>

          <div className="field">
            <label>Cliente <span className="req">*</span></label>
            <input
              className={`input${errors.Cliente ? " bad" : ""}`}
              placeholder="Ej: Vialidad RN, Municipalidad"
              value={form.Cliente}
              onChange={(e) => { set("Cliente", e.target.value); setErrors((er) => ({ ...er, Cliente: undefined })); }}
            />
            {errors.Cliente && <div className="err">{errors.Cliente}</div>}
          </div>

          <div className="field-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Ubicación</label>
              <input className="input" placeholder="Ej: Gral. Acha" value={form.Ubicación} onChange={(e) => set("Ubicación", e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>CECO</label>
              <select className="select" value={form.CECO} onChange={(e) => set("CECO", e.target.value)}>
                <option value="">— Seleccionar —</option>
                {CECOS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ height: 20 }} />

          <div className="field-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Estado</label>
              <select className="select" value={form.Estado} onChange={(e) => set("Estado", e.target.value)}>
                {ESTADOS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Tipo de proyecto</label>
              <select className="select" value={form.Tipo_Proyecto} onChange={(e) => set("Tipo_Proyecto", e.target.value)}>
                <option value="">— Seleccionar —</option>
                {TIPOS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ height: 20 }} />

          <div className="field">
            <label>Descripción</label>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Breve descripción de la obra"
              value={form.Descripción}
              onChange={(e) => set("Descripción", e.target.value)}
            />
          </div>
        </div>

        <div className="drawer-foot" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-cream" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Icon name="refresh" size={15} style={{ animation: "spin 0.7s linear infinite" }} /> Guardando…</>
              : <><Icon name="plus" size={15} /> Crear proyecto</>}
          </button>
        </div>
      </div>
    </div>
  );
}
