-- Add granted_scopes to track which OAuth scopes each connection was authorized with.
-- NULL means "unknown / pre-migration" — treat as needing re-auth when new scopes are required.

ALTER TABLE instagram_connections
  ADD COLUMN IF NOT EXISTS granted_scopes text[];

ALTER TABLE facebook_connections
  ADD COLUMN IF NOT EXISTS granted_scopes text[];

ALTER TABLE pending_facebook_tokens
  ADD COLUMN IF NOT EXISTS granted_scopes text[];
