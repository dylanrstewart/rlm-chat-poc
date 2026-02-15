import { create } from "zustand";
import type {
  ChatMessage,
  ChatSession,
  FileRecord,
  KnowledgeBase,
  ReplStep,
  User,
} from "../types";

interface AppState {
  // User
  currentUser: User | null;
  users: User[];
  setCurrentUser: (user: User | null) => void;
  setUsers: (users: User[]) => void;

  // Knowledge Bases
  knowledgeBases: KnowledgeBase[];
  selectedKB: KnowledgeBase | null;
  setKnowledgeBases: (kbs: KnowledgeBase[]) => void;
  setSelectedKB: (kb: KnowledgeBase | null) => void;

  // Files
  files: FileRecord[];
  setFiles: (files: FileRecord[]) => void;

  // Chat
  chatSessions: ChatSession[];
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  setChatSessions: (sessions: ChatSession[]) => void;
  setCurrentSession: (session: ChatSession | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;

  // REPL
  replSteps: ReplStep[];
  setReplSteps: (steps: ReplStep[]) => void;
  addReplStep: (step: ReplStep) => void;
  clearReplSteps: () => void;

  // UI State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Audio
  soundMuted: boolean;
  setSoundMuted: (muted: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  users: [],
  setCurrentUser: (user) => set({ currentUser: user }),
  setUsers: (users) => set({ users }),

  knowledgeBases: [],
  selectedKB: null,
  setKnowledgeBases: (kbs) => set({ knowledgeBases: kbs }),
  setSelectedKB: (kb) => set({ selectedKB: kb }),

  files: [],
  setFiles: (files) => set({ files }),

  chatSessions: [],
  currentSession: null,
  messages: [],
  setChatSessions: (sessions) => set({ chatSessions: sessions }),
  setCurrentSession: (session) => set({ currentSession: session }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  replSteps: [],
  setReplSteps: (steps) => set({ replSteps: steps }),
  addReplStep: (step) =>
    set((state) => ({ replSteps: [...state.replSteps, step] })),
  clearReplSteps: () => set({ replSteps: [] }),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  soundMuted: localStorage.getItem("soundMuted") === "true",
  setSoundMuted: (muted) => {
    localStorage.setItem("soundMuted", String(muted));
    set({ soundMuted: muted });
  },
}));
