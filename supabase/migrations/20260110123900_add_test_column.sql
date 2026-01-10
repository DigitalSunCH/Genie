-- Add test column to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS test text;

