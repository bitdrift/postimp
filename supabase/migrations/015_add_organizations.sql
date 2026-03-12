-- Migration: Add organizations data model
-- Organizations own social accounts; users belong to orgs via memberships with roles.

-- =============================================================================
-- 1. Enum
-- =============================================================================

CREATE TYPE org_role AS ENUM ('owner', 'manager', 'member');

-- =============================================================================
-- 2. New tables
-- =============================================================================

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  creator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  brand_name text,
  brand_description text,
  tone text,
  target_audience text,
  caption_style text DEFAULT 'polished',
  publish_platforms text[] DEFAULT ARRAY['instagram'],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER handle_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TABLE organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- =============================================================================
-- 3. RLS helper functions
-- =============================================================================

CREATE OR REPLACE FUNCTION is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_org_owner(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

-- =============================================================================
-- 4. RLS on organizations
-- =============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their organizations"
  ON organizations FOR SELECT
  USING (is_org_member(id));

CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can update their organizations"
  ON organizations FOR UPDATE
  USING (is_org_owner(id));

CREATE POLICY "Owners can delete their organizations"
  ON organizations FOR DELETE
  USING (is_org_owner(id));

-- =============================================================================
-- 5. RLS on organization_members
-- =============================================================================

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org memberships"
  ON organization_members FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Owners can add members"
  ON organization_members FOR INSERT
  WITH CHECK (is_org_owner(organization_id));

CREATE POLICY "Owners can update members"
  ON organization_members FOR UPDATE
  USING (is_org_owner(organization_id));

CREATE POLICY "Owners can remove members"
  ON organization_members FOR DELETE
  USING (is_org_owner(organization_id));

-- =============================================================================
-- 5b. Atomic org creation RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION create_organization(p_user_id uuid, p_name text)
RETURNS organizations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org organizations;
BEGIN
  INSERT INTO organizations (name, creator_user_id)
  VALUES (p_name, p_user_id)
  RETURNING * INTO new_org;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_org.id, p_user_id, 'owner');

  RETURN new_org;
END;
$$;

-- =============================================================================
-- 6. Alter instagram_connections
-- =============================================================================

-- Add new columns
ALTER TABLE instagram_connections
  ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- =============================================================================
-- 7. Alter facebook_connections
-- =============================================================================

ALTER TABLE facebook_connections
  ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- =============================================================================
-- 8. Alter pending_facebook_tokens
-- =============================================================================

ALTER TABLE pending_facebook_tokens
  ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- =============================================================================
-- 9. Alter posts
-- =============================================================================

ALTER TABLE posts
  ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

-- =============================================================================
-- 10. Data migration — backfill from existing profiles
-- =============================================================================

DO $$
DECLARE
  rec RECORD;
  new_org_id uuid;
BEGIN
  FOR rec IN
    SELECT id, brand_name FROM profiles
  LOOP
    -- Create an org for each existing profile
    INSERT INTO organizations (name, creator_user_id, brand_name)
    VALUES (COALESCE(rec.brand_name, 'My Organization'), rec.id, rec.brand_name)
    RETURNING id INTO new_org_id;

    -- Add profile owner as org owner
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (new_org_id, rec.id, 'owner');

    -- Backfill connections
    UPDATE instagram_connections
    SET organization_id = new_org_id, user_id = rec.id
    WHERE profile_id = rec.id;

    UPDATE facebook_connections
    SET organization_id = new_org_id, user_id = rec.id
    WHERE profile_id = rec.id;

    UPDATE pending_facebook_tokens
    SET organization_id = new_org_id
    WHERE profile_id = rec.id;

    -- Backfill posts
    UPDATE posts
    SET organization_id = new_org_id
    WHERE profile_id = rec.id;
  END LOOP;
END $$;

-- =============================================================================
-- 11. Enforce NOT NULL on organization_id after backfill
-- =============================================================================

ALTER TABLE instagram_connections
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE facebook_connections
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE pending_facebook_tokens
  ALTER COLUMN organization_id SET NOT NULL;

-- posts.organization_id stays nullable per plan

-- Add unique constraints on organization_id for connection upserts
ALTER TABLE instagram_connections
  ADD CONSTRAINT instagram_connections_organization_id_key UNIQUE (organization_id);

ALTER TABLE facebook_connections
  ADD CONSTRAINT facebook_connections_organization_id_key UNIQUE (organization_id);

ALTER TABLE pending_facebook_tokens
  ADD CONSTRAINT pending_facebook_tokens_organization_id_key UNIQUE (organization_id);

