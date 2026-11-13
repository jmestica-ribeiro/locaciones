import React, { useState } from 'react';
import { Routes, Route, Navigate, useMatch, useNavigate } from 'react-router-dom';
import { Sidebar, Topbar, Toast, SyncPrompt } from './components.jsx';
import { GESTION_INDUSTRIAL } from './gestionIndustrial.js';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor } from './tweaks-panel.jsx';
import { ProjectsProvider, useProjects } from './context/ProjectsContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { useNotifications } from './hooks/useNotifications.js';

import { LoginView } from './views/LoginView.jsx';
import { ProjectsHome } from './views/Dashboard.jsx';
import { ProjectDetail } from './views/ProjectDetail.jsx';
import { EtapaDetail } from './views/EtapaDetail.jsx';
import { ControlBoard } from './views/ControlBoard.jsx';
import { RecursosView } from './views/RecursosView.jsx';
import { ConfigProyecto } from './views/ConfigProyecto.jsx';
import { HistorialView } from './views/HistorialView.jsx';
import { NovedadesView } from './views/NovedadesView.jsx';
import { AdminConfigView } from './views/AdminConfigView.jsx';
import { NotFoundView } from './views/NotFoundView.jsx';
import { GestionIndustrialView } from './views/GestionIndustrialView.jsx';

const TWEAK_DEFAULTS = {
  accent: ["#e7b13a", "#f2c451", "#b8852a"],
};

const load = (k, d) => { try { const v = localStorage.getItem("rib_" + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem("rib_" + k, JSON.stringify(v)); } catch {} };

/* ── Guard de ruta ────────────────────────────────────────────── */
function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)" }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" style={{ animation: "spin 0.7s linear infinite" }}>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 4v4h-4" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 20v-4h4" />
      </svg>
    </div>
  );
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

