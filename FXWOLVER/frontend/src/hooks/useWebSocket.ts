import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '../stores/marketStore';
import { WS_URL } from '../config';

/**
 * Manages a WebSocket connection to the FXWOLVER backend.
 * - Auto-reconnects with exponential back-off (3s → 6s → … → 30s)
 * - Updates Zustand market store on every quote received
 */
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const delay = useRef(3000);

  const { updateQuote, bulkUpdateQuotes, setWsConnected, setWsReconnecting } =
    useMarketStore();

  const connect = useCallback(() => {
    // Tear down any existing socket
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setWsReconnecting(true);
    console.log(`[WS] Connecting to ${WS_URL}…`);

    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      console.error('[WS] Failed to construct WebSocket:', err);
      scheduleReconnect();
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ [WS] Connected to FXWOLVER API');
      setWsConnected(true);
      setWsReconnecting(false);
      delay.current = 3000; // reset back-off
    };

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === 'quote') {
          updateQuote(msg.data);
        } else if (msg.type === 'initial_quotes') {
          bulkUpdateQuotes(msg.data);
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      console.warn('[WS] Connection closed — will reconnect');
      setWsConnected(false);
      scheduleReconnect();
    };

    ws.onerror = () => {
      setWsConnected(false);
      ws.close();
    };
  }, [updateQuote, bulkUpdateQuotes, setWsConnected, setWsReconnecting]);

  function scheduleReconnect() {
    setWsReconnecting(true);
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    console.log(`[WS] Reconnecting in ${delay.current / 1000}s…`);
    reconnectTimer.current = window.setTimeout(() => {
      delay.current = Math.min(delay.current * 1.5, 30_000); // cap at 30s
      connect();
    }, delay.current);
  }

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  return wsRef;
}
