import { useCallback, useEffect, useRef, useState } from "react";
import type { ReplStep } from "../types";

interface WSMessage {
  type: "repl_step" | "answer" | "error";
  content?: string;
  iteration?: number;
  code?: string;
  output?: string;
  has_answer?: boolean;
}

const MAX_QUEUE_SIZE = 50;

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const onReplStep = useRef<((step: ReplStep) => void) | null>(null);
  const onAnswer = useRef<((answer: string) => void) | null>(null);
  const onError = useRef<((error: string) => void) | null>(null);

  const pendingQueue = useRef<WSMessage[]>([]);

  const dispatch = useCallback((msg: WSMessage) => {
    if (msg.type === "repl_step") {
      if (onReplStep.current) {
        onReplStep.current({
          iteration: msg.iteration ?? 0,
          code: msg.code ?? "",
          output: msg.output ?? "",
          has_answer: msg.has_answer ?? false,
        });
      } else if (pendingQueue.current.length < MAX_QUEUE_SIZE) {
        pendingQueue.current.push(msg);
      }
    } else if (msg.type === "answer") {
      if (onAnswer.current) {
        onAnswer.current(msg.content ?? "");
      } else if (pendingQueue.current.length < MAX_QUEUE_SIZE) {
        pendingQueue.current.push(msg);
      }
    } else if (msg.type === "error") {
      if (onError.current) {
        onError.current(msg.content ?? "Unknown error");
      } else if (pendingQueue.current.length < MAX_QUEUE_SIZE) {
        pendingQueue.current.push(msg);
      }
    } else {
      console.warn("[useWebSocket] unhandled message type", msg);
    }
  }, []);

  const flush = useCallback(() => {
    const queued = pendingQueue.current.splice(0);
    if (queued.length > 0) {
      console.info(`[useWebSocket] flushing ${queued.length} queued message(s)`);
    }
    for (const msg of queued) {
      dispatch(msg);
    }
  }, [dispatch]);

  const clearQueue = useCallback(() => {
    pendingQueue.current = [];
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/api/chat/sessions/${sessionId}/ws`
    );

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const msg: WSMessage = JSON.parse(event.data);
      dispatch(msg);
    };

    // Keepalive ping every 30s to prevent proxy/network timeout
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    wsRef.current = ws;
    return () => {
      clearInterval(pingInterval);
      ws.close();
      pendingQueue.current = [];
    };
  }, [sessionId, dispatch]);

  const sendQuery = useCallback(
    (query: string, userId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ query, user_id: userId }));
      }
    },
    []
  );

  return {
    connected,
    sendQuery,
    onReplStep,
    onAnswer,
    onError,
    flush,
    clearQueue,
  };
}
