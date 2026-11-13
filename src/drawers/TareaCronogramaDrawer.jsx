import React from 'react';
import { Icon, clsx } from '../components.jsx';
import { registrarAvanceToyotaWell, updateTareaToyotaWell } from '../supabase.js';
import {
  ESTADOS_TAREA, cadenaPendiente, requiereJustificacion, duracionHabiles,
  fmtFechaCorta, fmtDias, fmtDesvio,
} from '../toyotaWell.js';

const RAPIDOS = [0, 25, 50, 75, 100];
const fmtLargo = (iso) => (iso ? fmtFechaCorta(iso, { semana: false }) : "—");
const contexto = (n) => n.ruta.slice(1).join(" › ");
const fmtHora = (ts) => new Date(ts).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

function Campo({ label, req, error, hint, children, className }) {
  return (
    <div className={clsx("field", className)} style={{ marginBottom: 0 }}>
      <label>{label}{req && <> <span className="req">*</span></>}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
      {error && <div className="err">{error}</div>}
    </div>
  );
}

/** Una tarea de la que depende (o que depende de) la abierta. */
function FilaTarea({ t, onAbrir, nota }) {
  const est = ESTADOS_TAREA[t.estado];
  return (
    <button type="button" className="tw-dep" onClick={() => onAbrir(t.id)} title="Abrir esta tarea">
      <span className="tw-dep-id mono">{t.orden}</span>
      <span className="tw-dep-txt">
        <b>{t.nombre}</b>
        <small>{contexto(t)}</small>
      </span>
      <span className="tw-dep-right">
        {nota && <small className="tw-dep-nota">{nota}</small>}
        <span className={clsx("pill", est.pill)}>{t.completa ? "Completada" : `${est.label} · ${Math.round(t.avance)}%`}</span>
        <small>{t.completa ? `terminó ${fmtLargo(t.finReal)}` : `termina ≈ ${fmtLargo(t.finEst)}`}</small>
      </span>
    </button>
  );
}

