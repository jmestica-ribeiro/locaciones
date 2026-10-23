import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components.jsx';

export function NotFoundView() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <div className="empty" style={{ paddingTop: 80 }}>
      <Icon name="alert" size={40} />
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 48, fontWeight: 700, color: "var(--ink-2)", lineHeight: 1 }}>404</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", margin: "12px 0 6px" }}>Página no encontrada</div>
      <div style={{ fontSize: 13, marginBottom: 24, wordBreak: "break-all" }}>
        La dirección <code>{pathname}</code> no existe o fue movida.
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>Volver</button>
        <button className="btn btn-gold" onClick={() => navigate("/proyectos", { replace: true })}>
          <Icon name="projects" size={17} />Ir a proyectos
        </button>
      </div>
    </div>
  );
}
