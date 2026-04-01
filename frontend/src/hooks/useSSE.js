import { useEffect, useRef } from "react";

/**
 * EventSource hook with JSON message parsing and exponential backoff reconnect.
 * @param {string} url - Full SSE URL (omit or pass empty to disable)
 * @param {{ onMessage?: (data: unknown) => void, onError?: (e: Event) => void, enabled?: boolean }} options
 */
export function useSSE(url, options = {}) {
  const { onMessage, onError, enabled = true } = options;
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const reconnectAttempt = useRef(0);
  const esRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
  }, [onMessage, onError]);

  useEffect(() => {
    if (!enabled || !url) return undefined;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      clearReconnectTimer();
      try {
        const es = new EventSource(url);
        esRef.current = es;

        es.onmessage = (event) => {
          reconnectAttempt.current = 0;
          let data;
          try {
            data = JSON.parse(event.data);
          } catch {
            data = event.data;
          }
          onMessageRef.current?.(data);
        };

        es.onerror = (e) => {
          onErrorRef.current?.(e);
          es.close();
          esRef.current = null;
          const delay = Math.min(
            10000,
            1000 * 2 ** Math.min(reconnectAttempt.current, 3)
          );
          reconnectAttempt.current += 1;
          reconnectTimerRef.current = window.setTimeout(connect, delay);
        };
      } catch {
        const delay = Math.min(
          10000,
          1000 * 2 ** Math.min(reconnectAttempt.current, 3)
        );
        reconnectAttempt.current += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      clearReconnectTimer();
      reconnectAttempt.current = 0;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [url, enabled]);
}
