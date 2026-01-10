-- =============================================================================
-- INITIAL SCHEMA
-- =============================================================================

-- Threads table
CREATE TABLE public.threads (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  thread_id text,
  name text,
  user_id text,
  CONSTRAINT threads_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_threads_user_id ON public.threads(user_id);

-- Messages table
CREATE TABLE public.messages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  thread_id bigint NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  user_id text NOT NULL,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id)
);

CREATE INDEX idx_messages_thread_id ON public.messages(thread_id);
CREATE INDEX idx_messages_user_id ON public.messages(user_id);

