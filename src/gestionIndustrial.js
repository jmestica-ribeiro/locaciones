/* Menú "Gestión industrial": grupos (nivel 1) con secciones (nivel 2).
   Cada sección vive en /gestion-industrial/:grupo/:seccion. */
export const GESTION_INDUSTRIAL = [
  { id: "tps", label: "TPS", icon: "layers", items: [
    { id: "obiras", label: "Obiras" },
  ] },
  { id: "toyota-well", label: "Toyota Well", icon: "target", items: [
    { id: "locaciones", label: "Locaciones" },
    { id: "obras-publicas", label: "Obras Públicas" },
  ] },
];

export const giPath = (grupo, seccion) => `/gestion-industrial/${grupo}/${seccion}`;

/** id del grupo al que pertenece la ruta, o undefined. */
export const giGroupOf = (pathname) =>
  GESTION_INDUSTRIAL.find((g) => pathname.startsWith(`/gestion-industrial/${g.id}/`))?.id;
