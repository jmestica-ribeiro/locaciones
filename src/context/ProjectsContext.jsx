import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getProyectos, getEtapasByProyecto, getAvanceByProyecto, upsertProyecto, insertAvance, insertRecursos, uploadFoto } from '../supabase.js';
import { cacheGet, cacheSet, outboxAdd, outboxGetAll, outboxDelete, outboxCount } from '../db.js';
import { useAuth } from './AuthContext.jsx';

const Ctx = createContext(null);

const PALETTE = ["#e7b13a", "#cdd83f", "#74c074", "#5b9fd4", "#a98bd6", "#5fb6a8", "#e2493b", "#caa86a"];
const STATUS_COLOR = { "En curso": "#e7b13a", "Finalizado": "#74c074", "Pausado": "#e2493b" };

const load = (k, d) => { try { const v = localStorage.getItem("rib_" + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem("rib_" + k, JSON.stringify(v)); } catch {} };

const fmtD = (s) => {
  try {
    const d = new Date(s + "T00:00:00");
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch { return s; }
};

// ── Serialización de fotos para IndexedDB ──────────────────────────────────
// File objects no son serializables; los convertimos a ArrayBuffer + metadata.
async function serializeFotos(fotos) {
  if (!fotos?.length) return [];
  return Promise.all(fotos.map(async (foto) => {
    if (!foto.file) return { ...foto };
    const buffer = await foto.file.arrayBuffer();
    return { ...foto, file: null, _fileBuffer: buffer, _fileName: foto.file.name, _fileType: foto.file.type };
  }));
}

function deserializeFotos(fotos) {
  if (!fotos?.length) return [];
  return fotos.map((foto) => {
    if (!foto._fileBuffer) return { ...foto };
    const file = new File([foto._fileBuffer], foto._fileName, { type: foto._fileType });
    const { _fileBuffer, _fileName, _fileType, ...rest } = foto;
    return { ...rest, file };
  });
}

// Aporte de un avance a la curva real, con tope en el 100% del ítem: se lleva
// el acumulado por etapa y solo cuenta la parte que queda dentro del total.
export function cappedContrib(acumEtapa, a, etDB) {
  const total = Number(etDB.total);
  const prev = acumEtapa[a.nombre_etapa] || 0;
  const next = prev + (Number(a.total_avance) || 0);
  acumEtapa[a.nombre_etapa] = next;
  const dentro = Math.min(Math.max(next, 0), total) - Math.min(Math.max(prev, 0), total);
  return dentro / total * (Number(etDB.incidencia) || 0);
}

async function mapProyecto(p, colorIndex, cachedEtapas, cachedAvance) {
  let etapasDB, avancesDB;

  if (cachedEtapas && cachedAvance) {
    etapasDB = cachedEtapas;
    avancesDB = cachedAvance;
  } else {
    [etapasDB, avancesDB] = await Promise.all([
      getEtapasByProyecto(p.ID_Proyecto),
      getAvanceByProyecto(p.ID_Proyecto),
    ]);
    await cacheSet(`etapas_${p.ID_Proyecto}`, etapasDB);
    await cacheSet(`avance_${p.ID_Proyecto}`, avancesDB);
  }

  const color = PALETTE[colorIndex % PALETTE.length];

  const seenAvances = new Set();
  const avancesDedups = (avancesDB || []).filter((a) => {
    if (seenAvances.has(a.id)) return false;
    seenAvances.add(a.id);
    return true;
  });

  const etapas = (etapasDB || []).map((e, j) => {
    const done = avancesDedups
      .filter((a) => a.nombre_etapa === e.nombre_etapa)
      .reduce((s, a) => s + (Number(a.total_avance) || 0), 0);
    return {
      id: e.ID,
      tag: e.fase || "",
      name: e.nombre_etapa || "",
      done,
      total: Number(e.total) || 0,
      unit: e.UM || "",
      color: PALETTE[(colorIndex + j + 1) % PALETTE.length],
    };
  });
  const progress = Math.round(
    etapas.reduce((s, e, j) => {
      if (!e.total) return s;
      // Tope 100% por ítem: lo ejecutado de más no suma al avance global
      const pct = Math.min(e.done / e.total, 1);
      return s + pct * (Number(etapasDB[j].incidencia) || 0);
    }, 0)
  );

  const sortedAvances = [...avancesDedups].sort(
    (a, b) => new Date(a.fecha_avance || a.created_at) - new Date(b.fecha_avance || b.created_at)
  );
  const byDateCurve = {};
  const acumEtapa = {};
  sortedAvances.forEach((a) => {
    const date = a.fecha_avance || a.created_at?.slice(0, 10);
    if (!date) return;
    const etDB = (etapasDB || []).find((e) => e.nombre_etapa === a.nombre_etapa);
    if (!etDB || !Number(etDB.total)) return;
    byDateCurve[date] = (byDateCurve[date] || 0) + cappedContrib(acumEtapa, a, etDB);
  });
  const curveEntries = Object.entries(byDateCurve).sort((a, b) => a[0].localeCompare(b[0]));
  let acc = 0;
  const curve = curveEntries.map(([d, v]) => {
    acc += v;
    return { d: fmtD(d), iso: d, real: Math.round(Math.min(acc, 100)) };
  });

  const byDateDaily = {};
  sortedAvances.forEach((a) => {
    const date = a.fecha_avance || a.created_at?.slice(0, 10);
    if (!date) return;
    if (!a.nombre_etapa) return; // filas "solo NPT" no aportan avance
    const key = a.fase || a.nombre_etapa || "Sin fase";
    if (!byDateDaily[date]) byDateDaily[date] = { d: fmtD(date) };
    byDateDaily[date][key] = (byDateDaily[date][key] || 0) + (Number(a.total_avance) || 0);
  });
  const daily = Object.values(byDateDaily).slice(-10);

  const velocity = curveEntries.map(([d, v]) => ({ d: fmtD(d), Velocidad: Math.round(v * 10) / 10 }));

  const nptGrouped = {};
  (avancesDB || []).filter((a) => a.motivo_npt).forEach((a) => {
    const k = a.motivo_npt;
    if (!nptGrouped[k]) nptGrouped[k] = { horas: 0, ocurrencias: 0 };
    nptGrouped[k].horas += Number(a.tiempo_npt) || 1;
    nptGrouped[k].ocurrencias += 1;
  });
  const npt = Object.entries(nptGrouped)
    .map(([motivo, { horas, ocurrencias }]) => ({ motivo, horas, ocurrencias }))
    .sort((a, b) => b.horas - a.horas);

  const diasActivos = curveEntries.length;
  const avgDailyPct = diasActivos > 0 ? acc / diasActivos : 0;
  const diasRestantes = avgDailyPct > 0 ? Math.ceil((100 - Math.min(acc, 100)) / avgDailyPct) : null;

  const allRecursos = avancesDedups.flatMap((a) => a.Recursos || []);
  const uniqueVehiculos = new Set(allRecursos.filter((r) => r.tipo_recurso === "vehiculo").map((r) => r.detalle_recurso));
  const uniquePersonal  = new Set(allRecursos.filter((r) => r.tipo_recurso === "personal").map((r) => r.detalle_recurso));
  const recGrouped = { vehiculo: uniqueVehiculos.size, personal: uniquePersonal.size };
  const REC_COLORS = { vehiculo: "#e7b13a", personal: "#5b9fd4", material: "#74c074", Otro: "#a98bd6" };
  const distrib = Object.entries(recGrouped)
    .filter(([, v]) => v > 0)
    .map(([name, value], i) => ({ name, value, color: REC_COLORS[name] || PALETTE[i % PALETTE.length] }));
  const rankMap = {};
  allRecursos.forEach((r) => {
    const key = r.detalle_recurso || "Sin nombre";
    if (!rankMap[key]) rankMap[key] = { nombre: key, horas: 0, tipo: r.tipo_recurso || "Otro" };
    rankMap[key].horas += Number(r.total_hs) || 0;
  });
  const recursosRanking = Object.values(rankMap).filter((r) => r.horas > 0).sort((a, b) => b.horas - a.horas).slice(0, 10);

  return {
    id: p.ID_Proyecto,
    code: p.ID_Proyecto,
    location: p.Ubicación || "",
    client: p.Cliente || "",
    status: p.Estado || "En curso",
    statusColor: STATUS_COLOR[p.Estado] || "#e7b13a",
    color,
    desc: p.Descripción || "",
    etapas,
    etapasPlan: etapas.length,
    etapasFin: etapas.filter((e) => e.total > 0 && e.done >= e.total).length,
    progress,
    recursos: { maquinas: recGrouped["vehiculo"] || 0, personas: recGrouped["personal"] || 0, materiales: recGrouped["material"] || 0, distrib, recursosRanking, maquinasDetalle: [] },
    curve,
    daily,
    velocity,
    npt,
    diasRestantes,
    avgDailyPct: Math.round(avgDailyPct * 10) / 10,
  };
}

function genUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function ProjectsProvider({ children }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [projects, setProjects]    = useState([]);
  const [novedades, setNovedades]  = useState([]);
  const [diasConCarga, setDiasConCarga] = useState(new Set());
  const [partes, setPartes]        = useState([]);
  const [dbLoaded, setDbLoaded]    = useState(false);
  const [outbox, setOutbox]        = useState(0);
  const [toast, setToast]          = useState(null);
  const [isOnline, setIsOnline]    = useState(navigator.onLine);
  const [lastSync, setLastSync]    = useState(() => load("lastSync", null));
  const [syncPrompt, setSyncPrompt] = useState(false);

  // Ref siempre actualizado — evita closures stale en refreshProject y syncOutbox
  const projectsRef = useRef(projects);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  // Ref para showToast y _persistParte (evita deps en syncOutbox)
  const showToastRef   = useRef(null);
  const persistParteRef = useRef(null);

  const showToast = useCallback((msg) => setToast(msg), []);
  showToastRef.current = showToast;

  // ── Fetch completo (reutilizable para refetch al reconectar) ───────────────
  const fetchAll = useCallback(async (fromCache = false) => {
    try {
      let proyectos;
      try {
        if (fromCache) throw new Error('force-cache');
        proyectos = await getProyectos();
        await cacheSet('proyectos', proyectos);
      } catch {
        proyectos = await cacheGet('proyectos');
        if (proyectos?.length && fromCache) showToast("Sin conexión — mostrando datos guardados");
      }

      if (!proyectos?.length) { setDbLoaded(true); return; }

      const mapped = await Promise.all(proyectos.map(async (p, i) => {
        try {
          if (fromCache) throw new Error('force-cache');
          return await mapProyecto(p, i);
        } catch {
          const [etapasDB, avancesDB] = await Promise.all([
            cacheGet(`etapas_${p.ID_Proyecto}`),
            cacheGet(`avance_${p.ID_Proyecto}`),
          ]);
          return await mapProyecto(p, i, etapasDB, avancesDB);
        }
      }));
      setProjects(mapped);

      const allAvancesFull = (
        await Promise.all(proyectos.map(async (p) => (await cacheGet(`avance_${p.ID_Proyecto}`)) || []))
      ).flat();

      setDiasConCarga(new Set(
        allAvancesFull.map((a) => a.fecha_avance || a.created_at?.slice(0, 10)).filter(Boolean)
      ));

      const allAvances = [...allAvancesFull]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 20);

      const novs = allAvances.map((a) => {
        const dt = new Date(a.fecha_avance || a.created_at);
        const ct = new Date(a.created_at);
        return {
          id: a.id,
          day: String(dt.getDate()).padStart(2, "0"),
          month: dt.toLocaleString("es-AR", { month: "short" }),
          time: `${String(ct.getHours()).padStart(2, "0")}:${String(ct.getMinutes()).padStart(2, "0")}`,
          project: a.ID_Proyecto,
          task: a.nombre_etapa ? `${a.nombre_etapa}${a.fase ? " — " + a.fase : ""}` : `NPT — ${a.motivo_npt || ""}`,
          cat: a.fase || a.nombre_etapa || (a.motivo_npt ? "NPT" : ""),
          delta: a.nombre_etapa ? `+${a.total_avance ?? ""} ${a.UM || ""}`.trim() : `${a.tiempo_npt || 0} hs`,
        };
      });
      if (novs.length) setNovedades(novs);
      if (!fromCache) {
        const ts = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
        setLastSync(ts);
        save("lastSync", ts);
      }
      setDbLoaded(true);
    } catch (err) {
      console.error("Fetch error:", err);
      setDbLoaded(true);
    }
  }, [showToast]);

  // Carga inicial — espera a tener sesión: sin ella la consulta sale como anon,
  // RLS devuelve [] sin error y nunca se volvía a pedir tras el login.
  useEffect(() => {
    if (!userId) return;
    fetchAll(!navigator.onLine);
  }, [userId]);

  // Load outbox count on mount
  useEffect(() => {
    outboxCount().then(setOutbox).catch(() => {});
  }, []);

  // Track online/offline — al reconectar: refetch + sync outbox
  useEffect(() => {
    let prevOnline = navigator.onLine;

    const handleOnline = async () => {
      setIsOnline(true);
      // Solo actuar si veníamos de offline
      if (!prevOnline) {
        prevOnline = true;
        await fetchAll(false);
        const count = await outboxCount();
        if (count > 0) {
          setSyncPrompt(true);
        } else {
          showToast("Conexión restaurada — datos actualizados");
        }
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      prevOnline = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchAll]);

  // ── refreshProject — usa ref para no leer projects stale ──────────────────
  const refreshProject = useCallback(async (id) => {
    const current = projectsRef.current;
    const idx = current.findIndex((p) => p.id === id);
    const updated = await mapProyecto({ ID_Proyecto: id }, idx >= 0 ? idx : current.length);
    setProjects((prev) => prev.map((p) => p.id === id ? updated : p));
  }, []);

  const createProject = async (form) => {
    const saved = await upsertProyecto(form);
    const i = projectsRef.current.length;
    const nuevo = {
      id: saved.ID_Proyecto, code: saved.ID_Proyecto,
      location: saved.Ubicación || "", client: saved.Cliente || "",
      status: saved.Estado || "En curso",
      statusColor: STATUS_COLOR[saved.Estado] || "#e7b13a",
      color: PALETTE[i % PALETTE.length],
      desc: saved.Descripción || "",
      etapas: [], etapasPlan: 0, etapasFin: 0, progress: 0,
      recursos: { maquinas: 0, personas: 0, materiales: 0, distrib: [], recursosRanking: [], maquinasDetalle: [] },
      curve: [], daily: [],
    };
    setProjects((prev) => [...prev, nuevo]);
    showToast(`Proyecto ${saved.ID_Proyecto} creado`);
    return nuevo;
  };

  // ── _persistParte — sube un parte a Supabase (online o al sincronizar) ────
  const _persistParte = useCallback(async (parte, projectId) => {
    const idParte = genUUID();
    for (const av of parte.avances) {
      const row = await insertAvance({
        ID_Proyecto: projectId,
        ID_Parte: idParte,
        fecha_avance: parte.fecha,
        nombre_etapa: av.etapaName,
        fase: av.fase,
        total_avance: av.valor,
        UM: av.unit,
        descripcion: av.desc || null,
        motivo_npt: av.npt?.motivo || null,
        tiempo_npt: av.npt?.horas ? Number(av.npt.horas) : null,
        detalle_npt: av.npt?.detalle || null,
        estado_revision: "SIN REVISAR",
        observaciones_parte: parte.obs || null,
      });
      if (av.recursosDetalle?.length) {
        await insertRecursos(av.recursosDetalle.map((r) => ({
          ID_Avance: row.id,
          tipo_recurso: r.tipo,
          detalle_recurso: r.nombre,
          total_hs: r.horas ? Number(r.horas) : null,
          ID_RecursoFuente: r.id || null,
          puesto: r.puesto || null,
          familia: r.familia || null,
          subfamilia: r.subfamilia || null,
        })));
      }
    }
    // Fotos: admite tanto File objects como fotos serializadas desde IndexedDB
    const fotos = deserializeFotos(parte.fotos || []);
    for (const foto of fotos) {
      if (foto.file) await uploadFoto(foto.file, idParte, projectId);
    }
    await refreshProject(projectId);
  }, [refreshProject]);

  // ── saveParte — entry point público ──────────────────────────────────────
  const saveParte = async (parte, projectId) => {
    // Optimistic local update
    setProjects((prev) => prev.map((p) => {
      if (p.id !== projectId) return p;
      const etapas = p.etapas.map((e) => {
        const sum = parte.avances.filter((a) => a.etapaId === e.id).reduce((s, a) => s + a.valor, 0);
        return sum ? { ...e, done: e.done + sum } : e;
      });
      return { ...p, etapas };
    }));
    setPartes((prev) => [{ id: "p" + Date.now(), projectId, ...parte }, ...prev]);

    if (!navigator.onLine) {
      // Serializar fotos (File → ArrayBuffer) antes de guardar en IndexedDB
      const parteSerializado = { ...parte, fotos: await serializeFotos(parte.fotos) };
      await outboxAdd({ type: 'saveParte', parte: parteSerializado, projectId });
      const count = await outboxCount();
      setOutbox(count);

      // Agregar al feed de novedades con marca "pendiente"
      const ahora = new Date();
      parte.avances.forEach((av) => {
        setNovedades((prev) => [{
          id: `offline-${Date.now()}-${Math.random()}`,
          day: String(ahora.getDate()).padStart(2, "0"),
          month: ahora.toLocaleString("es-AR", { month: "short" }),
          time: `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`,
          project: projectId,
          task: av.etapaName ? `${av.etapaName}${av.fase ? " — " + av.fase : ""}` : `NPT — ${av.npt?.motivo || ""}`,
          cat: av.fase || av.etapaName || "NPT",
          delta: av.etapaName ? `+${av.valor ?? ""} ${av.unit || ""}`.trim() : `${av.npt?.horas || 0} hs`,
          pending: true,
        }, ...prev].slice(0, 20));
      });

      showToast(`Sin conexión — parte guardado localmente (${count} pendiente${count !== 1 ? 's' : ''})`);
      return;
    }

    try {
      await _persistParte(parte, projectId);
      showToast(`Parte del ${parte.fecha} guardado · ${parte.avances.length} avance(s)`);
    } catch (err) {
      console.error("Error guardando parte:", err);
      showToast("Error al guardar el parte en la base de datos");
    }
  };

  // ── syncOutbox — estable, sin deps de projects (usa ref) ─────────────────
  const syncOutbox = useCallback(async () => {
    const items = await outboxGetAll();
    if (!items.length) return;

    showToast(`Sincronizando ${items.length} parte(s) pendiente(s)…`);

    for (const item of items) {
      try {
        if (item.type === 'saveParte') {
          await _persistParte(item.parte, item.projectId);
        }
        await outboxDelete(item.id);
      } catch (err) {
        console.error("Error sincronizando parte:", err);
      }
    }

    const count = await outboxCount();
    setOutbox(count);
    showToast(count === 0
      ? "Sincronización completa — todos los partes enviados"
      : `Sincronización parcial — ${count} parte(s) pendiente(s)`
    );
  }, [_persistParte, showToast]);

  // Exponemos syncOutbox en ref para que el listener de 'online' lo use sin dep circular
  useEffect(() => { persistParteRef.current = { syncOutbox }; }, [syncOutbox]);

  return (
    <Ctx.Provider value={{
      projects, novedades, diasConCarga, partes, dbLoaded,
      outbox, setOutbox, syncOutbox,
      isOnline, lastSync,
      syncPrompt, setSyncPrompt,
      refreshProject, createProject, saveParte,
      toast, setToast, showToast,
      PALETTE, STATUS_COLOR,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useProjects = () => useContext(Ctx);
