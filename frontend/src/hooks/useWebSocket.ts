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

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const onReplStep = useRef<((step: ReplStep) => void) | null>(null);
  const onAnswer = useRef<((answer: string) => void) | null>(null);
  const onError = useRef<((error: string) => void) | null>(null);

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

      if (msg.type === "repl_step" && onReplStep.current) {
        onReplStep.current({
          iteration: msg.iteration ?? 0,
          code: msg.code ?? "",
          output: msg.output ?? "",
          has_answer: msg.has_answer ?? false,
        });
      } else if (msg.type === "answer" && onAnswer.current) {
        onAnswer.current(msg.content ?? "");
      } else if (msg.type === "error" && onError.current) {
        onError.current(msg.content ?? "Unknown error");
      }
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
    };
  }, [sessionId]);

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
  };
}
