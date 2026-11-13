// Gestión industrial › Toyota Well: cálculos del cronograma (como MS Project).
//
// - Calendario: lunes a viernes, sin feriados (el mismo del archivo de Project).
// - inicio/fin son la línea base (plan ideal); inicio_real/fin_real/avance, la ejecución.
// - Las predecesoras son vínculos fin-comienzo: la tarea arranca el día hábil
//   siguiente a que terminen todas.
// - El avance de una tarea resumen se pondera por la duración de sus subtareas
//   (igual que el % completado de Project).
// - La proyección corre la cadena de predecesoras a partir del avance real: lo
//   que no empezó no puede empezar antes de hoy ni antes de que terminen sus
//   predecesoras, y lo que está en curso necesita el trabajo que le falta.

/* ── Fechas: día entero desde 1970 (UTC) para no depender del huso horario ── */

const DIA = 86400000;
export const aDia = (iso) => (iso ? Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DIA) : null);
export const aISO = (n) => (n == null ? null : new Date(n * DIA).toISOString().slice(0, 10));
const esHabil = (n) => { const d = new Date(n * DIA).getUTCDay(); return d !== 0 && d !== 6; };

/** El mismo día si es hábil; si no, el próximo hábil. */
export function habil(n) { while (!esHabil(n)) n++; return n; }

/** Avanza k días hábiles desde n (n se toma como hábil). */
export function sumarHabiles(n, k) {
  let d = habil(n);
  for (let i = 0; i < k; i++) d = habil(d + 1);
  return d;
}

/** Días hábiles en [a, b] (inclusive). 0 si b < a. */
export function habilesEntre(a, b) {
  if (a == null || b == null || b < a) return 0;
  const total = b - a + 1;
  const semanas = Math.floor(total / 7);
  let n = semanas * 5;
  for (let d = a + semanas * 7; d <= b; d++) if (esHabil(d)) n++;
  return n;
}

/** Desvío en días hábiles de `real` respecto de `plan` (positivo = atraso). */
export function desvioHabiles(plan, real) {
  if (plan == null || real == null || plan === real) return 0;
  return real > plan ? habilesEntre(plan + 1, real) : -habilesEntre(real + 1, plan);
}

export const duracionHabiles = (inicio, fin) => Math.max(1, habilesEntre(aDia(inicio), aDia(fin)));

/* ── Formatos ─────────────────────────────────────────────────────────── */

