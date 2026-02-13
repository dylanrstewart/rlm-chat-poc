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
    <div className="flex flex-col h-full">
      {/* Session tabs */}
      <div className="border-b border-gray-200 px-3 py-2 flex items-center gap-2 overflow-x-auto bg-white">
        <button
          className="text-xs px-2 py-1 bg-blue-600 text-white rounded shrink-0 hover:bg-blue-500"
          onClick={handleNewSession}
        >
          + New Chat
        </button>
        {chatSessions.map((s) => (
          <button
            key={s.id}
            className={`text-xs px-2 py-1 rounded shrink-0 ${
              currentSession?.id === s.id
                ? "bg-blue-100 text-blue-700 border border-blue-300"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
          <div className="text-center text-gray-400 mt-20">
            Create a new chat session to start
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
                className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown className="prose prose-sm max-w-none">
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
            <div className="bg-gray-100 px-3 py-2 rounded-lg text-sm text-gray-500 animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 bg-white">
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={
              currentSession
                ? "Type a message..."
                : "Create a session first"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={!currentSession || isLoading}
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 disabled:opacity-50"
            onClick={handleSend}
            disabled={!currentSession || !input.trim() || isLoading}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
