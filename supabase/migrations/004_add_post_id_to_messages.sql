ALTER TABLE public.messages ADD COLUMN post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;
CREATE INDEX idx_messages_post_id ON public.messages(post_id);
