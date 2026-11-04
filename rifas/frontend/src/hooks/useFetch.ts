import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
export function useFetch<T>(url: string, pollMs = 0) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try { const value = await api<T>(url); if (sequence.current === current) { setData(value); setError(''); } }
    catch (err) { if (sequence.current === current) setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos.'); }
    finally { if (sequence.current === current) setLoading(false); }
  }, [url]);
  useEffect(() => {
    setData(null); setLoading(true); void refresh();
    const timer = pollMs ? setInterval(() => { if (!document.hidden) void refresh(); }, pollMs) : undefined;
    const focus = () => { if (pollMs) void refresh(); }; window.addEventListener('focus', focus);
    return () => { sequence.current++; clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [refresh, pollMs]);
  return { data, error, loading, refresh };
}
