-- Allow users to read their own pending Facebook tokens
CREATE POLICY "Users can read own pending tokens"
  ON public.pending_facebook_tokens
  FOR SELECT
  USING (profile_id = auth.uid());
