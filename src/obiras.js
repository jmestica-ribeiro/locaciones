// Obiras (Gestión industrial › TPS): opciones de los desplegables, formatos y
// exportación a Excel. Sector, unidad y estado también están validados en la
// base (check constraints): si se cambian acá, hay que migrar la base también.
// Los status de las acciones son texto libre en la base y se pueden editar acá.

export const SECTORES = ["Locaciones", "Obras Públicas"];
export const UNIDADES = ["Horas", "Días", "Meses"];
export const ESTADOS = ["Sin iniciar", "En gestión", "Finalizada"];
export const ESTADO_PILL = {
  "Sin iniciar": "pill-dim2",
  "En gestión": "pill-cream-gold",
  "Finalizada": "pill-green",
};

export const STATUS_ANORMALIDAD = ["Pendiente", "En curso", "Acción implementada"];
export const STATUS_DEFINITIVA = ["Pendiente", "En curso", "CM implementada", "CM implementada y estandarizada"];

// Solo para ordenar la columna Cantidad entre unidades distintas.
const HORAS_POR_UNIDAD = { Horas: 1, Días: 24, Meses: 720 };
export const cantidadEnHoras = (o) => Number(o.cantidad || 0) * (HORAS_POR_UNIDAD[o.unidad] || 1);

const SINGULAR = { Horas: "hora", Días: "día", Meses: "mes" };
const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/** 4 + "Días" → "4 días" · 1 + "Meses" → "1 mes" */
export function fmtCantidad(cantidad, unidad) {
  if (cantidad === null || cantidad === undefined || cantidad === "") return "—";
  const n = Number(cantidad);
  const u = unidad ? (n === 1 ? SINGULAR[unidad] : unidad.toLowerCase()) : "";
  return `${nf.format(n)} ${u}`.trim();
}

/** "2026-04-26" → "26/04/2026" */
export function fmtFecha(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const fmtTamano = (bytes) => {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${nf.format(bytes / 1024)} KB`;
  return `${nf.format(bytes / 1024 / 1024)} MB`;
};

/** Clase de pill para el status de una acción. */
export function statusPill(status) {
  if (!status) return "pill-dim2";
  if (/implementada/i.test(status)) return "pill-green";
  if (/curso/i.test(status)) return "pill-cream-gold";
  return "pill-dim2";
}

/** Minúsculas y sin acentos, para buscar. */
export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const porOrden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0);
export const porFecha = (a, b) => String(a.fecha || "").localeCompare(String(b.fecha || ""));

/* ── Excel ─────────────────────────────────────────────────────────────── */

// Fecha ISO → Date local, para que Excel la guarde como fecha real (filtrable).
const xlDate = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

function hoja(XLSX, rows, widths) {
  const ws = XLSX.utils.json_to_sheet(rows, { cellDates: true, dateNF: "dd/mm/yyyy" });
  ws["!cols"] = widths.map((wch) => ({ wch }));
  return ws;
}

/** Exporta las obiras (con repeticiones y acciones) a un .xlsx de 4 hojas. */
export async function exportarObirasXlsx(obiras) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, hoja(XLSX, obiras.map((o) => ({
    "ID": o.id,
    "Fecha de ocurrencia": xlDate(o.fecha_ocurrencia),
    "Sector": o.sector,
    "Ubicación": o.ubicacion,
    "Etapa constructiva": o.etapa_constructiva,
    "Título del problema": o.titulo,
    "Detalle": o.detalle || "",
    "Cantidad": Number(o.cantidad),
    "Unidad": o.unidad,
    "Estado general": o.estado,
    "Responsable": o.responsable || "",
    "Repeticiones": o.repeticiones?.length || 0,
    "Acción inmediata": o.accion_inmediata || "",
    "Causa raíz preliminar": o.causa_raiz || "",
  })), [6, 12, 15, 14, 20, 45, 45, 10, 9, 14, 22, 12, 40, 40]), "Obiras");

  const reps = obiras.flatMap((o) => [...(o.repeticiones || [])].sort(porFecha).map((r) => ({
    "ID obira": o.id,
    "Fecha de repetición": xlDate(r.fecha),
    "Cantidad": r.cantidad === null ? "" : Number(r.cantidad),
    "Ubicación": r.ubicacion || "",
    "Comentarios": r.comentarios || "",
  })));
  XLSX.utils.book_append_sheet(wb, hoja(XLSX, reps, [9, 12, 10, 14, 60]), "Repeticiones");

  const acciones = (tipo) => obiras.flatMap((o) =>
    (o.acciones || []).filter((a) => a.tipo === tipo).sort(porOrden).map((a) => ({ o, a })));

  XLSX.utils.book_append_sheet(wb, hoja(XLSX, acciones("anormalidad").map(({ o, a }) => ({
    "ID obira": o.id,
    "Acción para minimizar el impacto": a.descripcion,
    "Fecha de finalización": xlDate(a.fecha),
    "Responsable": a.responsable || "",
    "Status": a.status || "",
  })), [9, 60, 12, 22, 22]), "Gestión de anormalidades");

  XLSX.utils.book_append_sheet(wb, hoja(XLSX, accionesDefinitivasRows(acciones("definitiva")), [9, 40, 60, 14, 22, 30]), "Acciones definitivas");

  XLSX.writeFile(wb, `obiras_${hoyISO()}.xlsx`);
}

function accionesDefinitivasRows(items) {
  return items.map(({ o, a }) => ({
    "ID obira": o.id,
    "Título del problema": o.titulo,
    "Contramedida": a.descripcion,
    "Fecha de implementación": xlDate(a.fecha),
    "Responsable": a.responsable || "",
    "Status acción definitiva": a.status || "",
  }));
}

/** Exporta el listado de acciones definitivas ([{ o: obira, a: accion }]). */
export async function exportarAccionesDefinitivasXlsx(items) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hoja(XLSX, accionesDefinitivasRows(items), [9, 40, 60, 14, 22, 30]), "Acciones definitivas");
  XLSX.writeFile(wb, `acciones_definitivas_${hoyISO()}.xlsx`);
}
