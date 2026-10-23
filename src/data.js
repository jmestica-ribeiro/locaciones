/* ============================================================
   Datos de ejemplo — basados en las capturas de RIBEIRO
   ============================================================ */
const C = {
  gold: "#e7b13a", gold2: "#f2c451", green: "#74c074", greenDeep: "#4f9a55",
  lime: "#cdd83f", blue: "#5b9fd4", red: "#e2493b", violet: "#a98bd6",
  sand: "#caa86a", teal: "#5fb6a8",
};

const rp69Etapas = [
  { id: "e1", tag: "CONSTRUCCIÓN", name: "Excavación para cajeo", done: 734.5, total: 4200, unit: "m³", color: C.gold },
  { id: "e2", tag: "CONSTRUCCIÓN", name: "Demolición y retiro de pavimento de carpeta asfáltica existente", done: 0, total: 520, unit: "m³", color: C.red },
  { id: "e3", tag: "CONSTRUCCIÓN", name: "Preparación de Subrasante", done: 3927.75, total: 11900, unit: "m²", color: C.gold },
  { id: "e4", tag: "CONSTRUCCIÓN", name: "Subbase granular de 0.20 m de espesor", done: 365.75, total: 1020, unit: "m³", color: C.lime },
  { id: "e5", tag: "CONSTRUCCIÓN", name: "Base granular de 0.15 m de espesor", done: 138.55, total: 760, unit: "m³", color: C.lime },
  { id: "e6", tag: "CONSTRUCCIÓN", name: "Imprimación bituminosa", done: 0, total: 9100, unit: "m²", color: C.blue },
  { id: "e7", tag: "CONSTRUCCIÓN", name: "Carpeta asfáltica en caliente e:5 cm", done: 0, total: 540, unit: "m³", color: C.violet },
  { id: "e8", tag: "SEÑALIZACIÓN", name: "Demarcación horizontal", done: 0, total: 3400, unit: "ml", color: C.teal },
];

const rp69Curve = [
  { d: "05 May", plan: 4, real: 3 },
  { d: "08 May", plan: 8, real: 6 },
  { d: "12 May", plan: 13, real: 10 },
  { d: "15 May", plan: 17, real: 14 },
  { d: "19 May", plan: 21, real: 18 },
  { d: "22 May", plan: 25, real: 22 },
  { d: "26 May", plan: 30, real: 25 },
  { d: "29 May", plan: 34, real: 27 },
];

const rp69Daily = [
  { d: "Lun 25", Excavación: 180, Subrasante: 620, Subbase: 80, Base: 0 },
  { d: "Mar 26", Excavación: 210, Subrasante: 540, Subbase: 95, Base: 30 },
  { d: "Mié 27", Excavación: 160, Subrasante: 710, Subbase: 110, Base: 42 },
  { d: "Jue 28", Excavación: 95, Subrasante: 480, Subbase: 60, Base: 38 },
  { d: "Vie 29", Excavación: 89.5, Subrasante: 577.75, Subbase: 20.75, Base: 28.55 },
];

const rp69Recursos = {
  maquinas: 5, personas: 1, materiales: 0,
  distrib: [
    { name: "Máquinas", value: 5, color: C.gold },
    { name: "Personal", value: 1, color: C.blue },
    { name: "Materiales", value: 0, color: C.teal },
  ],
  maquinasDetalle: [
    { name: "Retroexcavadora CAT 320", estado: "Operativa" },
    { name: "Motoniveladora 140K", estado: "Operativa" },
    { name: "Camión volcador (x2)", estado: "Operativa" },
    { name: "Rodillo vibratorio", estado: "Mantenimiento" },
  ],
};

