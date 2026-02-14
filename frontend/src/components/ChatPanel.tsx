import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import type { ChatMessage, ChatSession, ReplStep } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";

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

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { connected, sendQuery, onReplStep, onAnswer, onError } =
    useWebSocket(currentSession?.id ?? null);

  // Load sessions when user changes
  useEffect(() => {
    if (!currentUser) return;
    api.listSessions(currentUser.id).then((res) => {
      if (res.success && res.data) {
        setChatSessions(res.data as ChatSession[]);
      }
    });
  }, [currentUser]);

  // Load messages when session changes
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

  // Set up WS callbacks
  useEffect(() => {
    onReplStep.current = (step: ReplStep) => {
      addReplStep(step);
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
    };
    onError.current = (_error: string) => {
      setIsLoading(false);
    };
  }, [currentSession]);

  // Auto-scroll
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
    }
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || !currentSession || !currentUser || isLoading) return;

    const query = input.trim();
    setInput("");
    clearReplSteps();
    setIsLoading(true);

    // Add user message optimistically
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
      // Fallback to REST
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

  return (
    <div className="flex flex-col h-full bg-cyber-deep/50">
      {/* Session tabs */}
      <div className="border-b border-cyber-cyan/20 px-3 py-2 flex items-center gap-2 overflow-x-auto bg-cyber-surface/50 backdrop-blur-sm">
        <button
          className="text-xs px-3 py-1.5 bg-cyber-pink/20 text-cyber-pink border border-cyber-pink/40 rounded hover:bg-cyber-pink/30 shrink-0 font-mono uppercase tracking-wider transition-all"
          onClick={handleNewSession}
        >
          + New Session
        </button>
        {chatSessions.map((s) => (
          <button
            key={s.id}
            className={`text-xs px-3 py-1.5 rounded shrink-0 font-mono transition-all ${
              currentSession?.id === s.id
                ? "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50 glow-cyan"
                : "text-cyber-muted border border-transparent hover:border-cyber-cyan/20 hover:text-cyber-text"
            }`}
            onClick={() => setCurrentSession(s)}
          >
            {s.title ?? "Untitled"}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!currentSession && (
          <div className="text-center text-cyber-muted mt-20 font-mono">
            <span className="text-glow-cyan text-cyber-cyan">&gt;</span> Initialize a new session to begin_
          </div>
        )}
        {messages
          .filter((m) => m.role !== "repl_log")
          .map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded text-sm font-mono ${
                  msg.role === "user"
                    ? "bg-cyber-pink/15 text-cyber-text border border-cyber-pink/30 cyber-clip"
                    : "bg-cyber-surface border border-cyber-cyan/20 text-cyber-text"
                }`}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown className="prose prose-sm prose-invert max-w-none prose-cyber">
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-cyber-surface border border-cyber-cyan/30 px-4 py-2.5 rounded text-sm text-cyber-cyan font-mono animate-neon-pulse">
              &gt; processing query...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-cyber-cyan/20 p-3 bg-cyber-surface/50 backdrop-blur-sm">
        <div className="flex gap-2">
          <input
            className="flex-1 px-4 py-2.5 bg-cyber-deep border border-cyber-cyan/30 rounded text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-cyan glow-cyan placeholder:text-cyber-muted transition-all"
            placeholder={
              currentSession
                ? "> enter query..."
                : "> no active session"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={!currentSession || isLoading}
          />
          <button
            className="px-5 py-2.5 bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50 rounded text-sm font-mono uppercase tracking-wider hover:bg-cyber-cyan/30 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            onClick={handleSend}
            disabled={!currentSession || !input.trim() || isLoading}
          >
            Transmit
          </button>
        </div>
      </div>
    </div>
  );
}
