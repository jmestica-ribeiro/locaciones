import { useParams } from 'react-router-dom';
import { Icon } from '../components.jsx';
import { GESTION_INDUSTRIAL } from '../gestionIndustrial.js';
import { NotFoundView } from './NotFoundView.jsx';
import { ObirasView } from './ObirasView.jsx';
import { CronogramaToyotaWellView } from './CronogramaToyotaWellView.jsx';

// Vistas ya desarrolladas, por "grupo/seccion". El resto muestra "en construcción".
const VISTAS = {
  "tps/obiras": { Vista: ObirasView },
  "toyota-well/locaciones": { Vista: CronogramaToyotaWellView, props: { sector: "Locaciones" } },
  "toyota-well/obras-publicas": { Vista: CronogramaToyotaWellView, props: { sector: "Obras Públicas" } },
};

export function GestionIndustrialView() {
  const { grupo, seccion } = useParams();
  const g = GESTION_INDUSTRIAL.find((x) => x.id === grupo);
  const s = g?.items.find((x) => x.id === seccion);
  if (!g || !s) return <NotFoundView />;

  const clave = `${g.id}/${s.id}`;
  const entrada = VISTAS[clave];
  // key: al pasar de una sección a otra con la misma vista, se arranca de cero.
  if (entrada) return <entrada.Vista key={clave} {...entrada.props} />;

  return (
    <div className="empty" style={{ paddingTop: 80 }}>
      <Icon name={g.icon} size={40} />
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", margin: "12px 0 6px" }}>
        {g.label} · {s.label}
      </div>
      <div style={{ fontSize: 13 }}>Esta sección está en construcción.</div>
    </div>
  );
}