/* ── App principal autenticada ────────────────────────────────── */
function Layout() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [compact, setCompact] = useState(() => load("compact", window.innerWidth < 1024));
  const { projects, outbox, toast, setToast, syncOutbox, isOnline, lastSync, syncPrompt, setSyncPrompt } = useProjects();
  const { session, profile, isAdmin } = useAuth();
  const notif = useNotifications(session?.user?.id);
  const navigate = useNavigate();

  React.useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--gold", t.accent[0]);
    r.setProperty("--gold-2", t.accent[1]);
    r.setProperty("--gold-deep", t.accent[2]);
  }, [t.accent]);

  React.useEffect(() => { save("compact", compact); }, [compact]);

  const mProyectos = useMatch("/proyectos");
  const mNovedades = useMatch("/novedades");
  const mRecursos  = useMatch("/recursos");
  const mAdminConfig = useMatch("/configuracion");
  const mProject   = useMatch("/proyectos/:pid");
  const mTablero   = useMatch("/proyectos/:pid/tablero");
  const mConfig    = useMatch("/proyectos/:pid/config");
  const mHistorial = useMatch("/proyectos/:pid/historial");
  const mEtapa     = useMatch("/proyectos/:pid/etapas/:eid");
  const mGestion   = useMatch("/gestion-industrial/:grupo/:seccion");

  const pid = (mProject || mTablero || mConfig || mHistorial || mEtapa)?.params?.pid;
  const eid = mEtapa?.params?.eid;
  const project = projects.find((p) => p.id === pid) || null;
  const etapa   = project?.etapas?.find((e) => e.id === eid) || null;
  const giGrupo   = GESTION_INDUSTRIAL.find((g) => g.id === mGestion?.params?.grupo) || null;
  const giSeccion = giGrupo?.items.find((s) => s.id === mGestion?.params?.seccion) || null;

  const projMeta = project ? [
    { icon: "pin",  label: "Ubicación", value: project.location },
    { icon: "user", label: "Cliente",   value: project.client   },
    { dot: project.statusColor, label: "Estado", value: project.status, accent: "var(--gold-deep)" },
  ] : [];

  let title = "Proyectos", crumbs = null, meta = null;
  if (mProyectos) { title = "Proyectos"; }
  else if (mNovedades) { title = "Novedades"; crumbs = [{ label: "Proyectos", to: "/proyectos" }, { label: "Novedades" }]; }
  else if (mRecursos) { title = "Recursos"; crumbs = [{ label: "Proyectos", to: "/proyectos" }, { label: "Recursos" }]; }
  else if (giGrupo && giSeccion) { title = giSeccion.label; crumbs = [{ label: "Gestión industrial" }, { label: giGrupo.label }, { label: giSeccion.label }]; }
  else if (mAdminConfig) { title = "Configuración"; crumbs = [{ label: "Proyectos", to: "/proyectos" }, { label: "Configuración" }]; }
  else if (mProject && project) { title = project.code; crumbs = [{ label: "Proyectos", to: "/proyectos" }, { label: project.code }]; meta = projMeta; }
  else if (mTablero && project) { title = "Tablero de control"; crumbs = [{ label: "Proyectos", to: "/proyectos" }, { label: project.code, to: `/proyectos/${pid}` }, { label: "Tablero" }]; meta = projMeta; }
  else if (mConfig && project) { title = "Configuración"; crumbs = [{ label: "Proyectos", to: "/proyectos" }, { label: project.code, to: `/proyectos/${pid}` }, { label: "Configuración" }]; meta = projMeta; }
  else if (mHistorial && project) { title = "Historial de partes"; crumbs = [{ label: "Proyectos", to: "/proyectos" }, { label: project.code, to: `/proyectos/${pid}` }, { label: "Historial" }]; meta = projMeta; }
  else if (mEtapa && project && etapa) { title = etapa.name; crumbs = [{ label: "Proyectos", to: "/proyectos" }, { label: project.code, to: `/proyectos/${pid}` }, { label: etapa.name }]; meta = projMeta; }
  else if (!(mProject || mTablero || mConfig || mHistorial || mEtapa)) { title = "Página no encontrada"; crumbs = [{ label: "Proyectos", to: "/proyectos" }, { label: "404" }]; }

  return (
    <div className="app">
      <Sidebar compact={compact} outbox={outbox} isOnline={isOnline} lastSync={lastSync} isAdmin={isAdmin} onToggle={() => setCompact((c) => !c)} />
      <div className="main">
        <Topbar
          title={title} crumbs={crumbs} meta={meta} outbox={outbox} onOutbox={syncOutbox}
          isOnline={isOnline} profile={profile} projects={projects} notif={notif}
          onSignOut={async () => { await import('./supabase.js').then(m => m.signOut()); }}
        />
        <div className="view-scroll">
          <Routes>
            <Route index element={<Navigate to="/proyectos" replace />} />
            <Route path="/proyectos" element={<ProjectsHome />} />
            <Route path="/novedades" element={<NovedadesView />} />
            <Route path="/configuracion" element={
              isAdmin ? <AdminConfigView /> : <Navigate to="/proyectos" replace />
            } />
            <Route path="/proyectos/:pid" element={<ProjectDetail />} />
            <Route path="/proyectos/:pid/tablero" element={<ControlBoard />} />
            <Route path="/proyectos/:pid/config" element={
              isAdmin ? <ConfigProyecto /> : <Navigate to={`/proyectos/${pid}`} replace />
            } />
            <Route path="/proyectos/:pid/historial" element={<HistorialView />} />
            <Route path="/proyectos/:pid/etapas/:eid" element={<EtapaDetail />} />
            <Route path="/recursos" element={<RecursosView />} />
            <Route path="/gestion-industrial/:grupo/:seccion" element={<GestionIndustrialView />} />
            <Route path="*" element={<NotFoundView />} />
          </Routes>
        </div>
      </div>

      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      {syncPrompt && (
        <SyncPrompt
          outbox={outbox}
          onSync={async () => { setSyncPrompt(false); await syncOutbox(); }}
          onDismiss={() => setSyncPrompt(false)}
        />
      )}

      <TweaksPanel>
        <TweakSection label="Barra lateral" />
        <TweakRadio label="Modo" value={compact ? "Compacta" : "Expandida"}
          options={["Expandida", "Compacta"]} onChange={(v) => setCompact(v === "Compacta")} />
        <TweakSection label="Estilo visual" />
        <TweakColor label="Color de acento" value={t.accent}
          options={[["#e7b13a", "#f2c451", "#b8852a"], ["#bcc73a", "#cdd83f", "#8f9a25"], ["#5fae62", "#74c074", "#3f7e45"], ["#4f93cc", "#5b9fd4", "#356a9c"]]}
          onChange={(v) => setTweak("accent", v)} />
      </TweaksPanel>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProjectsProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute />} />
          <Route path="/*" element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          } />
        </Routes>
      </ProjectsProvider>
    </AuthProvider>
  );
}

function PublicRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/proyectos" replace />;
  return <LoginView />;
}
