/**
 * Tempo real + rolador de dados.
 *  - abre um socket autenticado (mesmo JWT do REST);
 *  - entra/sai da sala da campanha ativa;
 *  - centraliza o log de rolagens, alimentado pelos eventos `dice:roll`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io } from 'socket.io-client';
import { api, getToken } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const RealtimeContext = createContext(null);

/**
 * Insere uma rolagem no topo do log, ignorando repetições do mesmo evento
 * (o socket pode reentregar/duplicar um `dice:roll`). Evita "duas rolagens
 * no log por um único clique".
 */
function appendRoll(current, entry) {
  if (!entry) return current;
  if (entry.id != null && current.some((item) => item.id === entry.id)) return current;
  return [entry, ...current].slice(0, 60);
}

export function RealtimeProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [campaignId, setCampaignIdState] = useState(null);
  const [diceLog, setDiceLog] = useState([]);
  const listenersRef = useRef(new Map());

  // --- Conexão -------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated) {
      setSocket(null);
      setConnected(false);
      return undefined;
    }

    const instance = io({ path: '/socket.io', auth: { token: getToken() } });
    setSocket(instance);
    instance.on('connect', () => setConnected(true));
    instance.on('disconnect', () => setConnected(false));

    return () => {
      instance.close();
      setSocket(null);
      setConnected(false);
    };
  }, [isAuthenticated]);

  // --- Log de rolagens -----------------------------------------------------
  useEffect(() => {
    if (!socket) return undefined;
    const onRoll = (entry) => setDiceLog((current) => appendRoll(current, entry));
    socket.on('dice:roll', onRoll);
    return () => socket.off('dice:roll', onRoll);
  }, [socket]);

  // --- Ponte para eventos arbitrários (ex.: `character:updated`) -----------
  useEffect(() => {
    if (!socket) return undefined;
    const bridge = (event) => (payload) => {
      for (const handler of listenersRef.current.get(event) ?? []) handler(payload);
    };
    const events = [
      'character:updated',
      'party:updated',
      'campaign:joined',
      'error:forbidden',
      'connected',
    ];
    const bound = events.map((event) => {
      const handler = bridge(event);
      socket.on(event, handler);
      return [event, handler];
    });
    return () => bound.forEach(([event, handler]) => socket.off(event, handler));
  }, [socket]);

  /** Assina um evento de socket; `handler` é re-registrado quando muda. */
  const useRealtimeEvent = useCallback((event, handler) => {
    useEffect(() => {
      const map = listenersRef.current;
      const set = map.get(event) ?? new Set();
      set.add(handler);
      map.set(event, set);
      return () => {
        set.delete(handler);
        if (set.size === 0) map.delete(event);
      };
    }, [event, handler]);
  }, []);

  // --- Entrar/sair da sala da campanha -------------------------------------
  useEffect(() => {
    if (!socket || !campaignId) return undefined;
    socket.emit('campaign:join', { campaignId });
    return () => socket.emit('campaign:leave', { campaignId });
  }, [socket, campaignId]);

  const setCampaignId = useCallback((id) => setCampaignIdState(id ?? null), []);

  const loadLog = useCallback(async (options = {}) => {
    const targetCampaign = options.campaignId ?? campaignId;
    const data = await api.get('/dice/log', {
      query: { campaignId: targetCampaign ?? undefined, limit: 40 },
    });
    setDiceLog(data.items ?? []);
    return data.items ?? [];
  }, [campaignId]);

  const clearLog = useCallback(async () => {
    await api.del('/dice/log', { query: { campaignId: campaignId ?? undefined } });
    setDiceLog([]);
  }, [campaignId]);

  /** Rola uma expressão livre, ou um alvo da ficha (`target`). */
  const roll = useCallback(async (payload) => {
    const data = await api.post('/dice/roll', {
      ...payload,
      campaignId: payload.campaignId ?? campaignId ?? undefined,
    });
    return data.entry;
  }, [campaignId]);

  const pushLocal = useCallback((entry) => {
    setDiceLog((current) => appendRoll(current, entry));
  }, []);

  const value = useMemo(
    () => ({
      socket,
      connected,
      campaignId,
      setCampaignId,
      diceLog,
      loadLog,
      clearLog,
      roll,
      pushLocal,
      useRealtimeEvent,
    }),
    [socket, connected, campaignId, setCampaignId, diceLog, loadLog, clearLog, roll, pushLocal, useRealtimeEvent],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtime precisa estar dentro de <RealtimeProvider>.');
  return context;
}

/** Atalho para assinar um evento de tempo real dentro de um componente. */
export function useRealtimeEvent(event, handler) {
  const { useRealtimeEvent: subscribe } = useRealtime();
  subscribe(event, handler);
}
