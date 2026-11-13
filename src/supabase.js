import { createClient } from "@supabase/supabase-js";
import { resolverCurvas } from "./curvas.js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Fotos de partes ────────────────────────────────────────────────────────
// El bucket "partes-fotos" es privado: guardamos el path de storage en la
// columna `url` y generamos signed URLs de corta duración al leer, en vez de
// exponer URLs públicas permanentes.
const FOTO_URL_TTL = 60 * 60; // 1 hora, alcanza para revisar/exportar un parte

export async function uploadFoto(file, idParte, idProyecto) {
  const ext = file.name.split(".").pop();
  const path = `${idProyecto}/${idParte}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("partes-fotos").upload(path, file);
  if (upErr) throw upErr;
  const { data, error } = await supabase.from("FotosPartes")
    .insert({ ID_Parte: idParte, ID_Proyecto: idProyecto, url: path, nombre: file.name })
    .select();
  if (error) throw error;
  return data[0];
}

async function withSignedUrls(fotos) {
  if (!fotos?.length) return fotos;
  const { data, error } = await supabase.storage
    .from("partes-fotos")
    .createSignedUrls(fotos.map((f) => f.url), FOTO_URL_TTL);
  if (error) throw error;
  return fotos.map((f, i) => ({ ...f, url: data[i]?.signedUrl || null }));
}

export async function getFotosByParte(idParte) {
  const { data, error } = await supabase.from("FotosPartes")
    .select("*").eq("ID_Parte", idParte).order("orden");
  if (error) throw error;
  return withSignedUrls(data);
}

export async function getFotosByProyecto(idProyecto) {
  const { data, error } = await supabase.from("FotosPartes")
    .select("*").eq("ID_Proyecto", idProyecto).order("created_at", { ascending: false });
  if (error) throw error;
  return withSignedUrls(data);
}

export async function deleteFoto(id, url) {
  const path = decodeURIComponent(url.split("/partes-fotos/")[1]?.split("?")[0] || "");
  if (path) await supabase.storage.from("partes-fotos").remove([path]);
  const { error } = await supabase.from("FotosPartes").delete().eq("id", id);
  if (error) throw error;
}

// ── Auth ───────────────────────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, patch) {
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Proyectos ──────────────────────────────────────────────────────────────
export async function getProyectos() {
  const { data, error } = await supabase.from("Proyectos").select("*");
  if (error) throw error;
  return data;
}

export async function upsertProyecto(proyecto) {
  const { data, error } = await supabase
    .from("Proyectos")
    .upsert(proyecto, { onConflict: "ID_Proyecto" })
    .select();
  if (error) throw error;
  return data[0];
}

// ── Etapas ─────────────────────────────────────────────────────────────────
export async function getEtapasByProyecto(idProyecto) {
  const { data, error } = await supabase
    .from("Etapas")
    .select("*")
    .eq("ID_Proyecto", idProyecto);
  if (error) throw error;
  return data;
}

export async function upsertEtapas(etapas) {
  const { data, error } = await supabase
    .from("Etapas")
    .upsert(etapas)
    .select();
  if (error) throw error;
  return data;
}

export async function deleteEtapa(id) {
  const { error } = await supabase.from("Etapas").delete().eq("ID", id);
  if (error) throw error;
}

// ── Insumos planificados por etapa ─────────────────────────────────────────
export async function getInsumosByEtapa(idEtapa) {
  const { data, error } = await supabase
    .from("InsumosPlanificados")
    .select("*")
    .eq("ID_Etapa", idEtapa)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function upsertInsumo(insumo) {
  const { data, error } = await supabase
    .from("InsumosPlanificados")
    .upsert(insumo)
    .select();
  if (error) throw error;
  return data[0];
}

export async function deleteInsumo(id) {
  const { error } = await supabase.from("InsumosPlanificados").delete().eq("id", id);
  if (error) throw error;
}

// ── Avance (partes) ────────────────────────────────────────────────────────
export async function getAvanceByProyecto(idProyecto) {
  const { data, error } = await supabase
    .from("Avance")
    .select("*, Recursos(*)")
    .eq("ID_Proyecto", idProyecto)
    .order("fecha_avance", { ascending: false });
  if (error) throw error;
  return data;
}

export async function insertAvance(avance) {
  const { data, error } = await supabase
    .from("Avance")
    .insert(avance)
    .select();
  if (error) throw error;
  return data[0];
}

export async function updateEstadoRevision(idAvance, estado) {
  const { error } = await supabase
    .from("Avance")
    .update({ estado_revision: estado })
    .eq("id", idAvance);
  if (error) throw error;
}

export async function updateAvance(id, patch) {
  const { data, error } = await supabase
    .from("Avance")
    .update(patch)
    .eq("id", id)
    .select();
  if (error) throw error;
  return data[0];
}

export async function deleteAvance(id) {
  const { error } = await supabase.from("Avance").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteRecursosByAvance(idAvance) {
  const { error } = await supabase.from("Recursos").delete().eq("ID_Avance", idAvance);
  if (error) throw error;
}

// ── Recursos ───────────────────────────────────────────────────────────────
export async function insertRecursos(recursos) {
  if (!recursos?.length) return [];
  const { data, error } = await supabase
    .from("Recursos")
    .insert(recursos)
    .select();
  if (error) throw error;
  return data;
}

export async function getRecursosByAvance(idAvance) {
  const { data, error } = await supabase
    .from("Recursos")
    .select("*")
    .eq("ID_Avance", idAvance);
  if (error) throw error;
  return data;
}

// ── Fases ──────────────────────────────────────────────────────────────────
export async function getFases() {
  const { data, error } = await supabase.from("Fases").select("*").order("nombre");
  if (error) throw error;
  return data;
}

export async function insertFase(nombre) {
  const { data, error } = await supabase.from("Fases").insert({ nombre }).select();
  if (error) throw error;
  return data[0];
}

// ── Curvas planificadas ────────────────────────────────────────────────────
// Las curvas en modo "item" vuelven con PuntosCurva ya calculados a partir
// de PuntosCurvaItem y las etapas (total + incidencia) del proyecto.
export async function getCurvasByProyecto(idProyecto) {
  const [curvas, etapas] = await Promise.all([
    supabase
      .from("CurvasPlan")
      .select("*, PuntosCurva(*), PuntosCurvaItem(*)")
      .eq("ID_Proyecto", idProyecto)
      .order("created_at"),
    getEtapasByProyecto(idProyecto),
  ]);
  if (curvas.error) throw curvas.error;
  return resolverCurvas(curvas.data, etapas);
}

export async function insertCurva(idProyecto, nombre, modo = "porcentaje") {
  const { data, error } = await supabase
    .from("CurvasPlan")
    .insert({ ID_Proyecto: idProyecto, nombre, modo })
    .select();
  if (error) throw error;
  return data[0];
}

export async function updateCurva(id, nombre) {
  const { error } = await supabase.from("CurvasPlan").update({ nombre }).eq("id", id);
  if (error) throw error;
}

export async function deleteCurva(id) {
  const { error } = await supabase.from("CurvasPlan").delete().eq("id", id);
  if (error) throw error;
}

export async function insertPunto(idCurva, fecha, avance) {
  const { data, error } = await supabase
    .from("PuntosCurva")
    .insert({ ID_Curva: idCurva, fecha, avance })
    .select();
  if (error) throw error;
  return data[0];
}

export async function updatePunto(id, fecha, avance) {
  const { data, error } = await supabase
    .from("PuntosCurva")
    .update({ fecha, avance })
    .eq("id", id)
    .select();
  if (error) throw error;
  return data[0];
}

export async function deletePunto(id) {
  const { error } = await supabase.from("PuntosCurva").delete().eq("id", id);
  if (error) throw error;
}

// Puntos por ítem: cantidad acumulada planificada de una etapa a una fecha.
export async function insertPuntoItem(idCurva, idEtapa, fecha, cantidad) {
  const { data, error } = await supabase
    .from("PuntosCurvaItem")
    .insert({ ID_Curva: idCurva, ID_Etapa: idEtapa, fecha, cantidad })
    .select();
  if (error) throw error;
  return data[0];
}

export async function updatePuntoItem(id, fecha, cantidad) {
  const { data, error } = await supabase
    .from("PuntosCurvaItem")
    .update({ fecha, cantidad })
    .eq("id", id)
    .select();
  if (error) throw error;
  return data[0];
}

export async function deletePuntoItem(id) {
  const { error } = await supabase.from("PuntosCurvaItem").delete().eq("id", id);
  if (error) throw error;
}

// ── Notificaciones ─────────────────────────────────────────────────────────
export async function getNotificaciones(userId) {
  const { data, error } = await supabase
    .from("Notificaciones")
    .select("*")
    .eq("destinatario_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data;
}

export async function marcarNotificacionLeida(id) {
  const { error } = await supabase.from("Notificaciones").update({ leida: true }).eq("id", id);
  if (error) throw error;
}

export async function marcarTodasNotificacionesLeidas(userId) {
  const { error } = await supabase
    .from("Notificaciones")
    .update({ leida: true })
    .eq("destinatario_id", userId)
    .eq("leida", false);
  if (error) throw error;
}

// ── Configuración de destinatarios de notificaciones (admin) ───────────────
export async function getUsuariosNotificables() {
  const { data, error } = await supabase.rpc("get_usuarios_notificables");
  if (error) throw error;
  return data;
}

export async function getNotificacionesConfig() {
  const { data, error } = await supabase.from("NotificacionesConfig").select("tipo, destinatario_id");
  if (error) throw error;
  return data;
}

export async function addNotificacionConfig(tipo, destinatarioId) {
  const { error } = await supabase.from("NotificacionesConfig").insert({ tipo, destinatario_id: destinatarioId });
  if (error) throw error;
}

export async function removeNotificacionConfig(tipo, destinatarioId) {
  const { error } = await supabase
    .from("NotificacionesConfig")
    .delete()
    .eq("tipo", tipo)
    .eq("destinatario_id", destinatarioId);
  if (error) throw error;
}

// ── Clasificación de motivos de NPT (gestionable / no gestionable) ─────────
export async function getMotivosNPT() {
  const { data, error } = await supabase.from("MotivosNPT").select("nombre, clasificacion");
  if (error) throw error;
  return data;
}

export async function setMotivoNPT(nombre, clasificacion) {
  const { error } = await supabase
    .from("MotivosNPT")
    .upsert({ nombre, clasificacion }, { onConflict: "nombre" });
  if (error) throw error;
}

// ── Personal ───────────────────────────────────────────────────────────────
export async function getPersonal() {
  const { data, error } = await supabase
    .from("ListadoPersonal")
    .select("*")
    .order("apellido");
  if (error) throw error;
  return data;
}

export async function upsertPersonal(persona) {
  const { data, error } = await supabase
    .from("ListadoPersonal")
    .upsert(persona)
    .select();
  if (error) throw error;
  return data[0];
}

export async function deletePersonal(id) {
  const { error } = await supabase.from("ListadoPersonal").delete().eq("id", id);
  if (error) throw error;
}

// ── Vehículos ──────────────────────────────────────────────────────────────
export async function getVehiculos() {
  const { data, error } = await supabase
    .from("ListadoVehiculos")
    .select("*")
    .order("interno");
  if (error) throw error;
  return data;
}

export async function upsertVehiculo(vehiculo) {
  const { data, error } = await supabase
    .from("ListadoVehiculos")
    .upsert(vehiculo)
    .select();
  if (error) throw error;
  return data[0];
}

export async function deleteVehiculo(id) {
  const { error } = await supabase.from("ListadoVehiculos").delete().eq("id", id);
  if (error) throw error;
}

// ── Obiras (Gestión industrial › TPS) ──────────────────────────────────────
// Ver supabase/migrations/20261113134146_obiras.sql. El bucket es privado: se
// guarda el path y se generan signed URLs al descargar.
const OBIRAS_BUCKET = "obiras-archivos";

/** Todas las obiras con sus repeticiones y acciones embebidas. */
export async function getObiras() {
  const { data, error } = await supabase
    .from("Obiras")
    .select("*, repeticiones:ObirasRepeticiones(*), acciones:ObirasAcciones(*)")
    .order("id", { ascending: true });
  if (error) throw error;
  return data;
}

/** Crea (obira.id vacío) o actualiza una obira con sus listas, en una sola transacción. Devuelve el id. */
export async function guardarObira(obira, repeticiones, acciones) {
  const { data, error } = await supabase.rpc("guardar_obira", {
    p_obira: obira,
    p_repeticiones: repeticiones,
    p_acciones: acciones,
  });
  if (error) throw error;
  return data;
}

/** Solo admins (lo exige RLS). Borra la obira, sus listas (cascade) y sus archivos. */
export async function deleteObira(id) {
  const { data: archivos } = await supabase.from("ObirasArchivos").select("path").eq("obira_id", id);
  const { data, error } = await supabase.from("Obiras").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("No tenés permiso para eliminar obiras");
  if (archivos?.length) await supabase.storage.from(OBIRAS_BUCKET).remove(archivos.map((a) => a.path));
}

export async function getArchivosObira(obiraId) {
  const { data, error } = await supabase
    .from("ObirasArchivos")
    .select("*")
    .eq("obira_id", obiraId)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function uploadArchivoObira(obiraId, file) {
  // Storage no acepta cualquier caracter en la key: se normaliza el nombre
  // para la ruta y se guarda el original para mostrar/descargar.
  const safe = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.-]+/g, "_");
  const path = `${obiraId}/${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage.from(OBIRAS_BUCKET).upload(path, file);
  if (upErr) throw upErr;
  const { data, error } = await supabase
    .from("ObirasArchivos")
    .insert({ obira_id: obiraId, path, nombre: file.name, tamano: file.size })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(OBIRAS_BUCKET).remove([path]);
    throw error;
  }
  return data;
}

