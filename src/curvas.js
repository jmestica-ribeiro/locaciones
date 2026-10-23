/* ── Curvas planificadas por ítem ──────────────────────────────────
   Una curva en modo "item" guarda, por ítem (Etapa) y fecha, la cantidad
   ACUMULADA planificada a esa fecha. El % de la curva se calcula igual que
   el avance real: Σ min(acum / total, 1) × incidencia.

   Entre dos puntos de un mismo ítem se interpola linealmente por días;
   antes del primer punto el ítem aporta 0 y después del último se mantiene. */

const DAY = 86400000;
const toT = (iso) => new Date(iso + "T00:00:00").getTime();

export function cantidadALaFecha(puntosItem, iso) {
  if (!puntosItem.length) return 0;
  const t = toT(iso);
  if (t < toT(puntosItem[0].fecha)) return 0;
  for (let i = puntosItem.length - 1; i >= 0; i--) {
    const p = puntosItem[i];
    const tp = toT(p.fecha);
    if (t === tp) return Number(p.cantidad);
    if (t > tp) {
      const next = puntosItem[i + 1];
      if (!next) return Number(p.cantidad);
      const span = (toT(next.fecha) - tp) / DAY;
      const frac = span > 0 ? ((t - tp) / DAY) / span : 1;
      return Number(p.cantidad) + (Number(next.cantidad) - Number(p.cantidad)) * frac;
    }
  }
  return 0;
}

// Devuelve los puntos { fecha, avance } derivados de los puntos por ítem.
export function puntosDesdeItems(puntosItem, etapas) {
  const porEtapa = {};
  (puntosItem || []).forEach((p) => { (porEtapa[p.ID_Etapa] ||= []).push(p); });
  Object.values(porEtapa).forEach((arr) => arr.sort((a, b) => a.fecha.localeCompare(b.fecha)));

  const fechas = Array.from(new Set((puntosItem || []).map((p) => p.fecha))).sort();
  return fechas.map((fecha) => {
    const avance = (etapas || []).reduce((s, e) => {
      const total = Number(e.total) || 0;
      const pts = porEtapa[e.ID];
      if (!total || !pts) return s;
      return s + Math.min(cantidadALaFecha(pts, fecha) / total, 1) * (Number(e.incidencia) || 0);
    }, 0);
    return { id: `${fecha}`, fecha, avance: Math.round(avance * 100) / 100 };
  });
}

// Normaliza curvas: las de modo "item" pasan a tener PuntosCurva derivados,
// así el resto de la app (gráficos, tablero) las consume igual que las de %.
export function resolverCurvas(curvas, etapas) {
  return (curvas || []).map((c) => c.modo === "item"
    ? { ...c, PuntosCurva: puntosDesdeItems(c.PuntosCurvaItem, etapas) }
    : c);
}