export function TareaCronogramaDrawer({ tarea: t, crono, hoy, isAdmin, onClose, onAbrir, onSaved }) {
  const [form, setForm] = React.useState(() => ({
    avance: t.avance,
    inicio_real: t.inicio_real || "",
    fin_real: t.fin_real || "",
    fecha: hoy,
    justificacion: "",
    notas: t.notas || "",
    inicio: t.inicio || "",
    fin: t.fin || "",
  }));
  const [errores, setErrores] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [errorGuardar, setErrorGuardar] = React.useState(null);
  const [confirmar, setConfirmar] = React.useState(null); // acción pendiente si hay cambios sin guardar

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrores((e) => { const n = { ...e }; Object.keys(patch).forEach((k) => delete n[k]); return n; });
  };

  const setPlan = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrores((e) => ({ ...e, plan: undefined }));
  };

  // Al mover el %: completa o limpia las fechas reales como haría Project.
  const setAvance = (v) => {
    const avance = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    const patch = { avance };
    if (avance > 0 && !form.inicio_real) patch.inicio_real = form.fecha;
    if (avance === 100 && !form.fin_real) patch.fin_real = form.fecha;
    if (avance < 100 && form.fin_real) patch.fin_real = "";
    set(patch);
  };

  const cambiosDatos = form.avance !== t.avance || form.inicio_real !== (t.inicio_real || "")
    || form.fin_real !== (t.fin_real || "");
  const cambiosAvance = cambiosDatos || form.justificacion.trim() !== "";
  const cambiosNotas = form.notas.trim() !== (t.notas || "").trim();
  const cambiosPlan = isAdmin && (form.inicio !== (t.inicio || "") || form.fin !== (t.fin || ""));
  const dirty = cambiosAvance || cambiosNotas || cambiosPlan;

  const plan = { inicio: form.inicio || t.inicio, fin: form.fin || t.fin };
  const just = requiereJustificacion(plan, form);
  const mostrarJustificacion = just.requiere || t.atrasada;
  // Obligatoria si se registra un avance de una tarea atrasada, o si el atraso todavía no se justificó.
  const justObligatoria = just.requiere && (cambiosDatos || t.sinJustificar);

  const pendientes = t.predsPendientes;
  const cadena = React.useMemo(() => cadenaPendiente(t, crono.hojasDe), [t, crono]);
  const indirectas = cadena.filter((c) => !pendientes.some((p) => p.id === c.id));
  const habilita = t.sucesoras;
  const est = ESTADOS_TAREA[t.estado];

  const validar = () => {
    const e = {};
    if (cambiosAvance) {
      if (form.avance > 0 && !form.inicio_real) e.inicio_real = "Indicá cuándo empezó";
      if (form.avance === 100 && !form.fin_real) e.fin_real = "Indicá cuándo terminó";
      if (form.fin_real && form.avance < 100) e.fin_real = "Con fecha de fin el avance tiene que ser 100 %";
      if (form.inicio_real && form.inicio_real > hoy) e.inicio_real = "No puede ser una fecha futura";
      if (form.fin_real && form.fin_real > hoy) e.fin_real = "No puede ser una fecha futura";
      if (form.inicio_real && form.fin_real && form.fin_real < form.inicio_real) e.fin_real = "No puede ser anterior al comienzo real";
      if (!form.fecha) e.fecha = "Indicá la fecha del avance";
      else if (form.fecha > hoy) e.fecha = "No puede ser una fecha futura";
      if (just.requiere && !form.justificacion.trim()) e.justificacion = "La tarea está atrasada: justificá el desvío para poder guardar";
    }
    if (cambiosPlan) {
      if (!form.inicio || !form.fin) e.plan = "El plan necesita comienzo y fin";
      else if (form.fin < form.inicio) e.plan = "El fin no puede ser anterior al comienzo";
    }
    return e;
  };

  const guardar = async () => {
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setErrorGuardar(null);
    try {
      if (cambiosPlan) await updateTareaToyotaWell(t.id, { inicio: form.inicio, fin: form.fin });
      if (cambiosAvance) {
        await registrarAvanceToyotaWell(t.id, {
          avance: form.avance, inicio_real: form.inicio_real, fin_real: form.fin_real,
          fecha: form.fecha, justificacion: form.justificacion.trim(),
        });
      }
      if (cambiosNotas) await updateTareaToyotaWell(t.id, { notas: form.notas.trim() || null });
      onSaved(cambiosAvance ? `Avance de la tarea ${t.orden} registrado` : `Tarea ${t.orden} actualizada`);
    } catch (err) {
      setErrorGuardar(err.message || "No se pudo guardar");
      setSaving(false);
    }
  };

  const siLibre = (accion) => (dirty ? setConfirmar(() => accion) : accion());
  const irA = (id) => siLibre(() => onAbrir(id));
  const historial = [...t.avances].reverse();

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && !saving && siLibre(onClose)}>
      <div className="drawer tw-drawer" role="dialog" aria-modal="true" aria-label={`Tarea ${t.orden}`}>
        <div className="drawer-head">
          <div className="ch-icon"><Icon name="calendar" size={20} /></div>
          <div style={{ minWidth: 0 }}>
            <h2>{t.orden} · {t.nombre}</h2>
            <p className="obi-head-sub" title={contexto(t)}>{contexto(t)}</p>
          </div>
          <button className="btn btn-cream btn-sm" style={{ marginLeft: "auto" }} onClick={() => siLibre(onClose)} title="Cerrar">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="drawer-body">
          {/* ── Resumen ── */}
          <div className="tw-resumen-tarea">
            <span className={clsx("pill", est.pill)}>{est.label}</span>
            {t.sinJustificar && <span className="pill pill-red"><Icon name="alert" size={11} /> Atraso sin justificar</span>}
            <div className="tw-rt-datos">
              <span>Plan <b>{fmtLargo(t.inicioPlan)} → {fmtLargo(t.finPlan)}</b> ({fmtDias(t.dur)})</span>
              <span>{t.finReal ? "Real" : "Proyectado"} <b>{fmtLargo(t.inicioReal || t.inicioEst)} → {fmtLargo(t.finReal || t.finEst)}</b></span>
              <span>Desvío <b className={clsx("tw-desvio", t.desvio > 0 && "pos", t.desvio < 0 && "neg")}>{t.desvio === 0 ? "0 d" : fmtDesvio(t.desvio)}</b> hábiles</span>
            </div>
          </div>

          {/* ── Qué falta para avanzar ── */}
          <section className="obi-sec" style={{ marginTop: 18 }}>
            <div className="obi-sec-band"><div><h3>Qué falta para avanzar</h3><p>Predecesoras: tareas que tienen que terminar antes de que esta empiece</p></div></div>
            {t.completa ? (
              <div className="tw-falta ok"><Icon name="checkCircle" size={16} /> La tarea está completada (terminó el {fmtLargo(t.finReal)}).</div>
            ) : t.empezada ? (
              <div className="tw-falta ok"><Icon name="checkCircle" size={16} /> La tarea ya empezó; falta completar el {100 - t.avance} % del trabajo.</div>
            ) : pendientes.length === 0 ? (
              <div className="tw-falta ok">
                <Icon name="checkCircle" size={16} />
                {t.preds.length ? "Todas sus predecesoras están completas: la tarea puede empezar." : "No depende de otras tareas: puede empezar."}
              </div>
            ) : (
              <div className={clsx("tw-falta", t.estado === "bloqueada" ? "bloq" : "espera")}>
                <Icon name={t.estado === "bloqueada" ? "alert" : "clock"} size={16} />
                <span>
                  {t.estado === "bloqueada" ? "Bloqueada: según el plan ya tendría que haber empezado, pero " : "Para empezar "}
                  {t.estado === "bloqueada" ? (pendientes.length === 1 ? "falta terminar" : "faltan terminar") : (pendientes.length === 1 ? "falta que termine" : "falta que terminen")} {pendientes.length} tarea{pendientes.length !== 1 ? "s" : ""}.
                  Con el avance actual podría empezar el <b>{fmtLargo(t.inicioEst)}</b>.
                </span>
              </div>
            )}
            {pendientes.length > 0 && (
              <div className="tw-deps">
                {pendientes.map((p) => <FilaTarea key={p.id} t={p} onAbrir={irA} />)}
              </div>
            )}
            {indirectas.length > 0 && (
              <details className="tw-indirectas">
                <summary>Antes de esas, también tienen que terminar {indirectas.length} tarea{indirectas.length !== 1 ? "s" : ""} más</summary>
                <div className="tw-deps">{indirectas.map((p) => <FilaTarea key={p.id} t={p} onAbrir={irA} />)}</div>
              </details>
            )}
            {t.preds.length > pendientes.length && (
              <div className="tw-hechas">
                Predecesoras completas: {t.preds.filter((p) => p.completa).map((p) => (
                  <button key={p.id} type="button" className="tw-pred done" onClick={() => irA(p.id)} title={`${p.nombre} (${contexto(p)})`}>
                    <Icon name="check" size={11} />{p.orden}
                  </button>
                ))}
              </div>
            )}
            {habilita.length > 0 && (
              <div className="tw-hechas">
                Cuando termine habilita a: {habilita.map((s) => (
                  <button key={s.id} type="button" className={clsx("tw-pred", s.completa ? "done" : "pend")} onClick={() => irA(s.id)} title={`${s.nombre} (${contexto(s)})`}>
                    {s.orden}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* ── Registrar avance ── */}
          <section className="obi-sec">
            <div className="obi-sec-band"><div><h3>Registrar avance</h3><p>Queda en el historial con tu usuario y la fecha</p></div></div>
            <div className="tw-avance">
              <div className="tw-avance-num">
                <input type="number" className="input" min={0} max={100} step={1} value={form.avance}
                  onChange={(e) => setAvance(e.target.value)} aria-label="% completado" />
                <span>%</span>
              </div>
              <input type="range" className="tw-range" min={0} max={100} step={5} value={form.avance}
                onChange={(e) => setAvance(e.target.value)} aria-label="% completado" />
              <div className="tw-rapidos">
                {RAPIDOS.map((v) => (
                  <button key={v} type="button" className={clsx("tw-rapido", form.avance === v && "on")} onClick={() => setAvance(v)}>{v}%</button>
                ))}
              </div>
            </div>
            <div className="tw-grid3">
              <Campo label="Comienzo real" req={form.avance > 0} error={errores.inicio_real}>
                <input type="date" className={clsx("input", errores.inicio_real && "bad")} max={hoy}
                  value={form.inicio_real} onChange={(e) => set({ inicio_real: e.target.value })} />
              </Campo>
              <Campo label="Fin real" req={form.avance === 100} error={errores.fin_real}>
                <input type="date" className={clsx("input", errores.fin_real && "bad")} max={hoy}
                  value={form.fin_real} onChange={(e) => set({ fin_real: e.target.value, ...(e.target.value ? { avance: 100 } : {}) })} />
              </Campo>
              <Campo label="Fecha del avance" req error={errores.fecha} hint="Día al que corresponde el % informado">
                <input type="date" className={clsx("input", errores.fecha && "bad")} max={hoy}
                  value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} />
              </Campo>
            </div>

            {mostrarJustificacion && (
              <div className={clsx("tw-just", justObligatoria && "req")}>
                <div className="tw-just-msg">
                  <Icon name="alert" size={15} />
                  <span>
                    {just.tardeInicio && just.tardeFin
                      ? <>Atrasada respecto del plan: debía empezar el <b>{fmtLargo(plan.inicio)}</b> y terminar el <b>{fmtLargo(plan.fin)}</b>.</>
                      : just.tardeInicio
                        ? <>Atrasada respecto del plan: debía empezar el <b>{fmtLargo(plan.inicio)}</b>.</>
                        : just.tardeFin
                          ? <>Atrasada respecto del plan: debía terminar el <b>{fmtLargo(plan.fin)}</b>.</>
                          : <>La tarea tuvo atraso respecto del plan.</>}
                    {" "}{justObligatoria
                      ? (cambiosDatos ? "Para registrar el avance tenés que justificar el desvío." : "El atraso todavía no está justificado: escribí la justificación y guardá.")
                      : t.sinJustificar ? "Podés agregar la justificación del atraso."
                        : "El atraso ya está justificado; podés agregar otra justificación si cambió la situación."}
                  </span>
                </div>
                <Campo label="Justificación del desvío" req={justObligatoria} error={errores.justificacion}>
                  <textarea className={clsx("textarea", errores.justificacion && "bad")} rows={3}
                    placeholder="Ej: equipo en reparación, falta de operador, lluvia, cambio de prioridades de obra…"
                    value={form.justificacion} onChange={(e) => set({ justificacion: e.target.value })} />
                </Campo>
                {t.ultimaJustificacion && (
                  <div className="tw-just-ult">
                    Última justificación ({fmtLargo(t.ultimaJustificacion.fecha)}{t.ultimaJustificacion.autor?.nombre ? `, ${t.ultimaJustificacion.autor.nombre}` : ""}):
                    {" "}<i>“{t.ultimaJustificacion.justificacion}”</i>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Línea base ── */}
          <section className="obi-sec">
            <div className="obi-sec-band"><div><h3>Plan (línea base)</h3><p>Fechas ideales contra las que se mide el desvío</p></div></div>
            {isAdmin ? (
              <div className="tw-grid3" style={{ marginTop: 12 }}>
                <Campo label="Comienzo" error={errores.plan}>
                  <input type="date" className={clsx("input", errores.plan && "bad")} value={form.inicio} onChange={(e) => setPlan({ inicio: e.target.value })} />
                </Campo>
                <Campo label="Fin">
                  <input type="date" className={clsx("input", errores.plan && "bad")} value={form.fin} onChange={(e) => setPlan({ fin: e.target.value })} />
                </Campo>
                <Campo label="Duración">
                  <div className="tw-dur">{form.inicio && form.fin && form.fin >= form.inicio ? fmtDias(duracionHabiles(form.inicio, form.fin)) : "—"} hábiles</div>
                </Campo>
              </div>
            ) : (
              <div className="tw-plan-ro">
                <span>Comienzo <b>{fmtFechaCorta(t.inicioPlan)}</b></span>
                <span>Fin <b>{fmtFechaCorta(t.finPlan)}</b></span>
                <span>Duración <b>{fmtDias(t.dur)}</b></span>
                <small>Solo un administrador puede modificar la línea base.</small>
              </div>
            )}
          </section>

          {/* ── Notas ── */}
          <section className="obi-sec">
            <div className="obi-sec-band"><div><h3>Notas</h3></div></div>
            <textarea className="textarea" rows={2} style={{ marginTop: 12 }} placeholder="Observaciones de la tarea"
              value={form.notas} onChange={(e) => set({ notas: e.target.value })} />
          </section>

          {/* ── Historial ── */}
          <section className="obi-sec">
            <div className="obi-sec-band"><div><h3>Historial de avances</h3><p>{historial.length} registro{historial.length !== 1 ? "s" : ""}</p></div></div>
            {historial.length === 0 ? (
              <div className="obi-subempty">Todavía no se registró avance en esta tarea.</div>
            ) : (
              <div className="obi-subtable-wrap">
                <table className="rec-table obi-subtable">
                  <thead><tr><th>Fecha</th><th>Avance</th><th>Comienzo / fin real</th><th>Registró</th><th>Justificación del desvío</th></tr></thead>
                  <tbody>
                    {historial.map((a) => (
                      <tr key={a.id}>
                        <td className="obi-nowrap">{fmtFechaCorta(a.fecha)}</td>
                        <td className="obi-nowrap"><b>{a.avance}%</b></td>
                        <td className="obi-nowrap">{fmtLargo(a.inicio_real)} → {fmtLargo(a.fin_real)}</td>
                        <td className="obi-nowrap" title={a.created_at ? `Cargado el ${fmtHora(a.created_at)}` : undefined}>
                          {a.origen === "importacion" ? <span className="obi-muted">Importado de Project</span> : a.autor?.nombre || "—"}
                        </td>
                        <td className="obi-wrap">{a.justificacion || <span className="obi-muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="drawer-foot obi-foot">
          {errorGuardar && <span className="obi-foot-err"><Icon name="alert" size={14} /> {errorGuardar}</span>}
          <div className="obi-foot-right">
            <button className="btn btn-cream" onClick={() => siLibre(onClose)} disabled={saving}>Cancelar</button>
            <button className="btn btn-gold" onClick={guardar} disabled={saving || !dirty}>
              {saving
                ? <><Icon name="refresh" size={15} style={{ animation: "spin 0.7s linear infinite" }} /> Guardando…</>
                : <><Icon name="check" size={15} /> {cambiosAvance ? "Registrar avance" : "Guardar"}</>}
            </button>
          </div>
        </div>
      </div>

      {confirmar && (
        <div className="scrim" style={{ justifyContent: "center", alignItems: "center", zIndex: 50 }}
          onMouseDown={(e) => e.target === e.currentTarget && setConfirmar(null)}>
          <div className="rec-confirm">
            <p>Hay cambios sin guardar en la tarea <b>{t.orden}</b>. ¿Querés descartarlos?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-cream btn-sm" onClick={() => setConfirmar(null)}>Seguir editando</button>
              <button className="btn btn-sm" style={{ background: "var(--red)", color: "#fff" }} onClick={() => { const a = confirmar; setConfirmar(null); a(); }}>
                Descartar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