-- =============================================================================
-- 12. Drop old profile-based RLS policies (must happen before dropping columns)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own instagram connection" ON instagram_connections;
DROP POLICY IF EXISTS "Users can insert own instagram connection" ON instagram_connections;
DROP POLICY IF EXISTS "Users can update own instagram connection" ON instagram_connections;
DROP POLICY IF EXISTS "Users can delete own instagram connection" ON instagram_connections;

DROP POLICY IF EXISTS "Users can view own facebook connection" ON facebook_connections;
DROP POLICY IF EXISTS "Users can insert own facebook connection" ON facebook_connections;
DROP POLICY IF EXISTS "Users can update own facebook connection" ON facebook_connections;
DROP POLICY IF EXISTS "Users can delete own facebook connection" ON facebook_connections;

DROP POLICY IF EXISTS "Users can read own pending tokens" ON pending_facebook_tokens;

-- =============================================================================
-- 13. Drop old profile_id columns and constraints from connection tables
-- =============================================================================

-- instagram_connections: drop unique constraint on profile_id, then the column
ALTER TABLE instagram_connections
  DROP CONSTRAINT IF EXISTS instagram_connections_profile_id_key;
ALTER TABLE instagram_connections
  DROP COLUMN profile_id;

-- facebook_connections: drop unique constraint on profile_id, then the column
ALTER TABLE facebook_connections
  DROP CONSTRAINT IF EXISTS facebook_connections_profile_id_key;
ALTER TABLE facebook_connections
  DROP COLUMN profile_id;

-- pending_facebook_tokens: drop unique constraint on profile_id, then the column
ALTER TABLE pending_facebook_tokens
  DROP CONSTRAINT IF EXISTS pending_facebook_tokens_profile_id_key;
ALTER TABLE pending_facebook_tokens
  DROP COLUMN profile_id;

-- =============================================================================
-- 14. New org-based RLS policies on instagram_connections
-- =============================================================================

-- New org-based policies
CREATE POLICY "Org members can view instagram connections"
  ON instagram_connections FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Org owners can insert instagram connections"
  ON instagram_connections FOR INSERT
  WITH CHECK (is_org_owner(organization_id));

CREATE POLICY "Org owners can update instagram connections"
  ON instagram_connections FOR UPDATE
  USING (is_org_owner(organization_id));

CREATE POLICY "Org owners can delete instagram connections"
  ON instagram_connections FOR DELETE
  USING (is_org_owner(organization_id));

-- =============================================================================
-- 15. New org-based RLS policies on facebook_connections
-- =============================================================================

CREATE POLICY "Org members can view facebook connections"
  ON facebook_connections FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Org owners can insert facebook connections"
  ON facebook_connections FOR INSERT
  WITH CHECK (is_org_owner(organization_id));

CREATE POLICY "Org owners can update facebook connections"
  ON facebook_connections FOR UPDATE
  USING (is_org_owner(organization_id));

CREATE POLICY "Org owners can delete facebook connections"
  ON facebook_connections FOR DELETE
  USING (is_org_owner(organization_id));

-- =============================================================================
-- 15b. New org-based RLS policies on pending_facebook_tokens
-- =============================================================================

CREATE POLICY "Org members can view pending facebook tokens"
  ON pending_facebook_tokens FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Org owners can insert pending facebook tokens"
  ON pending_facebook_tokens FOR INSERT
  WITH CHECK (is_org_owner(organization_id));

CREATE POLICY "Org owners can update pending facebook tokens"
  ON pending_facebook_tokens FOR UPDATE
  USING (is_org_owner(organization_id));

CREATE POLICY "Org owners can delete pending facebook tokens"
  ON pending_facebook_tokens FOR DELETE
  USING (is_org_owner(organization_id));

-- =============================================================================
-- 16. Add org-member policies on posts (alongside existing user policies)
-- =============================================================================

CREATE POLICY "Org members can view org posts"
  ON posts FOR SELECT
  USING (organization_id IS NOT NULL AND is_org_member(organization_id));

CREATE POLICY "Org members can insert org posts"
  ON posts FOR INSERT
  WITH CHECK (organization_id IS NOT NULL AND is_org_member(organization_id));

CREATE POLICY "Org members can update org posts"
  ON posts FOR UPDATE
  USING (organization_id IS NOT NULL AND is_org_member(organization_id));

-- =============================================================================
-- 16. Indexes for common lookups
-- =============================================================================

CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_instagram_connections_org_id ON instagram_connections(organization_id);
CREATE INDEX idx_facebook_connections_org_id ON facebook_connections(organization_id);
CREATE INDEX idx_pending_facebook_tokens_org_id ON pending_facebook_tokens(organization_id);
CREATE INDEX idx_posts_org_id ON posts(organization_id);
