import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribe to realtime changes on a Postgres table and run a callback on every change.
 * Optionally pass a filter (e.g. `doctor_id=eq.${userId}`) to scope events.
 */
export function useRealtime(
  table: string,
  onChange: () => void,
  filter?: string,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`rt-${table}-${filter ?? 'all'}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        () => onChange()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, enabled]);
}
