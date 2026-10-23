import React from 'react';
import { Icon, clsx, fmt } from '../components.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { updateAvance, deleteAvance, insertRecursos, deleteRecursosByAvance, getFotosByParte, uploadFoto, deleteFoto } from '../supabase.js';
import { getPersonal, getVehiculos } from '../supabase.js';
import { cacheGet, cacheSet } from '../db.js';

const NPT_MOTIVOS = [
  "Clima adverso", "Falta de materiales", "Rotura de equipo",
  "Falta de frente de trabajo", "Espera de inspección",
  "Permisos / habilitaciones", "Otro",
];

function RecursoRow({ r, onUpdateHoras, onRemove }) {
  return (
    <div className={clsx("rec-selected-row", r.tipo_recurso === "vehiculo" ? "veh" : "per")}>
      <Icon name={r.tipo_recurso === "vehiculo" ? "truck" : "user"} size={13} />
      <span className="rec-sel-nombre">{r.detalle_recurso}</span>
      <div className="rec-sel-horas">
        <input
          className="rec-sel-hs-input"
          inputMode="decimal"
          placeholder="hs"
          value={r._horas ?? r.total_hs ?? ""}
          onChange={(e) => onUpdateHoras(r.id, e.target.value.replace(",", "."))}
        />
        <span className="rec-sel-hs-unit">hs</span>
      </div>
      <button className="rec-sel-remove" onClick={() => onRemove(r.id)}>
        <Icon name="x" size={11} />
      </button>
    </div>
  );
}

