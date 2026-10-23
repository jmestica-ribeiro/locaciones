import { Icon } from '../components.jsx';
import { useProjects } from '../context/ProjectsContext.jsx';

export function NovedadesView() {
  const { novedades } = useProjects();
  return (
    <div className="fade-in">
      <section className="card">
        <div className="card-head">
          <div className="ch-icon"><Icon name="clock" size={20} /></div>
          <div><h2>Últimas novedades</h2><div className="ch-sub">Avances recientes de todos los proyectos</div></div>
        </div>
        <div className="feed" style={{ maxHeight: "none" }}>
          {novedades.length === 0 && (
            <div style={{ padding: "24px", textAlign: "center", opacity: 0.45, fontSize: 13 }}>Sin novedades aún</div>
          )}
          {novedades.map((n) => (
            <div key={n.id} className={n.pending ? "feed-item feed-item-pending" : "feed-item"}>
              <div className="feed-date"><div className="d">{n.day}</div><div className="m">{n.month}</div></div>
              <div className="feed-body">
                <div className="fp">{n.project}</div>
                <div className="ft">{n.task}</div>
                <div className="fc">{n.time} hs · {n.cat}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <div className="feed-delta">{n.delta}</div>
                {n.pending && <span style={{ fontSize: 10, color: "var(--gold)", fontWeight: 600, letterSpacing: "0.04em" }}>PENDIENTE</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
