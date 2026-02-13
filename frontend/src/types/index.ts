export interface User {
  id: string;
  username: string;
  created_at: string;
}

export interface KnowledgeBase {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  milvus_collection: string;
  created_at: string;
}

export interface FileRecord {
  id: string;
  user_id: string;
  knowledge_base_id: string;
  filename: string;
  title: string | null;
  file_type: string | null;
  file_size_bytes: number | null;
  chunk_count: number;
  created_at: string;
}

export interface Topic {
  id: string;
  knowledge_base_id: string;
  topic_level: number;
  topic_label: string;
  topic_id: number;
  doc_count: number;
  sample_keywords: string[] | null;
  parent_topic_id: string | null;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "repl_log";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ReplStep {
  iteration: number;
  code: string;
  output: string;
  has_answer: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  meta?: {
    total: number;
    page: number;
    limit: number;
  } | null;
}