const DIAS_SEM = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
/** "2026-11-04" → "mié 04/11/26" (como la tabla de Project). */
export function fmtFechaCorta(iso, { semana = true } = {}) {
  if (!iso) return "—";
  const n = aDia(iso);
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${semana ? DIAS_SEM[new Date(n * DIA).getUTCDay()] + " " : ""}${d}/${m}/${y.slice(2)}`;
}
export const fmtDias = (n) => `${n} día${n === 1 ? "" : "s"}`;
export const fmtDesvio = (n) => (n > 0 ? `+${n} d` : n < 0 ? `−${-n} d` : "0 d");

/* ── Estados ──────────────────────────────────────────────────────────── */

// bloqueada: ya tendría que haber empezado pero tiene predecesoras sin terminar.
// en_espera: tiene predecesoras sin terminar y todavía no le toca empezar.
export const ESTADOS_TAREA = {
  completada: { label: "Completada", pill: "pill-green" },
  en_curso: { label: "En curso", pill: "pill-cream-gold" },
  lista: { label: "Lista para empezar", pill: "tw-pill-blue" },
  bloqueada: { label: "Bloqueada", pill: "pill-red" },
  en_espera: { label: "En espera", pill: "pill-dim2" },
};

export const FILTROS_ESTADO = [
  { id: "", label: "Todas las tareas" },
  { id: "atrasadas", label: "Atrasadas" },
  { id: "sin_justificar", label: "Atrasos sin justificar" },
  { id: "bloqueada", label: "Bloqueadas por predecesoras" },
  { id: "lista", label: "Listas para empezar" },
  { id: "en_curso", label: "En curso" },
  { id: "en_espera", label: "En espera de predecesoras" },
  { id: "completada", label: "Completadas" },
];

/**
 * Misma regla que la base (registrar_avance_toyota_well): hace falta justificar
 * si con los datos informados la tarea empezó o terminó después del plan, o si
 * a la fecha del avance ya debería haber empezado o terminado.
 */
export function requiereJustificacion(tarea, { inicio_real, fin_real, fecha }) {
  const f = fecha || null;
  const ini = inicio_real || f;
  const fin = fin_real || f;
  const tardeInicio = !!(tarea.inicio && ini && ini > tarea.inicio);
  const tardeFin = !!(tarea.fin && fin && fin > tarea.fin);
  return { requiere: tardeInicio || tardeFin, tardeInicio, tardeFin };
}

/* ── Cronograma ───────────────────────────────────────────────────────── */

const porFechaAvance = (a, b) => (a.fecha === b.fecha ? String(a.created_at).localeCompare(String(b.created_at)) : a.fecha < b.fecha ? -1 : 1);
const fechaLocal = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Arma el árbol y calcula todo lo derivado. `tareas` viene de la base (con
 * `avances`); `hoy` es una fecha ISO.
 */
export function calcularCronograma(tareas, hoy) {
  const H = aDia(hoy);
  const Hh = habil(H);
  const nodos = new Map();
  const ordenadas = [...tareas].sort((a, b) => a.orden - b.orden);
  ordenadas.forEach((t) => nodos.set(t.id, {
    ...t,
    avances: [...(t.avances || [])].sort(porFechaAvance),
    hijos: [], sucesoras: [],
  }));

  const raices = [];
  for (const n of nodos.values()) {
    const p = n.parent_id != null ? nodos.get(n.parent_id) : null;
    if (p) { p.hijos.push(n); n.padre = p; } else raices.push(n);
  }
  for (const n of nodos.values()) {
    n.preds = (n.predecesoras || []).map((id) => nodos.get(id)).filter(Boolean);
    n.preds.forEach((p) => p.sucesoras.push(n));
  }

  // Nivel, EDT, ruta y orden de recorrido (el de la tabla).
  const lista = [];
  const recorrer = (n, nivel, edt, ruta) => {
    n.nivel = nivel; n.edt = edt; n.ruta = ruta; n.esResumen = n.hijos.length > 0;
    lista.push(n);
    n.hijos.forEach((h, i) => recorrer(h, nivel + 1, `${edt}.${i + 1}`, [...ruta, n.nombre]));
  };
  raices.forEach((r, i) => recorrer(r, 1, String(i + 1), []));
  const hojas = lista.filter((n) => !n.esResumen);

  // Hojas de cada nodo (para expandir predecesoras que sean resúmenes).
  const hojasDe = (n) => (n.esResumen ? n.hijos.flatMap(hojasDe) : [n]);

  // ── Datos propios de cada hoja ──
  for (const n of hojas) {
    n.pI = aDia(n.inicio); n.pF = aDia(n.fin);
    n.dur = n.pI != null && n.pF != null ? Math.max(1, habilesEntre(n.pI, n.pF)) : 1;
    n.rI = aDia(n.inicio_real); n.rF = aDia(n.fin_real);
    n.completa = n.avance >= 100 && n.rF != null;
    n.empezada = n.rI != null || n.avance > 0;
  }

  // ── Proyección (pasada hacia adelante por la red de predecesoras) ──
  const visitando = new Set();
  const finEstimado = (n) => {
    if (n.esResumen) return Math.max(...hojasDe(n).map(finEstimado));
    if (n.eF !== undefined) return n.eF;
    if (visitando.has(n.id)) return n.pF ?? H; // ciclo: se ignora el vínculo
    visitando.add(n.id);
    if (n.completa) {
      n.eI = n.rI ?? n.pI; n.eF = n.rF;
    } else if (n.empezada) {
      const resta = Math.max(1, Math.ceil(n.dur * (1 - n.avance / 100)));
      n.eI = n.rI ?? n.pI ?? Hh;
      n.eF = Math.max(sumarHabiles(n.eI, n.dur - 1), sumarHabiles(Hh, resta - 1));
    } else {
      let ini = n.pI ?? Hh;
      for (const p of n.preds) {
        const f = finEstimado(p);
        if (f != null) ini = Math.max(ini, habil(f + 1));
      }
      n.eI = Math.max(habil(ini), Hh);
      n.eF = sumarHabiles(n.eI, n.dur - 1);
    }
    visitando.delete(n.id);
    return n.eF;
  };
  hojas.forEach(finEstimado);

  // ── Estado, atrasos y justificaciones de cada hoja ──
  for (const n of hojas) {
    const predsHojas = n.preds.flatMap(hojasDe);
    n.predsPendientes = predsHojas.filter((p) => !p.completa);
    n.estado = n.completa ? "completada"
      : n.empezada ? "en_curso"
      : !n.predsPendientes.length ? "lista"
      : n.pI != null && n.pI <= H ? "bloqueada" : "en_espera";

    // Atraso propio en días hábiles (mínimo 1 si pasó la fecha, aunque sea fin de semana).
    const atraso = (plan, real) => (plan == null ? 0 : (real ?? H) > plan ? Math.max(1, desvioHabiles(plan, real ?? H)) : 0);
    const atrasoInicio = atraso(n.pI, n.rI);
    const atrasoFin = atraso(n.pF, n.rF);
    n.atrasoInicio = atrasoInicio; n.atrasoFin = atrasoFin;
    n.atrasada = atrasoInicio > 0 || atrasoFin > 0;
    n.atrasadaAbierta = n.atrasada && !n.completa;
    n.desvio = n.pF != null ? desvioHabiles(n.pF, n.eF) : 0;

    // Cada incumplimiento (inicio y/o fin) necesita una justificación cargada después.
    const justificaciones = n.avances.filter((a) => a.justificacion);
    const justificadoDesde = (iso) => justificaciones.some((a) => fechaLocal(a.created_at) > iso || a.fecha > iso);
    n.sinJustificar = n.atrasada && (
      (atrasoInicio > 0 && !justificadoDesde(n.inicio)) || (atrasoFin > 0 && !justificadoDesde(n.fin))
    );
    n.ultimaJustificacion = justificaciones[justificaciones.length - 1] || null;
  }

  // ── Resúmenes (de abajo hacia arriba) ──
  const resumir = (n) => {
    if (!n.esResumen) return;
    n.hijos.forEach(resumir);
    const hs = hojasDe(n);
    const min = (k) => { const v = hs.map((h) => h[k]).filter((x) => x != null); return v.length ? Math.min(...v) : null; };
    const max = (k) => { const v = hs.map((h) => h[k]).filter((x) => x != null); return v.length ? Math.max(...v) : null; };
    n.pI = min("pI"); n.pF = max("pF");
    n.dur = n.pI != null ? Math.max(1, habilesEntre(n.pI, n.pF)) : 1;
    n.eI = min("eI"); n.eF = max("eF");
    n.rI = min("rI");
    n.completa = hs.every((h) => h.completa);
    n.rF = n.completa ? max("rF") : null;
    const peso = hs.reduce((s, h) => s + h.dur, 0);
    n.avanceCalc = peso ? hs.reduce((s, h) => s + h.dur * h.avance, 0) / peso : 0;
    n.desvio = n.pF != null ? desvioHabiles(n.pF, n.eF) : 0;
    n.nAtrasadas = hs.filter((h) => h.atrasadaAbierta).length;
    n.nSinJustificar = hs.filter((h) => h.sinJustificar).length;
  };
  raices.forEach(resumir);
  for (const n of hojas) n.avanceCalc = n.avance;
  for (const n of lista) {
    n.inicioPlan = aISO(n.pI); n.finPlan = aISO(n.pF);
    n.inicioEst = aISO(n.eI); n.finEst = aISO(n.eF);
    n.inicioReal = aISO(n.rI); n.finReal = aISO(n.rF);
  }

  return { nodos, raices, lista, hojas, hojasDe, hoy };
}

/** Todas las tareas incompletas de las que depende `n` (predecesoras de predecesoras…). */
export function cadenaPendiente(n, hojasDe) {
  const vistos = new Set();
  const out = [];
  const subir = (t) => {
    for (const p of t.preds.flatMap(hojasDe)) {
      if (vistos.has(p.id)) continue;
      vistos.add(p.id);
      if (!p.completa) { out.push(p); subir(p); }
    }
  };
  subir(n);
  return out.sort((a, b) => a.orden - b.orden);
}

/** Resumen general de un conjunto de hojas. */
export function indicadores(hojas, hoy) {
  const H = aDia(hoy);
  const peso = hojas.reduce((s, h) => s + h.dur, 0) || 1;
  const real = hojas.reduce((s, h) => s + h.dur * h.avance, 0) / peso;
  const plan = hojas.reduce((s, h) => s + h.dur * fraccion(h.pI, h.pF, H), 0) / peso * 100;
  const finPlan = Math.max(...hojas.map((h) => h.pF ?? -Infinity));
  const finEst = Math.max(...hojas.map((h) => h.eF ?? -Infinity));
  const cuenta = (f) => hojas.filter(f).length;
  return {
    real, plan,
    finPlan: Number.isFinite(finPlan) ? aISO(finPlan) : null,
    finEst: Number.isFinite(finEst) ? aISO(finEst) : null,
    desvioFin: Number.isFinite(finPlan) && Number.isFinite(finEst) ? desvioHabiles(finPlan, finEst) : 0,
    atrasadas: cuenta((h) => h.atrasadaAbierta),
    sinJustificar: cuenta((h) => h.sinJustificar),
    bloqueadas: cuenta((h) => h.estado === "bloqueada"),
    enEspera: cuenta((h) => h.estado === "en_espera"),
    listas: cuenta((h) => h.estado === "lista"),
    enCurso: cuenta((h) => h.estado === "en_curso"),
    completadas: cuenta((h) => h.estado === "completada"),
    total: hojas.length,
  };
}

/* ── Curvas de avance vs fecha ────────────────────────────────────────── */

/** Fracción (0–1) del intervalo hábil [a, b] transcurrida al día d (inclusive). */
function fraccion(a, b, d) {
  if (a == null || b == null || d < a) return 0;
  if (d >= b) return 1;
  return habilesEntre(a, d) / Math.max(1, habilesEntre(a, b));
}

/** Avance real de una hoja al día d, interpolando entre los avances registrados. */
function avanceAl(h, d) {
  const pts = [];
  if (h.rI != null) pts.push([h.rI - 1, 0]);
  for (const a of h.avances) {
    const x = aDia(a.fecha);
    if (pts.length && pts[pts.length - 1][0] === x) pts[pts.length - 1] = [x, a.avance];
    else pts.push([x, a.avance]);
  }
  if (!pts.length) return 0;
  pts.sort((p, q) => p[0] - q[0]);
  if (d < pts[0][0]) return 0;
  for (let i = pts.length - 1; i >= 0; i--) {
    if (pts[i][0] <= d) {
      const sig = pts[i + 1];
      if (!sig) return pts[i][1];
      return pts[i][1] + (sig[1] - pts[i][1]) * (d - pts[i][0]) / (sig[0] - pts[i][0]);
    }
  }
  return 0;
}

/**
 * Serie diaria (días hábiles) con el % planificado, el real hasta hoy y la
 * proyección desde hoy hasta el fin estimado, ponderados por duración.
 */
export function curvaAvance(hojas, hoy) {
  const conPlan = hojas.filter((h) => h.pI != null && h.pF != null);
  if (!conPlan.length) return [];
  const H = aDia(hoy);
  const desde = Math.min(...conPlan.map((h) => Math.min(h.pI, h.rI ?? h.pI)));
  const hasta = Math.max(...conPlan.map((h) => Math.max(h.pF, h.eF ?? h.pF)), H);
  const peso = conPlan.reduce((s, h) => s + h.dur, 0);
  const r1 = (x) => Math.round(x * 10) / 10;

  const avanceHoy = conPlan.reduce((s, h) => s + h.dur * h.avance, 0) / peso;
  const out = [];
  for (let d = desde; d <= hasta; d++) {
    if (!esHabil(d) && d !== H) continue;
    const plan = conPlan.reduce((s, h) => s + h.dur * fraccion(h.pI, h.pF, d), 0) / peso * 100;
    const fila = { fecha: aISO(d), plan: r1(plan) };
    if (d < H) fila.real = r1(conPlan.reduce((s, h) => s + h.dur * avanceAl(h, d), 0) / peso);
    if (d === H) { fila.real = r1(avanceHoy); fila.proy = r1(avanceHoy); }
    if (d > H) {
      fila.proy = r1(conPlan.reduce((s, h) => {
        if (h.completa) return s + h.dur * 100;
        if (h.empezada) return s + h.dur * (h.avance + (100 - h.avance) * fraccion(Math.max(H + 1, h.eI), h.eF, d));
        return s + h.dur * 100 * fraccion(h.eI, h.eF, d);
      }, 0) / peso);
    }
    out.push(fila);
  }
  return out;
}

/* ── Excel ────────────────────────────────────────────────────────────── */

const xlDate = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

export async function exportarCronogramaXlsx(crono, sector, hoy) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const hoja = (rows, widths) => {
    const ws = XLSX.utils.json_to_sheet(rows, { cellDates: true, dateNF: "dd/mm/yyyy" });
    ws["!cols"] = widths.map((wch) => ({ wch }));
    return ws;
  };

  XLSX.utils.book_append_sheet(wb, hoja(crono.lista.map((n) => ({
    "Id": n.orden,
    "EDT": n.edt,
    "Nombre de tarea": `${"   ".repeat(n.nivel - 1)}${n.nombre}`,
    "Duración (días)": n.dur,
    "Comienzo": xlDate(n.inicioPlan),
    "Fin": xlDate(n.finPlan),
    "Comienzo real": xlDate(n.inicioReal),
    "Fin real": xlDate(n.finReal),
    "Fin proyectado": xlDate(n.finEst),
    "% completado": Math.round(n.avanceCalc),
    "Predecesoras": n.preds.map((p) => p.orden).join(";"),
    "Estado": n.esResumen ? "" : ESTADOS_TAREA[n.estado].label,
    "Desvío fin (días hábiles)": n.desvio,
    "Atraso sin justificar": n.esResumen ? "" : n.sinJustificar ? "Sí" : "",
    "Última justificación": n.ultimaJustificacion?.justificacion || "",
    "Notas": n.notas || "",
  })), [5, 10, 40, 9, 11, 11, 11, 11, 11, 9, 14, 18, 11, 10, 50, 40]), "Cronograma");

  const historial = crono.hojas.flatMap((n) => n.avances.map((a) => ({
    "Id": n.orden,
    "Tarea": [...n.ruta.slice(1), n.nombre].join(" › "),
    "Fecha del avance": xlDate(a.fecha),
    "% completado": a.avance,
    "Comienzo real": xlDate(a.inicio_real),
    "Fin real": xlDate(a.fin_real),
    "Justificación del desvío": a.justificacion || "",
    "Registró": a.origen === "importacion" ? "Importado de Project" : a.autor?.nombre || "",
    "Registrado el": a.created_at ? new Date(a.created_at) : null,
  })));
  XLSX.utils.book_append_sheet(wb, hoja(historial, [5, 50, 12, 9, 12, 12, 60, 22, 16]), "Historial de avances");

  const slug = sector.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");
  XLSX.writeFile(wb, `cronograma_toyota_well_${slug}_${hoy}.xlsx`);
}
