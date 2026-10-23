import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, getProfile } from '../supabase.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = async (userId) => {
    setProfileLoading(true);
    try {
      const p = await getProfile(userId);
      setProfile(p);
    } catch {
      setProfile({ rol: 'operador' });
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    // Sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
    });

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = profile?.rol === 'admin';
  const isOperador = profile?.rol === 'operador';
  // Esperamos también al perfil: si solo miráramos la sesión, isAdmin podría
  // leerse como false durante la ventana en que la sesión ya cargó pero el
  // perfil todavía no — eso hacía rebotar rutas protegidas por rol (ej. Config).
  const loading = session === undefined || (!!session?.user && profile === null && profileLoading);

  return (
    <AuthCtx.Provider value={{ session, profile, isAdmin, isOperador, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
