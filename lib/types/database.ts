export interface Thread {
  id: number;
  created_at: string;
  thread_id: string;
  name: string | null;
  user_id: string | null;
}

export interface ThreadInsert {
  thread_id: string;
  name?: string | null;
  user_id: string;
}

export interface ThreadUpdate {
  name?: string | null;
}

export interface DbMessage {
  id: number;
  created_at: string;
  thread_id: number;
  role: "user" | "assistant";
  content: string;
  user_id: string;
}

export interface DbMessageInsert {
  thread_id: number;
  role: "user" | "assistant";
  content: string;
  user_id: string;
}

