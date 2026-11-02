import React, { useState } from 'react';
import { Icon } from '../components.jsx';
import { signIn } from '../supabase.js';

export function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      // AuthContext detecta el cambio y redirige automáticamente
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos.'
          : err.message || 'Error al iniciar sesión.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        {/* Logo / marca */}
        <div className="login-brand">
          <div className="login-logo">
            <img src="/assets/ribeiro-logo.png" alt="RIBEIRO" width={40} height={40}
              style={{ objectFit: "contain" }} />
          </div>
          <div>
            <div className="login-brand-name">RIBEIRO</div>
            <div className="login-brand-sub">Locaciones</div>
          </div>
        </div>

        <h1 className="login-title">Ingresar a PD Obras</h1>
        <p className="login-sub">Ingresá con tu cuenta asignada</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <div className="login-input-wrap">
              <Icon name="user" size={16} />
              <input
                className="login-input"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          <div className="field">
            <label>Contraseña</label>
            <div className="login-input-wrap">
              <Icon name="settings" size={16} />
              <input
                className="login-input"
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPass((v) => !v)}
                tabIndex={-1}
              >
                <Icon name={showPass ? "sun" : "clock"} size={15} />
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error">
              <Icon name="alert" size={14} /> {error}
            </div>
          )}

          <button
            className="btn btn-gold btn-block"
            type="submit"
            disabled={loading || !email || !password}
          >
            {loading ? (
              <><Icon name="refresh" size={16} style={{ animation: "spin 0.7s linear infinite" }} /> Ingresando…</>
            ) : (
              <>Ingresar <Icon name="chevR" size={16} /></>
            )}
          </button>
        </form>

        <p className="login-footer">
          ¿No tenés cuenta? Contactá al administrador del sistema.
        </p>
      </div>
    </div>
  );
}
