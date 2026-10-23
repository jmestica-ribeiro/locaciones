import React from 'react';
import { Icon, clsx, fmt } from '../components.jsx';
import { getPersonal, getVehiculos } from '../supabase.js';
import { cacheGet, cacheSet } from '../db.js';
import { FotosUploader } from '../components/FotosUploader.jsx';

const NPT_MOTIVOS = [
  "Clima adverso", "Falta de materiales", "Rotura de equipo",
  "Falta de frente de trabajo", "Espera de inspección",
  "Permisos / habilitaciones", "Otro",
];

let _avId = 1;
const newAvance = () => ({
  id: "av" + _avId++,
  fase: "", etapaId: "", valor: "", desc: "",
  npt: null,
  recursos: [],   // array de { nombre, tipo: "vehiculo"|"personal" }
});

/* ── Selector de recursos por tipo ──────────────────────────── */
function RecursosSelector({ recursos, onChange, poolPersonal, poolVehiculos }) {
  const [tab, setTab] = React.useState("vehiculo");
  const [search, setSearch] = React.useState("");

  const pool = tab === "vehiculo" ? poolVehiculos : poolPersonal;
  const label = (r) => tab === "vehiculo"
    ? [r.interno, r.dominio].filter(Boolean).join(" · ")
    : `${r.apellido}, ${r.nombre}`;

  const isOn = (id) => recursos.some((r) => r.id === id);

  const toggle = (item) => {
    if (isOn(item.id)) {
      onChange(recursos.filter((r) => r.id !== item.id));
    } else {
      const nombre = tab === "vehiculo"
        ? [item.interno, item.dominio].filter(Boolean).join(" · ")
        : `${item.apellido}, ${item.nombre}`;
      onChange([...recursos, {
        id: item.id, nombre, tipo: tab, horas: "",
        puesto: item.puesto || null,
        familia: item.familia || null,
        subfamilia: item.subfamilia || null,
      }]);
    }
  };

  const updHoras = (id, horas) => {
    onChange(recursos.map((r) => r.id === id ? { ...r, horas } : r));
  };

  const countVehiculos = recursos.filter((r) => r.tipo === "vehiculo").length;
  const countPersonal  = recursos.filter((r) => r.tipo === "personal").length;

  const filtered = pool.filter((item) => {
    const q = search.toLowerCase();
    return !q || label(item).toLowerCase().includes(q);
  });

  return (
    <div className="rec-section">
      <div className="rec-header">
        <span className="rec-lbl">
          <Icon name="resources" size={14} />
          Recursos
          {recursos.length > 0 && (
            <span className="rec-total-badge">{recursos.length}</span>
          )}
        </span>
        <div className="rec-tabs">
          <button
            className={clsx("rec-tab", tab === "vehiculo" && "on")}
            onClick={() => { setTab("vehiculo"); setSearch(""); }}
          >
            <Icon name="truck" size={14} />
            Vehículos
            {countVehiculos > 0 && <span className="rec-tab-badge">{countVehiculos}</span>}
          </button>
          <button
            className={clsx("rec-tab", tab === "personal" && "on")}
            onClick={() => { setTab("personal"); setSearch(""); }}
          >
            <Icon name="user" size={14} />
            Personal
            {countPersonal > 0 && <span className="rec-tab-badge">{countPersonal}</span>}
          </button>
        </div>
      </div>

      {pool.length > 6 && (
        <div className="rec-search-wrap">
          <Icon name="search" size={13} />
          <input
            className="rec-chip-search"
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {pool.length === 0 ? (
        <div className="rec-pool-empty">
          Sin {tab === "vehiculo" ? "vehículos" : "personal"} cargados en el sistema.
        </div>
      ) : (
        <div className="rec-chips">
          {filtered.map((item) => (
            <button
              key={item.id}
              className={clsx("rec-chip", isOn(item.id) && "on")}
              onClick={() => toggle(item)}
            >
              <Icon name={tab === "vehiculo" ? "truck" : "user"} size={13} />
              {label(item)}
            </button>
          ))}
        </div>
      )}

      {recursos.length > 0 && (
        <div className="rec-selected-list">
          {recursos.map((r) => (
            <div key={r.id} className={clsx("rec-selected-row", r.tipo === "vehiculo" ? "veh" : "per")}>
              <Icon name={r.tipo === "vehiculo" ? "truck" : "user"} size={13} />
              <span className="rec-sel-nombre">
                {r.nombre}
                {(r.puesto || r.familia) && (
                  <span className="rec-sel-meta">
                    {r.tipo === "personal" ? r.puesto : [r.familia, r.subfamilia].filter(Boolean).join(" / ")}
                  </span>
                )}
              </span>
              <div className="rec-sel-horas">
                <input
                  className="rec-sel-hs-input"
                  inputMode="decimal"
                  placeholder="hs"
                  value={r.horas}
                  onChange={(e) => updHoras(r.id, e.target.value.replace(",", "."))}
                />
                <span className="rec-sel-hs-unit">hs</span>
              </div>
              <button className="rec-sel-remove" onClick={() => onChange(recursos.filter((x) => x.id !== r.id))}>
                <Icon name="x" size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── ParteBuilder principal ──────────────────────────────────── */
export function ParteBuilder({ project, onClose, onSave }) {
  const today = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = React.useState(today);
  const [avances, setAvances] = React.useState([newAvance()]);
  const [obs, setObs] = React.useState("");
  const [fotos, setFotos] = React.useState([]);
  const [step, setStep] = React.useState(1);
  const [showErr, setShowErr] = React.useState(false);
  const [poolPersonal, setPoolPersonal] = React.useState([]);
  const [poolVehiculos, setPoolVehiculos] = React.useState([]);

  React.useEffect(() => {
    async function loadRecursos() {
      try {
        const [personal, vehiculos] = await Promise.all([getPersonal(), getVehiculos()]);
        setPoolPersonal(personal);
        setPoolVehiculos(vehiculos);
        await cacheSet('personal', personal);
        await cacheSet('vehiculos', vehiculos);
      } catch {
        // Offline: cargar desde caché
        const [personal, vehiculos] = await Promise.all([
          cacheGet('personal'),
          cacheGet('vehiculos'),
        ]);
        if (personal) setPoolPersonal(personal);
        if (vehiculos) setPoolVehiculos(vehiculos);
      }
    }
    loadRecursos();
  }, []);

  const fases = Array.from(new Set(project.etapas.map((e) => e.tag))).filter(Boolean);
  const etapasDe = (fase) => fase ? project.etapas.filter((e) => e.tag === fase) : project.etapas;
  const etapaById = (id) => project.etapas.find((e) => e.id === id);

  const upd = (id, patch) => setAvances((a) => a.map((x) => x.id === id ? { ...x, ...patch } : x));
  const addAvance = () => setAvances((a) => [...a, newAvance()]);
  const delAvance = (id) => setAvances((a) => a.length > 1 ? a.filter((x) => x.id !== id) : a);

  const toggleNPT = (id) => {
    const av = avances.find((x) => x.id === id);
    upd(id, { npt: av.npt ? null : { motivo: "", horas: "", detalle: "" } });
  };
  const updNPT = (id, patch) => {
    const av = avances.find((x) => x.id === id);
    upd(id, { npt: { ...av.npt, ...patch } });
  };

  // Una fila es válida con etapa + avance > 0, o como "solo NPT" (motivo y horas
  // cargados) sin avance: así se puede reportar un día parado sin ítems.
  const nptCompleto = (av) => av.npt && av.npt.motivo && Number(av.npt.horas) > 0;
  const avValid = (av) => {
    const v = Number(av.valor) || 0;
    if (av.etapaId && v > 0) return true;
    return nptCompleto(av) && v === 0;
  };
  const allValid = avances.every(avValid);

  const next = () => {
    if (!allValid) { setShowErr(true); return; }
    setShowErr(false);
    setStep(2);
  };

  const guardar = () => {
    onSave({
      fecha, obs, fotos,
      avances: avances.map((av) => {
        const et = etapaById(av.etapaId);
        return {
          etapaId: et ? av.etapaId : null,
          etapaName: et ? et.name : null,
          fase: et ? av.fase : null,
          unit: et ? et.unit : null,
          valor: Number(av.valor) || 0,
          desc: av.desc,
          npt: av.npt,
          recursos: av.recursos.map((r) => r.nombre),
          recursosDetalle: av.recursos,
        };
      }),
    });
  };

  const fmtFecha = (s) => {
    try {
      return new Date(s + "T00:00:00").toLocaleDateString("es-AR", {
        day: "numeric", month: "long", year: "numeric",
      });
    } catch { return s; }
  };

  return (
    <div className="pb-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb-modal">
        {/* ── Header ── */}
        <div className="pb-head">
          <div className="pb-title">
            <div className="ch-icon" style={{ background: "rgba(231,177,58,0.16)", color: "var(--gold-deep)" }}>
              <Icon name="report" size={20} />
            </div>
            <div>
              <h2>Cargar parte diario</h2>
              <p>{project.code} · {project.location}</p>
            </div>
          </div>
          <div className="pb-steps">
            <span className={clsx("pb-step", step === 1 && "on")}>1 · Avances</span>
            <span className="pb-step-sep" />
            <span className={clsx("pb-step", step === 2 && "on")}>2 · Resumen</span>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        {/* ── Paso 1: Avances ── */}
        {step === 1 && (
          <>
            <div className="pb-body">
              {/* Fecha */}
              <div className="pb-date">
                <label>Fecha de avance</label>
                <div className="pb-date-input">
                  <Icon name="calendar" size={17} />
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
              </div>

              {/* Avances */}
              <div className="av-list">
                {avances.map((av, i) => {
                  const et = etapaById(av.etapaId);
                  const invalid = showErr && !avValid(av);
                  return (
                    <div className={clsx("av-card", invalid && "bad")} key={av.id}>
                      <div className="av-index"><span>{i + 1}</span></div>
                      <div className="av-fields">

                        {/* Fila de campos */}
                        <div className="av-grid">
                          <div className="av-field">
                            <label>Fase</label>
                            <select
                              className="select"
                              value={av.fase}
                              onChange={(e) => upd(av.id, { fase: e.target.value, etapaId: "" })}
                            >
                              <option value="">Seleccionar…</option>
                              {fases.map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                          <div className="av-field">
                            <label>Etapa{av.npt && !av.etapaId ? " (opcional)" : ""}</label>
                            <select
                              className="select"
                              value={av.etapaId}
                              onChange={(e) => {
                                const etapa = etapaById(e.target.value);
                                upd(av.id, { etapaId: e.target.value, fase: etapa?.tag || av.fase });
                              }}
                            >
                              <option value="">Seleccionar…</option>
                              {etapasDe(av.fase).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                          </div>
                          <div className="av-field av-narrow">
                            <label>Avance {et ? `(${et.unit})` : ""}</label>
                            <input
                              className="input"
                              inputMode="decimal"
                              placeholder="0"
                              value={av.valor}
                              onChange={(e) => upd(av.id, { valor: e.target.value.replace(",", ".") })}
                            />
                            {et && et.total > 0 && av.valor !== "" && (() => {
                              const restante = et.total - et.done - Number(av.valor);
                              return (
                                <span className={clsx("av-restante", restante < 0 && "over")}>
                                  {restante < 0
                                    ? `+${fmt(Math.abs(restante))} sobre el total`
                                    : `Restante: ${fmt(restante)} ${et.unit}`}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="av-field av-desc">
                            <label>Descripción</label>
                            <input
                              className="input"
                              placeholder="Opcional"
                              value={av.desc}
                              onChange={(e) => upd(av.id, { desc: e.target.value })}
                            />
                          </div>
                          <button
                            className={clsx("npt-btn", av.npt && "on")}
                            onClick={() => toggleNPT(av.id)}
                            title="Tiempo no productivo"
                          >NPT</button>
                          <button
                            className="av-del"
                            onClick={() => delAvance(av.id)}
                            title="Quitar avance"
                          ><Icon name="x" size={16} /></button>
                        </div>

                        {/* Panel NPT */}
                        {av.npt && (
                          <div className="npt-panel">
                            <div className="npt-head"><Icon name="alert" size={15} /> Tiempo no productivo (NPT)</div>
                            <div className="npt-grid">
                              <div className="av-field">
                                <label>Motivo</label>
                                <select className="select" value={av.npt.motivo} onChange={(e) => updNPT(av.id, { motivo: e.target.value })}>
                                  <option value="">Seleccionar…</option>
                                  {NPT_MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                              </div>
                              <div className="av-field av-narrow">
                                <label>Cant. hs</label>
                                <input className="input" inputMode="decimal" placeholder="0" value={av.npt.horas} onChange={(e) => updNPT(av.id, { horas: e.target.value.replace(",", ".") })} />
                              </div>
                              <div className="av-field">
                                <label>Detalle de NPT</label>
                                <input className="input" placeholder="Descripción del motivo" value={av.npt.detalle} onChange={(e) => updNPT(av.id, { detalle: e.target.value })} />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Selector de recursos */}
                        <RecursosSelector
                          recursos={av.recursos}
                          onChange={(r) => upd(av.id, { recursos: r })}
                          poolPersonal={poolPersonal}
                          poolVehiculos={poolVehiculos}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className="btn btn-dark add-av" onClick={addAvance}>
                <Icon name="plus" size={16} /> Nuevo avance
              </button>

              <div className="pb-obs">
                <label>Observaciones del día</label>
                <textarea
                  className="textarea"
                  placeholder="Tareas fuera de itemizado, comentarios, observaciones del día"
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                />
              </div>

              <div className="pb-obs">
                <label>Fotos del parte <span style={{ fontWeight: 400, color: "var(--on-cream-2)", textTransform: "none" }}>(máx. 4)</span></label>
                <FotosUploader fotos={fotos} onChange={setFotos} />
              </div>
            </div>

            <div className="pb-foot">
              {showErr && !allValid && (
                <span className="foot-err">
                  <Icon name="alert" size={15} /> Completá Etapa y un avance &gt; 0 en cada fila, o marcá NPT con motivo y horas para un día sin ítems
                </span>
              )}
              <div className="pb-foot-actions">
                <button className="btn btn-cream" onClick={onClose}>Cancelar</button>
                <button className="btn btn-gold" onClick={next}>
                  Siguiente <Icon name="chevR" size={16} />
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Paso 2: Resumen ── */}
        {step === 2 && (
          <>
            <div className="pb-body">
              <div className="resumen-head">
                <div>
                  <div className="ch-sub">Parte del</div>
                  <div className="resumen-fecha">{fmtFecha(fecha)}</div>
                </div>
                <span className="pill pill-cream-gold">
                  {avances.length} avance{avances.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="resumen-list">
                {avances.map((av, i) => {
                  const et = etapaById(av.etapaId);
                  const vehiculos = av.recursos.filter((r) => r.tipo === "vehiculo");
                  const personal  = av.recursos.filter((r) => r.tipo === "personal");
                  return (
                    <div className="resumen-item" key={av.id}>
                      <div className="ri-num" style={{ background: (et?.color || "#e7b13a") + "22", color: et?.color }}>{i + 1}</div>
                      <div className="ri-main">
                        <div className="ri-fase">{av.fase}</div>
                        <div className="ri-etapa">{et ? et.name : "Solo NPT"}</div>
                        {av.desc && <div className="ri-desc">{av.desc}</div>}
                        <div className="ri-tags">
                          {av.npt && (
                            <span className="pill pill-red">
                              <Icon name="alert" size={12} /> NPT: {av.npt.motivo || "s/motivo"} · {av.npt.horas || 0} hs
                            </span>
                          )}
                          {vehiculos.length > 0 && (
                            <span className="pill pill-dim2">
                              <Icon name="truck" size={12} /> {vehiculos.length} vehículo{vehiculos.length > 1 ? "s" : ""}
                            </span>
                          )}
                          {personal.length > 0 && (
                            <span className="pill pill-dim2">
                              <Icon name="user" size={12} /> {personal.length} persona{personal.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {av.recursos.length > 0 && (
                          <div className="ri-recursos">
                            {av.recursos.map((r) => (
                              <span key={r.nombre} className={clsx("ri-rec-chip", r.tipo === "vehiculo" ? "veh" : "per")}>
                                <Icon name={r.tipo === "vehiculo" ? "truck" : "user"} size={11} />
                                {r.nombre}
                                {r.horas ? <b style={{ marginLeft: 4 }}>{r.horas} hs</b> : null}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {et && (
                        <div className="ri-val" style={{ color: et.color }}>
                          +{fmt(Number(av.valor) || 0)} <small>{et.unit}</small>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {obs && (
                <div className="resumen-obs">
                  <div className="ch-sub" style={{ color: "var(--on-cream-2)" }}>Observaciones</div>
                  {obs}
                </div>
              )}

              <div className="resumen-note">
                <Icon name="cloud" size={16} /> Al guardar, el parte queda en el <b>buzón sin conexión</b> hasta sincronizar.
              </div>
            </div>

            <div className="pb-foot">
              <div className="pb-foot-actions">
                <button className="btn btn-cream" onClick={() => setStep(1)}>
                  <Icon name="chevL" size={16} /> Volver
                </button>
                <button className="btn btn-gold" onClick={guardar}>
                  <Icon name="upload" size={16} /> Guardar parte
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
