ALTER TABLE profiles
  ADD COLUMN caption_style text NOT NULL DEFAULT 'polished'
  CHECK (caption_style IN ('polished', 'casual', 'minimal'));
