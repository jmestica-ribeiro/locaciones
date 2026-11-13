import { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components.jsx';
import {
  getUsuariosNotificables, getNotificacionesConfig,
  addNotificacionConfig, removeNotificacionConfig,
  getUbicacionesObiras, addUbicacionObira, deleteUbicacionObira,
} from '../supabase.js';

/* Ubicaciones que se sugieren al cargar una obira (Gestión industrial › TPS › Obiras). */
function UbicacionesObirasCard() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getUbicacionesObiras()
      .then((d) => setLista(d || []))
      .catch((e) => setError(e.message || "No se pudieron cargar las ubicaciones"))
      .finally(() => setLoading(false));
  }, []);

  const agregar = async (e) => {
    e.preventDefault();
    const n = nombre.trim();
    if (!n) return;
    if (lista.some((u) => u.nombre.toLowerCase() === n.toLowerCase())) { setError(`"${n}" ya está en la lista`); return; }
    setSaving(true);
    setError(null);
    try {
      const nueva = await addUbicacionObira(n);
      setLista((prev) => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
      setNombre("");
    } catch (err) {
      setError(err.message || "No se pudo agregar la ubicación");
    } finally {
      setSaving(false);
    }
  };

  const quitar = async (u) => {
    setError(null);
    setLista((prev) => prev.filter((x) => x.id !== u.id));
    try { await deleteUbicacionObira(u.id); }
    catch (err) {
      setError(err.message || "No se pudo quitar la ubicación");
      setLista((prev) => [...prev, u].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
    }
  };

  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div className="card-head">
        <div className="ch-icon"><Icon name="pin" size={20} /></div>
        <div>
          <h2>Ubicaciones de obiras</h2>
          <div className="ch-sub">Se sugieren al completar la ubicación de una obira; igual se puede escribir otra</div>
        </div>
      </div>
      <div style={{ padding: "0 24px 22px" }}>
        <form onSubmit={agregar} style={{ display: "flex", gap: 10, maxWidth: 420, marginBottom: 14 }}>
          <input className="input" placeholder="Ej: LAJE48" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ padding: "8px 12px" }} />
          <button className="btn btn-gold btn-sm" type="submit" disabled={saving || !nombre.trim()}>
            <Icon name="plus" size={14} /> Agregar
          </button>
        </form>
        {error && <div style={{ color: "var(--red)", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
        {loading ? (
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Cargando…</div>
        ) : lista.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Todavía no hay ubicaciones cargadas.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {lista.map((u) => (
              <span key={u.id} className="pill pill-dim" style={{ fontSize: 12, padding: "4px 6px 4px 10px" }}>
                {u.nombre}
                <button onClick={() => quitar(u)} title={`Quitar ${u.nombre}`} aria-label={`Quitar ${u.nombre}`}
                  style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 2, display: "grid", placeItems: "center" }}>
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

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
          <h2 className="home-h2">Configuración</h2>
          <p className="home-sub">Notificaciones de la app y listados de Gestión industrial</p>
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

      <UbicacionesObirasCard />
    </div>
  );
}
