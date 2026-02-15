import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import type { ChatMessage, ChatSession, ReplStep } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { useSound } from "../audio/useSound";
import { playIfUnmuted } from "../audio/useSound";

export function ChatPanel() {
  const {
    currentUser,
    currentSession,
    chatSessions,
    messages,
    setCurrentSession,
    setChatSessions,
    setMessages,
    addMessage,
    addReplStep,
    clearReplSteps,
    setIsLoading,
    isLoading,
  } = useAppStore();

  const { play } = useSound();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { connected, sendQuery, onReplStep, onAnswer, onError } =
    useWebSocket(currentSession?.id ?? null);

  useEffect(() => {
    if (!currentUser) return;
    api.listSessions(currentUser.id).then((res) => {
      if (res.success && res.data) {
        setChatSessions(res.data as ChatSession[]);
      }
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentSession) {
      setMessages([]);
      return;
    }
    api.getMessages(currentSession.id).then((res) => {
      if (res.success && res.data) {
        setMessages(res.data as ChatMessage[]);
      }
    });
  }, [currentSession]);

  // Fallback: if WS answer is missed, refetch messages from API
  const refetchMessages = useCallback(async () => {
    if (!currentSession) return;
    const res = await api.getMessages(currentSession.id);
    if (res.success && res.data) {
      setMessages(res.data as ChatMessage[]);
    }
  }, [currentSession]);

  useEffect(() => {
    onReplStep.current = (step: ReplStep) => {
      addReplStep(step);
      playIfUnmuted("replStep");
    };
    onAnswer.current = (answer: string) => {
      addMessage({
        id: crypto.randomUUID(),
        session_id: currentSession?.id ?? "",
        role: "assistant",
        content: answer,
        metadata: null,
        created_at: new Date().toISOString(),
      });
      setIsLoading(false);
      playIfUnmuted("messageReceive");
    };
    onError.current = (error: string) => {
      setIsLoading(false);
      playIfUnmuted("error");
      // Refetch in case answer was persisted but WS send failed
      refetchMessages();
    };
  }, [currentSession, refetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewSession = async () => {
    if (!currentUser) return;
    const res = await api.createSession(currentUser.id, "New Chat");
    if (res.success && res.data) {
      const session = res.data as ChatSession;
      setChatSessions([session, ...chatSessions]);
      setCurrentSession(session);
      play("confirm");
    }
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || !currentSession || !currentUser || isLoading) return;

    const query = input.trim();
    setInput("");
    clearReplSteps();
    setIsLoading(true);
    play("messageSend");

    addMessage({
      id: crypto.randomUUID(),
      session_id: currentSession.id,
      role: "user",
      content: query,
      metadata: null,
      created_at: new Date().toISOString(),
    });

    if (connected) {
      sendQuery(query, currentUser.id);
    } else {
      const res = await api.sendQuery(currentSession.id, query);
      if (res.success && res.data) {
        addMessage({
          id: crypto.randomUUID(),
          session_id: currentSession.id,
          role: "assistant",
          content: res.data as string,
          metadata: null,
          created_at: new Date().toISOString(),
        });
      }
      setIsLoading(false);
    }
  }, [input, currentSession, currentUser, connected, isLoading]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Channel header + session tabs */}
      <div className="t-border-b px-3 py-2 flex items-center gap-3">
        <span className="text-sm text-terminal-amber-bright text-glow uppercase tracking-wider">
          &gt; Communication Channel: RLM.NET
        </span>
        <div className="flex-1" />
        <button
          className="text-sm px-2 py-1 t-border text-terminal-amber hover:bg-terminal-amber-faint font-mono uppercase"
          onClick={handleNewSession}
        >
          [+ New Chat]
        </button>
      </div>

      {/* Session tabs */}
      {chatSessions.length > 0 && (
        <div className="t-border-b px-3 py-1 flex items-center gap-1 overflow-x-auto">
          {chatSessions.map((s) => (
            <button
              key={s.id}
              className={`text-sm px-2 py-0.5 font-mono uppercase shrink-0 ${
                currentSession?.id === s.id
                  ? "text-terminal-amber-bright bg-terminal-amber-faint t-border text-glow"
                  : "text-terminal-amber-dim hover:text-terminal-amber"
              }`}
              onClick={() => {
                if (currentSession?.id !== s.id) play("tabClick");
                setCurrentSession(s);
              }}
            >
              {s.title ?? "Untitled"}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {!currentSession && (
          <div className="text-center text-terminal-amber-dim mt-20 text-sm">
            &gt; CREATE A NEW CHAT SESSION TO BEGIN TRANSMISSION...
          </div>
        )}
        {messages
          .filter((m) => m.role !== "repl_log")
          .map((msg) => (
            <div key={msg.id} className="text-sm font-mono">
              <span className="text-terminal-amber-dim">[{formatTime(msg.created_at)}]</span>{" "}
              <span className={msg.role === "user" ? "text-terminal-amber-bright" : "text-terminal-amber"}>
                {msg.role === "user" ? (currentUser?.username ?? "You") : "RLM_AI"}:
              </span>{" "}
              {msg.role === "assistant" ? (
                <span className="inline">
                  <ReactMarkdown
                    className="prose prose-sm max-w-none inline prose-terminal"
                    components={{
                      p: ({ children }) => <span>{children} </span>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </span>
              ) : (
                <span>{msg.content}</span>
              )}
            </div>
          ))}
        {isLoading && (
          <div className="text-sm font-mono text-terminal-amber-dim cursor-blink">
            &gt; PROCESSING QUERY...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="t-border-t px-3 py-2 flex items-center gap-2">
        <span className="text-sm text-terminal-amber-bright text-glow shrink-0">&gt; TRANSMIT MESSAGE:</span>
        <input
          className="flex-1 bg-transparent text-terminal-amber text-sm font-mono outline-none placeholder-terminal-amber-dim"
          placeholder={currentSession ? "Type message..." : "No active session"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          disabled={!currentSession || isLoading}
        />
        <button
          className="text-sm px-3 py-1 t-border text-terminal-amber hover:bg-terminal-amber-faint font-mono uppercase disabled:opacity-30"
          onClick={handleSend}
          disabled={!currentSession || !input.trim() || isLoading}
        >
          [Send]
        </button>
      </div>
    </div>
  );
}