export async function deleteArchivoObira(archivo) {
  const { error } = await supabase.from("ObirasArchivos").delete().eq("id", archivo.id);
  if (error) throw error;
  await supabase.storage.from(OBIRAS_BUCKET).remove([archivo.path]);
}

/** URL firmada de corta duración que fuerza la descarga con el nombre original. */
export async function getArchivoObiraUrl(archivo) {
  const { data, error } = await supabase.storage
    .from(OBIRAS_BUCKET)
    .createSignedUrl(archivo.path, 60, { download: archivo.nombre });
  if (error) throw error;
  return data.signedUrl;
}

export async function getUbicacionesObiras() {
  const { data, error } = await supabase.from("ObirasUbicaciones").select("*").order("nombre");
  if (error) throw error;
  return data;
}

export async function addUbicacionObira(nombre) {
  const { data, error } = await supabase.from("ObirasUbicaciones").insert({ nombre }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteUbicacionObira(id) {
  const { error } = await supabase.from("ObirasUbicaciones").delete().eq("id", id);
  if (error) throw error;
}

/** Nombres para sugerir como responsable: usuarios de la app + listado de personal. */
export async function getResponsablesSugeridos() {
  const [perfiles, personal] = await Promise.all([
    supabase.from("profiles").select("nombre"),
    supabase.from("ListadoPersonal").select("nombre, apellido"),
  ]);
  const nombres = new Set();
  perfiles.data?.forEach((p) => p.nombre?.trim() && nombres.add(p.nombre.trim()));
  personal.data?.forEach((p) => {
    const n = [p.nombre, p.apellido].filter(Boolean).join(" ").trim();
    if (n) nombres.add(n);
  });
  return [...nombres];
}
