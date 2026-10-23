// Importación masiva de etapas desde .xlsx y plantilla descargable.
// SheetJS se carga bajo demanda para no inflar el bundle principal.

export const UMS = ["m", "m²", "m³", "ml", "km", "u", "tn", "kg", "gl", "%", "mes"];

const COLS = [
  { key: "nombre_etapa", header: "Nombre de etapa", width: 42 },
  { key: "fase", header: "Fase", width: 22 },
  { key: "UM", header: "UM", width: 8 },
  { key: "total", header: "Cantidad total", width: 15 },
  { key: "incidencia", header: "Incidencia %", width: 13 },
];

// Alias aceptados en el encabezado (normalizados: minúsculas, sin acentos ni símbolos)
const HEADER_ALIASES = {
  nombre_etapa: ["nombredeetapa", "nombreetapa", "nombre", "etapa", "item"],
  fase: ["fase", "tag", "fasetag"],
  UM: ["um", "unidad", "unidaddemedida"],
  total: ["cantidadtotal", "cantidad", "total"],
  incidencia: ["incidencia", "incidenciaporc", "incidencia%"],
};

// Variantes de escritura habituales de las unidades
const UM_ALIASES = { m2: "m²", "m^2": "m²", m3: "m³", "m^3": "m³", un: "u", unidad: "u", gl: "gl", global: "gl", t: "tn", ton: "tn" };

const loadXlsx = () => import("xlsx");

const norm = (s) => String(s ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9%]/g, "");

export const nombreKey = (s) => String(s ?? "").trim().toLowerCase();

function parseNum(v) {
  if (v === null || v === undefined || v === "") return { value: null };
  if (typeof v === "number") return { value: v };
  let s = String(v).trim().replace(/%$/, "").trim();
  if (!s) return { value: null };
  // "1.234,5" → 1234.5 · "12,5" → 12.5 · "1234.5" → 1234.5
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? { value: n } : { error: true };
}

function parseUM(v) {
  const s = String(v ?? "").trim();
  if (!s) return { value: null };
  const exact = UMS.find((u) => u === s) || UMS.find((u) => u.toLowerCase() === s.toLowerCase());
  if (exact) return { value: exact };
  const alias = UM_ALIASES[s.toLowerCase().replace(/\s/g, "")];
  return alias ? { value: alias } : { error: true };
}

export async function descargarPlantillaEtapas(fases = []) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([COLS.map((c) => c.header)]);
  ws["!cols"] = COLS.map((c) => ({ wch: c.width }));
  XLSX.utils.book_append_sheet(wb, ws, "Etapas");

  const instrucciones = [
    ["Instrucciones para la importación de etapas"],
    [],
    ["Completá la hoja \"Etapas\" con una fila por etapa, sin modificar los encabezados."],
    [],
    ["Columna", "Obligatoria", "Descripción"],
    ["Nombre de etapa", "Sí", "Nombre único de la etapa dentro del proyecto. Si ya existe una etapa con ese nombre, se actualizan sus datos."],
    ["Fase", "No", "Tag de agrupación. Si no existe se crea automáticamente (en mayúsculas)."],
    ["UM", "No", `Unidad de medida. Valores válidos: ${UMS.join(", ")}`],
    ["Cantidad total", "No", "Cantidad total planificada en la UM indicada. Número ≥ 0."],
    ["Incidencia %", "No", "Peso de la etapa sobre el avance del proyecto (0 a 100). Entre todas las etapas deben sumar 100."],
    [],
    ["Ejemplo"],
    COLS.map((c) => c.header),
    ["Excavación para cajeo", "MOVIMIENTO DE SUELO", "m³", 12500, 15],
    ["Carpeta asfáltica e=5cm", "PAVIMENTO", "m²", 28000, 35.5],
  ];
  const wsI = XLSX.utils.aoa_to_sheet(instrucciones);
  wsI["!cols"] = [{ wch: 26 }, { wch: 22 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsI, "Instrucciones");

  const listas = [["UM válidas", "Fases existentes"]];
  const n = Math.max(UMS.length, fases.length);
  for (let i = 0; i < n; i++) listas.push([UMS[i] ?? "", fases[i]?.nombre ?? ""]);
  const wsL = XLSX.utils.aoa_to_sheet(listas);
  wsL["!cols"] = [{ wch: 14 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsL, "Listas");

  XLSX.writeFile(wb, "plantilla_etapas.xlsx");
}

// Lee el archivo y devuelve { filas, error }. Cada fila trae los datos
// normalizados y sus `errores` (bloquean) y `avisos` (informativos).
// `existentes` son las etapas actuales del proyecto: si el nombre coincide,
// la fila se marca como actualización (`ID` de la etapa existente).
export async function parseEtapasXlsx(file, { existentes = [], fases = [] } = {}) {
  const XLSX = await loadXlsx();
  let wb;
  try {
    wb = XLSX.read(await file.arrayBuffer());
  } catch {
    return { error: "No se pudo leer el archivo. Verificá que sea un .xlsx válido." };
  }
  const sheetName = wb.SheetNames.find((n) => norm(n) === "etapas") || wb.SheetNames[0];
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: "" });

  const headerIdx = aoa.findIndex((r) => r.some((c) => HEADER_ALIASES.nombre_etapa.includes(norm(c))));
  if (headerIdx < 0) return { error: `No se encontró la columna "Nombre de etapa" en la hoja "${sheetName}".` };

  const colIdx = {};
  aoa[headerIdx].forEach((c, i) => {
    const h = norm(c);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (colIdx[key] === undefined && aliases.includes(h)) { colIdx[key] = i; break; }
    }
  });

  const porNombre = new Map(existentes.map((e) => [nombreKey(e.nombre_etapa), e]));
  const fasesSet = new Set(fases.map((f) => f.nombre.toUpperCase()));
  const vistos = new Map();
  const filas = [];

  aoa.slice(headerIdx + 1).forEach((r, i) => {
    const get = (k) => (colIdx[k] === undefined ? "" : r[colIdx[k]]);
    if (COLS.every((c) => String(get(c.key) ?? "").trim() === "")) return; // fila vacía

    const errores = [];
    const avisos = [];
    const nombre = String(get("nombre_etapa") ?? "").trim();
    const fase = String(get("fase") ?? "").trim().toUpperCase();
    const um = parseUM(get("UM"));
    const total = parseNum(get("total"));
    const incid = parseNum(get("incidencia"));

    if (!nombre) errores.push("Falta el nombre");
    const k = nombreKey(nombre);
    if (nombre && vistos.has(k)) errores.push(`Nombre repetido (fila ${vistos.get(k)})`);
    const fila = headerIdx + i + 2;
    if (nombre && !vistos.has(k)) vistos.set(k, fila);

    if (um.error) errores.push(`UM "${get("UM")}" no válida`);
    if (total.error) errores.push("Cantidad no numérica");
    else if (total.value !== null && total.value < 0) errores.push("Cantidad negativa");
    if (incid.error) errores.push("Incidencia no numérica");
    else if (incid.value !== null && (incid.value < 0 || incid.value > 100)) errores.push("Incidencia fuera de 0–100");
    if (fase && !fasesSet.has(fase)) avisos.push("Fase nueva");

    const existente = porNombre.get(k);
    filas.push({
      fila,
      ID: existente?.ID || null,
      nombre_etapa: nombre,
      fase,
      UM: um.value ?? null,
      total: total.value ?? null,
      incidencia: incid.value ?? null,
      errores,
      avisos,
    });
  });

  if (!filas.length) return { error: "El archivo no tiene etapas cargadas." };
  return { filas };
}
