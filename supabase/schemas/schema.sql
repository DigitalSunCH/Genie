-- =============================================================================
-- MAIN DATABASE SCHEMA
-- =============================================================================
-- Edit this file to make schema changes, then run:
--   pnpm db:generate     → Generate migration from changes
-- 
-- The migration will be auto-created in supabase/migrations/
-- GitHub/Supabase integration will deploy it automatically on push.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- THREADS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.threads (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  thread_id text,
  name text,
  user_id text,
  CONSTRAINT threads_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_threads_user_id ON public.threads(user_id);

-- -----------------------------------------------------------------------------
-- MESSAGES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  thread_id bigint NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  user_id text NOT NULL,
  test text,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON public.messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);