function AvanceEditor({ av, etapas, onUpdate, onDelete, onUpdateRecurso, onRemoveRecurso, onAddRecurso, poolPersonal, poolVehiculos, isAdmin }) {
  const [showNPT, setShowNPT] = React.useState(!!av.motivo_npt);
  const [showAddRec, setShowAddRec] = React.useState(false);
  const [recTab, setRecTab] = React.useState("vehiculo");
  const [recSearch, setRecSearch] = React.useState("");

  const fases = [...new Set(etapas.map((e) => e.tag).filter(Boolean))];
  const etapasDeFase = av.fase ? etapas.filter((e) => e.tag === av.fase) : etapas;

  const pool = recTab === "vehiculo" ? poolVehiculos : poolPersonal;
  const poolFiltered = pool.filter((item) => {
    const q = recSearch.toLowerCase();
    const label = recTab === "vehiculo"
      ? [item.interno, item.dominio].filter(Boolean).join(" · ")
      : `${item.apellido}, ${item.nombre}`;
    return !q || label.toLowerCase().includes(q);
  });
  const yaAgregado = (itemId) => (av.Recursos || []).some((r) => r._poolId === itemId);

  const addRecurso = (item) => {
    const nombre = recTab === "vehiculo"
      ? [item.interno, item.dominio].filter(Boolean).join(" · ")
      : `${item.apellido}, ${item.nombre}`;
    onAddRecurso(av.id, {
      id: "new_" + item.id,
      _poolId: item.id,
      _isNew: true,
      detalle_recurso: nombre,
      tipo_recurso: recTab,
      total_hs: null,
      _horas: "",
    });
  };

  return (
    <div className="ep-avance">
      <div className="ep-av-head">
        <span className="ep-av-num">Avance</span>
        {isAdmin && (
          <button className="icon-btn icon-btn-red" onClick={() => onDelete(av.id)} title="Eliminar avance">
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>

      <div className="ep-av-grid">
        {fases.length > 0 && (
          <div className="field">
            <label>Fase</label>
            <select className="select" value={av.fase || ""} onChange={(e) => onUpdate(av.id, { fase: e.target.value })}>
              <option value="">Sin fase</option>
              {fases.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label>Etapa</label>
          <select className="select" value={av.nombre_etapa || ""}
            onChange={(e) => {
              const et = etapas.find(x => x.name === e.target.value);
              onUpdate(av.id, { nombre_etapa: e.target.value, fase: et?.tag || av.fase, UM: et?.unit || av.UM });
            }}>
            <option value="">Seleccionar…</option>
            {etapasDeFase.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Avance {av.UM ? `(${av.UM})` : ""}</label>
          <input className="input" inputMode="decimal" value={av.total_avance ?? ""}
            onChange={(e) => onUpdate(av.id, { total_avance: e.target.value.replace(",", ".") })} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Descripción</label>
          <input className="input" placeholder="Opcional" value={av.descripcion || ""}
            onChange={(e) => onUpdate(av.id, { descripcion: e.target.value })} />
        </div>
      </div>

      {/* NPT */}
      <div className="ep-npt-toggle">
        <button
          className={clsx("btn btn-sm", showNPT ? "btn-dark" : "btn-ghost")}
          onClick={() => {
            setShowNPT((v) => !v);
            if (showNPT) onUpdate(av.id, { motivo_npt: null, tiempo_npt: null, detalle_npt: null });
          }}
        >
          <Icon name="alert" size={13} /> NPT
        </button>
      </div>
      {showNPT && (
        <div className="ep-npt-panel">
          <div className="ep-av-grid">
            <div className="field">
              <label>Motivo</label>
              <select className="select" value={av.motivo_npt || ""}
                onChange={(e) => onUpdate(av.id, { motivo_npt: e.target.value })}>
                <option value="">Seleccionar…</option>
                {NPT_MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Horas</label>
              <input className="input" inputMode="decimal" value={av.tiempo_npt ?? ""}
                onChange={(e) => onUpdate(av.id, { tiempo_npt: e.target.value.replace(",", ".") })} />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Detalle</label>
              <input className="input" value={av.detalle_npt || ""}
                onChange={(e) => onUpdate(av.id, { detalle_npt: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {/* Recursos */}
      <div className="ep-recursos">
        {(av.Recursos || []).length > 0 && (
          <div className="rec-selected-list" style={{ marginBottom: 8 }}>
            {(av.Recursos || []).map((r) => (
              <RecursoRow key={r.id} r={r}
                onUpdateHoras={(id, val) => onUpdateRecurso(av.id, id, val)}
                onRemove={(id) => onRemoveRecurso(av.id, id)} />
            ))}
          </div>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAddRec((v) => !v)}>
          <Icon name="plus" size={13} /> Agregar recurso
        </button>
        {showAddRec && (
          <div className="ep-add-rec">
            <div className="rec-tabs" style={{ marginBottom: 8 }}>
              <button className={clsx("rec-tab", recTab === "vehiculo" && "on")} onClick={() => { setRecTab("vehiculo"); setRecSearch(""); }}>
                <Icon name="truck" size={13} /> Vehículos
              </button>
              <button className={clsx("rec-tab", recTab === "personal" && "on")} onClick={() => { setRecTab("personal"); setRecSearch(""); }}>
                <Icon name="user" size={13} /> Personal
              </button>
            </div>
            {pool.length > 5 && (
              <div className="rec-search-wrap" style={{ marginBottom: 8 }}>
                <Icon name="search" size={13} />
                <input className="rec-chip-search" placeholder="Buscar…" value={recSearch}
                  onChange={(e) => setRecSearch(e.target.value)} />
              </div>
            )}
            <div className="rec-chips">
              {poolFiltered.map((item) => (
                <button key={item.id}
                  className={clsx("rec-chip", yaAgregado(item.id) && "on")}
                  onClick={() => !yaAgregado(item.id) && addRecurso(item)}
                >
                  <Icon name={recTab === "vehiculo" ? "truck" : "user"} size={12} />
                  {recTab === "vehiculo"
                    ? [item.interno, item.dominio].filter(Boolean).join(" · ")
                    : `${item.apellido}, ${item.nombre}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EditParteDrawer({ parte, project, onClose, onSaved }) {
  const { isAdmin } = useAuth();
  const [fecha, setFecha] = React.useState(parte.fecha);
  const [avances, setAvances] = React.useState(parte.items.map((a) => ({
    ...a,
    Recursos: (a.Recursos || []).map((r) => ({ ...r, _horas: r.total_hs ?? "", _isNew: false })),
  })));
  const [saving, setSaving] = React.useState(false);
  const [poolPersonal, setPoolPersonal] = React.useState([]);
  const [poolVehiculos, setPoolVehiculos] = React.useState([]);
  const [confirmDelAvance, setConfirmDelAvance] = React.useState(null);
  const [fotos, setFotos] = React.useState([]);
  const [lightbox, setLightbox] = React.useState(null);

  React.useEffect(() => {
    async function loadRecursos() {
      try {
        const [personal, vehiculos] = await Promise.all([getPersonal(), getVehiculos()]);
        setPoolPersonal(personal);
        setPoolVehiculos(vehiculos);
        await cacheSet('personal', personal);
        await cacheSet('vehiculos', vehiculos);
      } catch {
        const [personal, vehiculos] = await Promise.all([
          cacheGet('personal'),
          cacheGet('vehiculos'),
        ]);
        if (personal) setPoolPersonal(personal);
        if (vehiculos) setPoolVehiculos(vehiculos);
      }
    }
    loadRecursos();
    if (parte.id && !parte.id.startsWith("fecha:")) {
      getFotosByParte(parte.id).then(setFotos).catch(console.error);
    }
  }, []);

  const updateAvanceLocal = (avId, patch) => {
    setAvances((prev) => prev.map((a) => a.id === avId ? { ...a, ...patch } : a));
  };

  const deleteAvanceLocal = (avId) => {
    setAvances((prev) => prev.filter((a) => a.id !== avId));
    setConfirmDelAvance(null);
  };

  const updateRecursoLocal = (avId, recId, horas) => {
    setAvances((prev) => prev.map((a) => {
      if (a.id !== avId) return a;
      return { ...a, Recursos: a.Recursos.map((r) => r.id === recId ? { ...r, _horas: horas } : r) };
    }));
  };

  const removeRecursoLocal = (avId, recId) => {
    setAvances((prev) => prev.map((a) => {
      if (a.id !== avId) return a;
      return { ...a, Recursos: a.Recursos.filter((r) => r.id !== recId) };
    }));
  };

  const addRecursoLocal = (avId, rec) => {
    setAvances((prev) => prev.map((a) => {
      if (a.id !== avId) return a;
      return { ...a, Recursos: [...a.Recursos, rec] };
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // IDs de avances originales del parte
      const idsOriginales = new Set(parte.items.map((a) => a.id));
      const idsActuales = new Set(avances.map((a) => a.id));

      // Eliminar avances borrados
      for (const id of idsOriginales) {
        if (!idsActuales.has(id)) await deleteAvance(id);
      }

      // Actualizar avances existentes
      for (const av of avances) {
        if (!idsOriginales.has(av.id)) continue;
        await updateAvance(av.id, {
          fecha_avance: fecha,
          nombre_etapa: av.nombre_etapa,
          fase: av.fase,
          total_avance: Number(av.total_avance) || 0,
          UM: av.UM,
          descripcion: av.descripcion || null,
          motivo_npt: av.motivo_npt || null,
          tiempo_npt: av.tiempo_npt ? Number(av.tiempo_npt) : null,
          detalle_npt: av.detalle_npt || null,
        });

        // Recursos: borrar todos y reinsertar
        await deleteRecursosByAvance(av.id);
        if (av.Recursos?.length) {
          await insertRecursos(av.Recursos.map((r) => ({
            ID_Avance: av.id,
            tipo_recurso: r.tipo_recurso,
            detalle_recurso: r.detalle_recurso,
            total_hs: r._horas ? Number(r._horas) : (r.total_hs || null),
            ID_RecursoFuente: r._poolId || r.ID_RecursoFuente || null,
          })));
        }
      }

      // Subir fotos nuevas
      for (const f of fotos) {
        if (f._isNew && f.file) await uploadFoto(f.file, parte.id, parte.items[0]?.ID_Proyecto);
      }

      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer">
        <div className="drawer-head">
          <div className="ch-icon" style={{ background: "rgba(231,177,58,0.15)", color: "var(--gold-deep)" }}>
            <Icon name="edit" size={20} />
          </div>
          <div>
            <h2>Editar parte {parte.idCorto ? `#${parte.idCorto}` : `P-${String(parte.num).padStart(3,"0")}`}</h2>
            <p>{project.code} · {project.location}</p>
          </div>
          <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {/* Fecha */}
          <div className="field">
            <label>Fecha del parte</label>
            <div className="pb-date-input">
              <Icon name="calendar" size={17} />
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          {/* Fotos */}
          {(fotos.length > 0 || !parte.id?.startsWith("fecha:")) && (
            <div className="field">
              <label>Fotos del parte <span style={{ fontWeight: 400, color: "var(--on-cream-2)", textTransform: "none" }}>({fotos.length}/4)</span></label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {fotos.map((f) => (
                  <div key={f.id} className="hist-foto-wrap">
                    <img src={f.preview || f.url} alt={f.nombre} className="hist-foto-thumb"
                      style={{ width: 72, height: 72 }}
                      onClick={() => setLightbox(f)} />
                    <button className="hist-foto-del" onClick={async () => {
                      if (!f._isNew) await deleteFoto(f.id, f.url).catch(console.error);
                      setFotos((prev) => prev.filter((x) => x.id !== f.id));
                    }}>
                      <Icon name="x" size={10} />
                    </button>
                  </div>
                ))}
                {fotos.length < 4 && (
                  <label className="foto-add" style={{ width: 72, height: 72, cursor: "pointer" }}>
                    <Icon name="plus" size={18} />
                    <span>Agregar</span>
                    <input type="file" accept="image/*" multiple hidden onChange={(e) => {
                      Array.from(e.target.files).slice(0, 4 - fotos.length).forEach((file) => {
                        const reader = new FileReader();
                        reader.onload = (ev) => setFotos((prev) => [
                          ...prev,
                          { id: `new_${Date.now()}`, file, preview: ev.target.result, _isNew: true }
                        ].slice(0, 4));
                        reader.readAsDataURL(file);
                      });
                    }} />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Avances */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
            {avances.map((av) => (
              <AvanceEditor
                key={av.id}
                av={av}
                etapas={project.etapas}
                onUpdate={updateAvanceLocal}
                onDelete={(id) => setConfirmDelAvance(id)}
                onUpdateRecurso={updateRecursoLocal}
                onRemoveRecurso={removeRecursoLocal}
                onAddRecurso={addRecursoLocal}
                isAdmin={isAdmin}
                poolPersonal={poolPersonal}
                poolVehiculos={poolVehiculos}
              />
            ))}
          </div>

          {avances.length === 0 && (
            <div style={{ textAlign: "center", opacity: 0.45, fontSize: 13, padding: "24px 0" }}>
              Todos los avances fueron eliminados. Guardá para confirmar.
            </div>
          )}
        </div>

        <div className="drawer-foot">
          <button className="btn btn-cream" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : <><Icon name="check" size={16} /> Guardar cambios</>}
          </button>
        </div>
      </div>

      {/* Confirmar borrado de avance */}
      {confirmDelAvance && (
        <div className="scrim" style={{ justifyContent: "center", alignItems: "center", zIndex: 50 }}
          onMouseDown={(e) => e.target === e.currentTarget && setConfirmDelAvance(null)}>
          <div className="rec-confirm">
            <p>¿Eliminar este avance del parte?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-cream btn-sm" onClick={() => setConfirmDelAvance(null)}>Cancelar</button>
              <button className="btn btn-sm" style={{ background: "var(--red)", color: "#fff" }}
                onClick={() => deleteAvanceLocal(confirmDelAvance)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="foto-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox.preview || lightbox.url} alt={lightbox.nombre} />
        </div>
      )}
    </div>
  );
}