export const projects = [
  {
    id: "rp69", code: "RP69", location: "V. Manzano", client: "Vialidad RN",
    status: "En curso", statusColor: C.gold, color: C.gold,
    etapasPlan: 27, etapasFin: 9, progress: 27,
    recursos: rp69Recursos, etapas: rp69Etapas, curve: rp69Curve, daily: rp69Daily,
    desc: "Repavimentación y obras complementarias",
  },
  {
    id: "anx", code: "ANx-102-103", location: "Chus", client: "Municipalidad",
    status: "En curso", statusColor: C.gold, color: C.lime,
    etapasPlan: 18, etapasFin: 11, progress: 58,
    recursos: { maquinas: 3, personas: 8, materiales: 4, distrib: [
      { name: "Máquinas", value: 3, color: C.gold },
      { name: "Personal", value: 8, color: C.blue },
      { name: "Materiales", value: 4, color: C.teal },
    ], maquinasDetalle: [] },
    etapas: [
      { id: "a1", tag: "CONSTRUCCIÓN", name: "Movimiento de suelos", done: 1200, total: 1500, unit: "m³", color: C.gold },
      { id: "a2", tag: "CONSTRUCCIÓN", name: "Hormigón armado — bases", done: 88, total: 120, unit: "m³", color: C.lime },
      { id: "a3", tag: "ESTRUCTURA", name: "Estructura metálica", done: 14, total: 40, unit: "tn", color: C.blue },
      { id: "a4", tag: "TERMINACIONES", name: "Mampostería", done: 320, total: 980, unit: "m²", color: C.violet },
    ],
    curve: [
      { d: "05 May", plan: 30, real: 28 }, { d: "12 May", plan: 40, real: 38 },
      { d: "19 May", plan: 50, real: 48 }, { d: "26 May", plan: 58, real: 55 },
      { d: "29 May", plan: 62, real: 58 },
    ],
    daily: [
      { d: "Lun 25", Excavación: 90, Subrasante: 0, Subbase: 0, Base: 0 },
      { d: "Mar 26", Excavación: 120, Subrasante: 0, Subbase: 0, Base: 0 },
      { d: "Mié 27", Excavación: 60, Subrasante: 0, Subbase: 0, Base: 0 },
      { d: "Jue 28", Excavación: 40, Subrasante: 0, Subbase: 0, Base: 0 },
      { d: "Vie 29", Excavación: 30, Subrasante: 0, Subbase: 0, Base: 0 },
    ],
    desc: "Obra de arquitectura institucional",
  },
  {
    id: "promeba", code: "PROMEBA-ACHA", location: "Gral Acha", client: "Provincia LP",
    status: "En curso", statusColor: C.green, color: C.green,
    etapasPlan: 34, etapasFin: 12, progress: 41,
    recursos: { maquinas: 7, personas: 14, materiales: 9, distrib: [
      { name: "Máquinas", value: 7, color: C.gold },
      { name: "Personal", value: 14, color: C.blue },
      { name: "Materiales", value: 9, color: C.teal },
    ], maquinasDetalle: [] },
    etapas: [
      { id: "p1", tag: "A.6.2 CALZADAS", name: "Base granular e:15 cm.", done: 612, total: 1400, unit: "m³", color: C.gold },
      { id: "p2", tag: "A.6.2 CALZADAS", name: "Subrasante", done: 4200, total: 9800, unit: "m²", color: C.gold },
      { id: "p3", tag: "A.5.1 CORDÓN CUNETA", name: "Cordón cuneta de Hormigón 0,75 m", done: 880, total: 2100, unit: "ml", color: C.lime },
      { id: "p4", tag: "A.5.2 BADENES", name: "Ejecución de badén de hormigón", done: 145, total: 360, unit: "m²", color: C.violet },
      { id: "p5", tag: "A.5.5 CÁMARAS", name: "Cámaras de inspección y sumideros", done: 6.25, total: 18, unit: "u", color: C.blue },
    ],
    curve: [
      { d: "05 May", plan: 22, real: 20 }, { d: "12 May", plan: 30, real: 28 },
      { d: "19 May", plan: 36, real: 34 }, { d: "26 May", plan: 42, real: 39 },
      { d: "29 May", plan: 45, real: 41 },
    ],
    daily: [
      { d: "Lun 25", Excavación: 0, Subrasante: 280, Subbase: 0, Base: 90 },
      { d: "Mar 26", Excavación: 0, Subrasante: 320, Subbase: 0, Base: 110 },
      { d: "Mié 27", Excavación: 0, Subrasante: 250, Subbase: 0, Base: 95 },
      { d: "Jue 28", Excavación: 0, Subrasante: 180, Subbase: 0, Base: 120 },
      { d: "Vie 29", Excavación: 0, Subrasante: 12, Subbase: 0, Base: 12 },
    ],
    desc: "Programa de Mejoramiento de Barrios",
  },
];

export const novedades = [
  { id: "n1", day: "29", month: "May", time: "12:00", project: "PROMEBA-ACHA", task: "Base granular e:15 cm. — A.6.2 Calzadas", cat: "Calzadas", delta: "+12 m³" },
  { id: "n2", day: "29", month: "May", time: "12:00", project: "PROMEBA-ACHA", task: "Ejecución de cámaras de inspección — A.5.5 Cámaras de inspección y sumideros", cat: "Cámaras", delta: "+0,25 u" },
  { id: "n3", day: "29", month: "May", time: "12:00", project: "PROMEBA-ACHA", task: "Subrasante — A.6.2 Calzadas", cat: "Calzadas", delta: "+12 m²" },
  { id: "n4", day: "29", month: "May", time: "11:30", project: "PROMEBA-ACHA", task: "Ejecución de badén de hormigón — A.5.2 Badenes", cat: "Badenes", delta: "+12 m²" },
  { id: "n5", day: "29", month: "May", time: "11:00", project: "PROMEBA-ACHA", task: "Ejecución de cordón cuneta de Hormigón de 0,75 m — A.5.1 Cordón cuneta", cat: "Cordón", delta: "+41,5 ml" },
  { id: "n6", day: "28", month: "May", time: "16:45", project: "RP69", task: "Preparación de Subrasante", cat: "Subrasante", delta: "+577,75 m²" },
  { id: "n7", day: "28", month: "May", time: "10:15", project: "RP69", task: "Excavación para cajeo", cat: "Excavación", delta: "+95 m³" },
  { id: "n8", day: "27", month: "May", time: "15:20", project: "ANx-102-103", task: "Movimiento de suelos", cat: "Suelos", delta: "+60 m³" },
];

export const historial = [
  { date: "29 May 2026", entries: [
    { name: "Preparación de Subrasante", meta: "Op. M. Sosa · Motoniveladora 140K", delta: "+577,75 m²" },
    { name: "Excavación para cajeo", meta: "Op. M. Sosa · Retroexcavadora CAT 320", delta: "+89,5 m³" },
    { name: "Base granular de 0.15 m", meta: "Op. M. Sosa", delta: "+28,55 m³" },
  ]},
  { date: "28 May 2026", entries: [
    { name: "Preparación de Subrasante", meta: "Op. M. Sosa · Motoniveladora 140K", delta: "+480 m²" },
    { name: "Excavación para cajeo", meta: "Op. M. Sosa · Retroexcavadora CAT 320", delta: "+95 m³" },
  ]},
  { date: "27 May 2026", entries: [
    { name: "Preparación de Subrasante", meta: "Op. M. Sosa", delta: "+710 m²" },
    { name: "Subbase granular 0.20 m", meta: "Op. M. Sosa", delta: "+110 m³" },
  ]},
];

export const RIBEIRO_DATA = { C, projects, novedades, historial };
