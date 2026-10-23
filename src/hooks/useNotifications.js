import { useState, useEffect, useCallback } from 'react';
import { supabase, getNotificaciones, marcarNotificacionLeida, marcarTodasNotificacionesLeidas } from '../supabase.js';

export function useNotifications(userId) {
  const [items, setItems] = useState([]);

  const refresh = useCallback(async () => {
    if (!userId) { setItems([]); return; }
    try {
      setItems(await getNotificaciones(userId));
    } catch {
      setItems([]);
    }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notificaciones-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'Notificaciones',
        filter: `destinatario_id=eq.${userId}`,
      }, (payload) => {
        setItems((prev) => [payload.new, ...prev].slice(0, 30));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, leida: true } : n));
    try { await marcarNotificacionLeida(id); } catch { refresh(); }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setItems((prev) => prev.map((n) => ({ ...n, leida: true })));
    try { await marcarTodasNotificacionesLeidas(userId); } catch { refresh(); }
  }, [userId, refresh]);

  const unreadCount = items.filter((n) => !n.leida).length;

  return { items, unreadCount, markRead, markAllRead };
}
