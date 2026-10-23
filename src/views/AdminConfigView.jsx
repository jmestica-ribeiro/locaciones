import { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components.jsx';
import {
  getUsuariosNotificables, getNotificacionesConfig,
  addNotificacionConfig, removeNotificacionConfig,
} from '../supabase.js';

const TIPOS = [
  { id: 'parte_cargado', label: 'Parte cargado', hint: 'Se avisa cuando se carga un parte diario nuevo' },
  { id: 'npt', label: 'Tiempo no productivo', hint: 'Se avisa cuando un parte registra horas de NPT' },
];

export function AdminConfigView() {
  const [usuarios, setUsuarios] = useState([]);
  const [config, setConfig] = useState([]); // [{ tipo, destinatario_id }]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null); // `${tipo}:${userId}` en vuelo

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, c] = await Promise.all([getUsuariosNotificables(), getNotificacionesConfig()]);
      setUsuarios(u || []);
      setConfig(c || []);
    } catch (e) {
      setError(e.message || 'No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isChecked = (tipo, userId) => config.some((c) => c.tipo === tipo && c.destinatario_id === userId);

  const toggle = async (tipo, userId) => {
    const key = `${tipo}:${userId}`;
    const checked = isChecked(tipo, userId);
    setPending(key);
    setConfig((prev) => checked
      ? prev.filter((c) => !(c.tipo === tipo && c.destinatario_id === userId))
      : [...prev, { tipo, destinatario_id: userId }]);
    try {
      if (checked) await removeNotificacionConfig(tipo, userId);
      else await addNotificacionConfig(tipo, userId);
    } catch (e) {
      setError(e.message || 'No se pudo guardar el cambio');
      load();
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="fade-in">
      <div className="home-head" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="home-h2">Configuración · Notificaciones</h2>
          <p className="home-sub">Elegí qué usuarios reciben cada tipo de aviso (in-app y por correo)</p>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div className="ch-icon"><Icon name="inbox" size={20} /></div>
          <div>
            <h2>Destinatarios</h2>
            <div className="ch-sub">Los tildes activan la notificación in-app y el correo por Resend para ese usuario</div>
          </div>
        </div>

        {error && (
          <div style={{ margin: "0 24px 4px", padding: "10px 14px", borderRadius: "var(--r-sm)", background: "rgba(226,73,59,0.1)", border: "1px solid rgba(226,73,59,0.3)", color: "var(--red)", fontSize: 13 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "40px 24px", textAlign: "center", opacity: 0.5 }}>
            <Icon name="refresh" size={28} style={{ animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1.5px solid var(--line-cream)" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--on-cream-2)" }}>Usuario</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--on-cream-2)" }}>Rol</th>
                  {TIPOS.map((t) => (
                    <th key={t.id} style={{ padding: "10px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--on-cream-2)" }} title={t.hint}>
                      {t.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 && (
                  <tr>
                    <td colSpan={2 + TIPOS.length} style={{ padding: "40px 24px", textAlign: "center", opacity: 0.45 }}>
                      No hay usuarios para mostrar.
                    </td>
                  </tr>
                )}
                {usuarios.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--line-cream)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{u.nombre || "Sin nombre"}</div>
                      <div style={{ fontSize: 12, color: "var(--on-cream-2)" }}>{u.email}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={u.rol === "admin" ? "pill pill-gold" : "pill pill-dim"}>{u.rol}</span>
                    </td>
                    {TIPOS.map((t) => {
                      const key = `${t.id}:${u.id}`;
                      return (
                        <td key={t.id} style={{ padding: "12px 16px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={isChecked(t.id, u.id)}
                            disabled={pending === key}
                            onChange={() => toggle(t.id, u.id)}
                            style={{ width: 18, height: 18, cursor: pending === key ? "wait" : "pointer" }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
