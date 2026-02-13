import type { ApiResponse } from "../types";

const API_BASE = "/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  return res.json();
}

export const api = {
  // Users
  createUser: (username: string) =>
    request<{ id: string; username: string; created_at: string }>("/users", {
      method: "POST",
      body: JSON.stringify({ username }),
    }),

  listUsers: () =>
    request<{ id: string; username: string; created_at: string }[]>("/users"),

  // Knowledge Bases
  createKB: (user_id: string, name: string, description?: string) =>
    request("/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({ user_id, name, description }),
    }),

  listKBs: (user_id: string) =>
    request(`/knowledge-bases?user_id=${user_id}`),

  deleteKB: (kb_id: string) =>
    request(`/knowledge-bases/${kb_id}`, { method: "DELETE" }),

  // Files
  uploadFiles: async (kb_id: string, user_id: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const res = await fetch(
      `${API_BASE}/knowledge-bases/${kb_id}/files?user_id=${user_id}`,
      { method: "POST", body: form }
    );
    return res.json();
  },

  listFiles: (kb_id: string) => request(`/knowledge-bases/${kb_id}/files`),

  deleteFile: (file_id: string) =>
    request(`/files/${file_id}`, { method: "DELETE" }),

  getFileContent: (file_id: string) => request(`/files/${file_id}/content`),

  // Topics
  clusterKB: (kb_id: string) =>
    request(`/knowledge-bases/${kb_id}/cluster`, { method: "POST" }),

  listTopics: (kb_id: string) =>
    request(`/knowledge-bases/${kb_id}/topics`),

  // Chat
  createSession: (user_id: string, title?: string) =>
    request("/chat/sessions", {
      method: "POST",
      body: JSON.stringify({ user_id, title }),
    }),

  listSessions: (user_id: string) =>
    request(`/chat/sessions?user_id=${user_id}`),

  getMessages: (session_id: string) =>
    request(`/chat/sessions/${session_id}/messages`),

  sendQuery: (session_id: string, query: string) =>
    request(`/chat/sessions/${session_id}/query`, {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
};
