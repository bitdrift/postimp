-- Add channel column to messages table
ALTER TABLE public.messages ADD COLUMN channel text NOT NULL DEFAULT 'sms';
ALTER TABLE public.messages ADD CONSTRAINT messages_channel_check CHECK (channel IN ('sms', 'web'));

-- Make phone column nullable (web messages don't have a phone number)
ALTER TABLE public.messages ALTER COLUMN phone DROP NOT NULL;

-- Enable Supabase Realtime on messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
